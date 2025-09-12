import * as core from "@actions/core";
import { Octokit } from "octokit";
import { GITHUB_API_COMMIT_URL, GITHUB_API_PR_URL } from "../constants/UrlConstant.js";

const ghToken = core.getInput("github_token", { required: true });

const octokit = new Octokit({
    auth: ghToken,
});

export async function getDiff(owner: string, repo: string, pullNumber: number) {
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

export async function getCommits(owner: string, repo: string, pullNumber: number) {
    return await octokit.request(
        "GET " + GITHUB_API_COMMIT_URL,
        {
            owner,
            repo,
            pull_number: pullNumber,
            headers: {
                "X-GitHub-Api-Version": "2022-11-28",
                "Accept": "application/vnd.github.full+json",
            },
        }
    );
}

export async function postApproveReviewComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    commitId: string
) {
    return await octokit.request(
        "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
        {
            owner,
            repo,
            pull_number: pullNumber,
            body,
            event: "APPROVE",
            headers: {
                "X-GitHub-Api-Version": "2022-11-28",
            },
        }
    );
}