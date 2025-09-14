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
    }

    try {
        await octokit.request(
            "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments",
            commentPayload as CommentPayload
        );
    } catch (error) {
        core.warning((error as Error).message);
        await octokit.rest.pulls.createReview({
            owner,
            repo,
            pull_number: pullNumber,
            event: 'COMMENT',
            body,
        });
    }
}
