import { GoogleGenAI, Type } from "@google/genai";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "octokit";

type PushPayload = typeof github.context.payload;

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

  const { data: diff } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner,
      repo,
      pull_number: pullNumber,
      mediaType: { format: 'diff' },
    }
  );

  // Get commits in this PR
  const { data: commits } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
    {
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
        "Accepts": "application/vnd.github.full+json",
      },
    }
  );

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const prompt = `Review the following pull request and provide a detailed analysis including code changes and commit messages. Highlight any potential issues, improvements, or best practices that should be considered.

  Commits:
${commits.map((commit) => `- ${commit.commit.message}`).join("\n")}
Pull Request Diff: ${diff}
    `;

  console.log("Prompt for AI:", prompt);

  const config = {
    thinkingConfig: {
      thinkingBudget: 0, // 0 means disabled, -1 means dynamic thinking, positive value means max tokens
    },
    systemInstruction:
      "You are a senior software engineer. Provide a detail review of the following pull request, including code changes and commit messages. Highlight any potential issues, improvements, or best practices that should be considered.",
    temperature: 0.2,
    // tools: [
    //   {
    //     googleSearch: {},
    //   },
    //   { urlContext: {} },
    // ],
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: ["LOW 🔵", "MEDIUM 🟡", "HIGH 🟠", "CRITICAL 🔴", "LGTM ✅"],
          },
          summary: {
            type: Type.STRING,
          },
          keyChanges: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          checklist: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          issues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          improvements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          bestPractices: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
      propertyOrdering: ["category", "summary", "keyChanges", "checklist", "issues", "improvements", "bestPractices"],
    },
  };
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });
  console.log(response.text);
}

await main();
