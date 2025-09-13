import { GoogleGenAI, Type } from "@google/genai";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "octokit";
import { generateCommentBody, generatePullRequestReview } from "./utils/index.js";
import type { CommentPayload, ReviewComment } from "./types/index.js";
import { geminiAiConfig } from "./constants/AiConfig.js";
import { getCommits, getDiffJson, getLatestCommitDiff } from "./services/GithubService.js";

async function main() {
  const ghToken = core.getInput("github_token", { required: true });
  const geminiKey = core.getInput("gemini_api_key", { required: true });
  const model = core.getInput("model", { required: true });
  const owner = core.getInput("owner", { required: true });
  const repo = core.getInput("repo", { required: true });
  const pullNumber = parseInt(core.getInput("pull_number", { required: true }));

  const octokit = new Octokit({
    auth: ghToken,
  });

  core.info(`Fetching diff for PR #${pullNumber} in ${owner}/${repo}...`);
  const diff = await getLatestCommitDiff(owner, repo, pullNumber);

  if (!diff) {
    core.setFailed("No diff found for the specified pull request.");
    return;
  }

  // Prepare prompt for AI
  core.info("Preparing prompt for AI...");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const prompt = generatePullRequestReview(diff);

  core.info("AI running...");
  let rawModelText = "";
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: geminiAiConfig,
    });
    rawModelText = response.text ?? "";
  } catch (err) {
    core.warning(`Model generation failed: ${(err as Error).message}`);
    return;
  }

  // Parse using tolerant strategy
  const validComments = tryParseArray<ReviewComment>(rawModelText);
  if (validComments.length === 0) {
    core.setFailed("AI did not return any valid review comments.");
    return;
  }

  core.info(`Parsed ${validComments.length} valid review comments.`);

  // Safeguard commit id
  core.info("Safeguarding commit ID...");
  const commitId = await getCommits(owner, repo, pullNumber).then((data) => {
    const commits = data.data;
    return commits?.[commits.length - 1]?.sha;
  });
  if (!commitId) {
    core.setFailed("No commit SHA found for pull request.");
    return;
  }

  // Post each comment separately
  core.info("Posting review comments to GitHub...");
  const reviewUrls: string[] = [];
  for (const c of validComments) {
    let body = generateCommentBody(c);

    try {
      const commentPayload: Partial<CommentPayload> = {
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: commitId,
        path: c.meta.path,
        line: c.meta.line,
        side: c.meta.side,
      };

      if (c.meta.start_line !== undefined && c.meta.start_line < c.meta.line) {
        commentPayload.start_line = c.meta.start_line;
        commentPayload.start_side = c.meta.start_side || c.meta.side;
      }

      const result = await octokit.request(
        "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        commentPayload as CommentPayload
      );
      reviewUrls.push(result.data.html_url);

    } catch (error) {
      core.warning(`Failed to post comment: ${(error as Error).message}`);
    }
  }

  core.info("Review comments posted: " + reviewUrls.join(", "));
  core.setOutput("review_urls", reviewUrls.join(", "));
}

function stripCodeFences(s: string) {
  return s
    .replace(/```json/gi, "```")
    .replace(/```ts/gi, "```")
    .replace(/```javascript/gi, "```")
    .replace(/```/g, "")
    .trim();
}

function firstJsonArraySlice(s: string): string | null {
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}

function tryParseArray<T = unknown>(raw: string): T[] {
  const attempts: string[] = [];
  attempts.push(raw);
  attempts.push(stripCodeFences(raw));
  const slice = firstJsonArraySlice(raw);
  if (slice) attempts.push(slice);
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      /* continue */
    }
  }
  return [];
}

await main();