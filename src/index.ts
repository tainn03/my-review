import { GoogleGenAI, Type } from "@google/genai";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "octokit";
import { generatePullRequestReview } from "./utils/prompt.js";
import type { ReviewComment } from "./types/index.js";
import { geminiAiConfig } from "./constants/AiConfig.js";
import { getCommits, getDiff } from "./services/GithubService.js";

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

  const { data: diff } = await getDiff(owner, repo, pullNumber);
  core.info("Fetched PR diff, length: " + (diff ? diff.length : 0));

  if (!diff) {
    core.setFailed("No diff found for the specified pull request.");
    return;
  }

  // Fetch commits for context
  core.info("Fetching commits for PR #" + pullNumber + "...");

  const { data: commits } = await getCommits(owner, repo, pullNumber);
  core.info("Fetched PR commits, count: " + (commits ? commits.length : 0));

  if (!commits) {
    core.setFailed("No commits found for the specified pull request.");
    return;
  }
  core.info(`Using model: ${model}`);

  // Prepare prompt for AI
  core.info("Preparing prompt for AI...");
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const prompt = generatePullRequestReview(commits, diff);

  core.info("Prompt for AI: " + prompt);

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
    rawModelText = "";
  }
  core.info("Raw model output: " + rawModelText);

  // Parse using tolerant strategy
  core.info("Parsing model output...");
  const parsedArray = tryParseArray<ReviewComment>(rawModelText);
  let validComments: ReviewComment[] = parsedArray.filter((c) => {
    return (
      c &&
      typeof c.category === "string" &&
      typeof c.summary === "string" &&
      c.meta &&
      typeof c.meta.path === "string" &&
      typeof c.meta.line === "number" &&
      (typeof c.meta.start_line !== "number" || c.meta.start_line < c.meta.line)
    );
  });

  if (validComments.length === 0) {
    validComments.push({
      category: "LOW 🔵",
      summary: "AI produced no valid structured review output.",
      issues: [],
      solutions: ["Ensure the model returns strict JSON."],
      meta: {
        path: "src/index.ts",
        line: 1,
        side: "RIGHT",
      },
    });
  }
  core.info(`Parsed ${validComments.length} valid review comments.`);
  core.info("Valid comments: " + JSON.stringify(validComments, null, 2));

  // Safeguard commit id
  core.info("Safeguarding commit ID...");
  const commitId = commits[commits.length - 1]?.sha;
  if (!commitId) {
    core.setFailed("No commit SHA found for pull request.");
    return;
  }

  // Post each comment separately
  core.info("Posting review comments to GitHub...");
  const reviewUrls: string[] = [];
  for (const c of validComments) {
    let body =
      `> **Category:** ${c.category}\n\n` +
      `## Summary\n\n` +
      `${c.summary}\n\n`;

    if (c.issues?.length || c.solutions?.length) {
      body += `| Issues | Solutions |\n| --- | --- |\n`;
      const maxLen = Math.max(c.issues?.length ?? 0, c.solutions?.length ?? 0);
      for (let i = 0; i < maxLen; i++) {
        const issue = c.issues?.[i] ?? "";
        const solution = c.solutions?.[i] ?? "";
        body += `| ${issue} | ${solution} |\n`;
      }
      body += "\n";
    }

    try {
      if (c.category === "LGTM ✅") {
        // Post as overall review approve
        const result = await octokit.request(
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
        reviewUrls.push(result.data.html_url);
      } else {
        // Post line-specific comment
        const commentPayload: {
          owner: string;
          repo: string;
          pull_number: number;
          body: string;
          commit_id: string;
          path: string;
          line: number;
          side: "LEFT" | "RIGHT";
          start_line?: number;
          start_side?: "LEFT" | "RIGHT";
          headers: { "X-GitHub-Api-Version": string };
        } = {
          owner,
          repo,
          pull_number: pullNumber,
          body,
          commit_id: commitId,
          path: c.meta.path || "src/index.ts",
          line: c.meta.line ?? 1,
          side: (c.meta.side === "LEFT" ? "LEFT" : "RIGHT") as "LEFT" | "RIGHT",
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        };

        // Only include start_line and start_side for multi-line comments
        if (c.meta.start_line !== undefined && c.meta.start_line < c.meta.line) {
          commentPayload.start_line = c.meta.start_line;
          commentPayload.start_side = (c.meta.start_side === "LEFT" ? "LEFT" : "RIGHT") as "LEFT" | "RIGHT";
        }

        const result = await octokit.request(
          "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments",
          commentPayload
        );
        reviewUrls.push(result.data.html_url);
      }
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