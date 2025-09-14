import * as core from "@actions/core";
import { Octokit } from "octokit";
import type { CommentPayload, ReviewComment } from "../types/index.js";

const ghToken = core.getInput("github_token", { required: true });

const octokit = new Octokit({
    auth: ghToken,
});

/**
 *  Get the latest commit diff for a pull request
 * @param owner  The owner of the repository
 * @param repo  The repository name
 * @param pullNumber  The pull request number
 * @returns  The pull request details
 */
export async function getPr(
    owner: string,
    repo: string,
    pullNumber: number
): Promise<any> {
    const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    return pr;
}

/**
 *  Get all commits for a pull request
 * @param owner  The owner of the repository
 * @param repo  The repository name
 * @param pullNumber  The pull request number
 * @returns  The list of commits
 */
export async function getCommits(
    owner: string,
    repo: string,
    pullNumber: number
): Promise<any> {
    const { data: commits } = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
    });

    return commits;
}

/**
 *  Get the diff between two commits
 * @param owner The owner of the repository
 * @param repo  The repository name
 * @param baseSha  The base commit SHA
 * @param latestCommitSha  The latest commit SHA
 * @returns  The diff between the two commits
 */
export async function getCommitDiff(
    owner: string,
    repo: string,
    baseSha: string,
    latestCommitSha: string
): Promise<string> {
    const { data: diff } = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: baseSha,
        head: latestCommitSha,
        mediaType: { format: "diff" },
    });

    return diff as unknown as string;
}

/**
 * Get the latest commit diff for a pull request
 * @param owner The owner of the repository
 * @param repo  The repository name
 * @param pullNumber   The pull request number
 * @returns The diff of the latest commit
 */
export async function getLatestCommitDiff(
    owner: string,
    repo: string,
    pullNumber: number
): Promise<string> {
    try {
        const pr = await getPr(owner, repo, pullNumber);
        const baseSha = pr.base.sha;

        const commits = await getCommits(owner, repo, pullNumber);
        const latestCommitSha = commits?.[commits.length - 1]?.sha;

        return await getCommitDiff(owner, repo, baseSha, latestCommitSha);
    } catch (error) {
        core.setFailed((error as Error).message);
        throw error;
    }
}

/**
 *  Post a comment to a pull request
 * @param owner  The owner of the repository
 * @param repo  The repository name
 * @param pullNumber  The pull request number
 * @param body  The body of the comment
 * @param commit_id  The commit id  the comment is associated with
 * @param comment  The comment object
 */
export async function postComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    commit_id: string,
    comment: ReviewComment
): Promise<void> {
    // If path or start_line are missing/falsy, convert to a PR issue comment (event comment)
    const hasPath = !!comment?.meta?.path;
    const hasStartLine =
        comment?.meta?.start_line !== undefined && !!comment.meta.start_line;

    if (!hasPath || !hasStartLine) {
        // Post as a regular PR comment (issue comment) instead of a review comment
        await octokit.rest.issues.createComment({
            owner,
            repo,
            event: 'COMMENT',
            issue_number: pullNumber,
            body,
        });
        return;
    }

    // Try to fetch the file patch (diff hunk) for this file in the PR.
    let patch: string | null = null;
    try {
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: pullNumber,
        });
        const normalizedTarget = (comment.meta.path || "").replace(/\\/g, "/");
        const fileEntry = files.find(
            (f: any) => (f.filename || "").replace(/\\/g, "/") === normalizedTarget
        );
        patch = fileEntry?.patch || null;
    } catch (err) {
        core.warning(`Failed to fetch PR files for diff_hunk: ${(err as Error).message}`);
        patch = null;
    }

    if (!patch) {
        // If we couldn't find a patch for the file, fallback to posting a regular PR comment
        core.warning(`No patch/diff_hunk found for ${comment.meta.path}. Posting as a regular comment instead.`);
        await octokit.rest.issues.createComment({
            owner,
            repo,
            event: 'COMMENT',
            issue_number: pullNumber,
            body,
        });
        return;
    }

    const commentPayload: Partial<CommentPayload> = {
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: commit_id,
        path: comment.meta.path,
        line: comment.meta.line,
        side: comment.meta.side,
    };

    if (
        comment.meta.start_line !== undefined &&
        comment.meta.start_line < comment.meta.line
    ) {
        commentPayload.start_line = comment.meta.start_line;
        commentPayload.start_side = comment.meta.start_side || comment.meta.side;
    } else {
        commentPayload.start_line = comment.meta.line;
        commentPayload.start_side = comment.meta.side;
    }

    // attach the diff hunk (patch) we fetched
    (commentPayload as any).diff_hunk = patch;

    // Try to post the review comment; if GitHub validation fails, fallback to a normal PR comment
    try {
        await octokit.request(
            "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments",
            commentPayload as CommentPayload
        );
    } catch (error) {
        core.warning(`Failed to post review comment, falling back to issue comment: ${(error as Error).message}`);
        await octokit.rest.issues.createComment({
            owner,
            repo,
            event: 'COMMENT',
            issue_number: pullNumber,
            body,
        });
    }
}
