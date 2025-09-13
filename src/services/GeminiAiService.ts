import * as core from "@actions/core";
import { GoogleGenAI } from "@google/genai";
import { geminiAiConfig } from "../constants/AiConfig.js";
import { tryParseArray } from "../utils/JsonUtil.js";
import type { ReviewComment } from "../types/index.js";
import { generatePullRequestReview as generateCodeReviewFeedbackPrompt } from "../utils/ContentUtil.js";

const geminiKey = core.getInput("gemini_api_key", { required: true });
const model = core.getInput("model", { required: true });

const ai = new GoogleGenAI({ apiKey: geminiKey });

/**
 *  Generate content using Gemini AI
 * 
 * @param contents  The prompt contents
 * @returns  The generated content
 */
export async function generateContent(contents: string) {
    const response = await ai.models.generateContent({
        model,
        contents,
        config: geminiAiConfig,
    });
    return response.text ?? "";
}

/**
 * Generate review comments for a code diff
 * @param diff The diff to generate review comments for
 * @returns A list of review comments
 */
export async function generateReviewCode(diff: string): Promise<ReviewComment[]> {
    const prompt = generateCodeReviewFeedbackPrompt(diff);

    let aiResponseText = "";
    try {
        aiResponseText = await generateContent(prompt);
    } catch (err) {
        core.warning(`Model generation failed: ${(err as Error).message}`);
        return [];
    }

    // Parse using tolerant strategy
    const validComments = tryParseArray<ReviewComment>(aiResponseText);
    if (validComments.length === 0) {
        core.setFailed("AI did not return any valid review comments.");
        return [];
    }

    return validComments;
}