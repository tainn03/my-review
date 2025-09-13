import * as core from "@actions/core";
import { generateCommentBody as buildCommentTemplate } from "./utils/ContentUtil.js";
import { getCommits, getLatestCommitDiff, postComment } from "./services/GithubService.js";
import { generateReviewCode } from "./services/GeminiAiService.js";

/**
 * Main entry point for the GitHub Action
 * @returns void
 */
async function main() {
  const owner = core.getInput("owner", { required: true });
  const repo = core.getInput("repo", { required: true });
  const pullNumber = parseInt(core.getInput("pull_number", { required: true }));

  core.info(`Fetching diff for PR #${pullNumber} in ${owner}/${repo}...`);
  const diff = await getLatestCommitDiff(owner, repo, pullNumber);

  if (!diff) {
    core.setFailed("No diff found for the specified pull request.");
    return;
  }

  core.info("Preparing prompt for AI...");

  core.info("AI running...");
  const comments = await generateReviewCode(diff);
  core.info(`Parsed ${comments.length} valid review comments.`);

  // Safeguard commit id
  core.info("Safeguarding commit ID...");
  const commitId = await getCommits(owner, repo, pullNumber).then((commits) => {
    return commits?.[commits.length - 1]?.sha || null;
  });
  if (!commitId) {
    core.setFailed("No commit SHA found for pull request.");
    return;
  }

  // Post each comment separately
  core.info("Posting review comments to GitHub...");
  for (const comment of comments) {
    let body = buildCommentTemplate(comment);
    core.info(`Posting comment on ${comment.meta.path}:${comment.meta.line} (${comment.category})`);
    try {
      await postComment(owner, repo, pullNumber, body, commitId, comment);
    } catch (error) {
      core.warning(`Failed to post comment: ${(error as Error).message}`);
    }
  }

  core.info("Review comments posted successfully");
}

await main();