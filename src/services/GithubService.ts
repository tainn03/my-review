import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "octokit";
import { GITHUB_API_COMMIT_URL, GITHUB_API_PR_URL } from "../constants/UrlConstant.js";

const ghToken = core.getInput("github_token", { required: true });

const octokit = new Octokit({
    auth: ghToken,
});

export async function getDiffRaw(owner: string, repo: string, pullNumber: number): Promise<any> {
    return await octokit.request(
        "GET " + GITHUB_API_PR_URL,
        {
            owner,
            repo,
            pull_number: pullNumber,
            mediaType: { format: 'diff' },
        }
    );
}

export async function getDiffJson(owner: string, repo: string, pullNumber: number): Promise<any> {
    return await octokit.request(
        "GET " + GITHUB_API_PR_URL,
        {
            owner,
            repo,
            pull_number: pullNumber,
            // mediaType: { format: 'diff' },
        }
    );
}

export async function getCommits(owner: string, repo: string, pullNumber: number): Promise<any> {
    return await octokit.request(
        "GET " + GITHUB_API_COMMIT_URL,
        {
            owner,
            repo,
            pull_number: pullNumber,
        }
    );
}

export async function getLatestCommitDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    try {
        if (!pullNumber) {
            throw new Error('No pull request number found.');
        }

        // Bước 1: Lấy base SHA từ PR
        const { data: pr } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
        });
        const baseSha = pr.base.sha;

        // Bước 2: Lấy commit mới nhất
        const { data: commits } = await octokit.rest.pulls.listCommits({
            owner,
            repo,
            pull_number: pullNumber,
        });
        const latestCommitSha = commits?.[commits.length - 1]?.sha;

        // Bước 3: Lấy diff
        const { data: diff } = await octokit.rest.repos.compareCommits({
            owner,
            repo,
            base: baseSha,
            head: latestCommitSha!,
            mediaType: { format: 'diff' },
        });

        return diff as unknown as string;
    } catch (error) {
        core.setFailed((error as Error).message);
        throw error;
    }
}