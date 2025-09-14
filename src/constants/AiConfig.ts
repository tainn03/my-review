import { Type } from "@google/genai";

/**
 * Configuration for Gemini AI model
 */
export const geminiAiConfig = {
    systemInstruction:
        "You are a senior software engineer. Provide a detail review of the following pull request, including code changes and commit messages. Highlight any potential issues, improvements, or best practices that should be considered. Respond in Vietnamese.",
    temperature: 0.4,
    responseMimeType: "application/json",
    responseSchema: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                category: {
                    type: Type.STRING,
                    enum: ["SUGGESTION 🟦", "WARNING 🟨", "ERROR 🟥", "LGTM ✅"],
                    description: "The review category indicating the severity or approval level of the comment. 'LGTM ✅' indicates no changes needed, just use if everything looks good and no issues found.",
                },
                summary: {
                    type: Type.STRING,
                    description: "A short and concise summary of the review comment.",
                },
                issues: {
                    type: Type.STRING,
                    description: "A list of specific issues identified in the code. It should be concise and to the point. Add emoji ⚠️ in the first line of every issue.",
                },
                suggestions: {
                    type: Type.STRING,
                    description: "A list of suggested solutions or improvements for code. Add emoji 💡 in the first line of every suggestion.",
                },
                codeSnippet: {
                    type: Type.STRING,
                    description: "A code snippet related to the suggested solutions or improvements for code. Use before/after patterns if applicable.",
                },
                meta: {
                    type: Type.OBJECT,
                    properties: {
                        path: { type: Type.STRING },
                        start_line: { type: Type.NUMBER },
                        line: { type: Type.NUMBER },
                        start_side: { type: Type.STRING, enum: ["LEFT", "RIGHT"] },
                        side: { type: Type.STRING, enum: ["LEFT", "RIGHT"] },
                    },
                    required: ["path", "start_line", "line", "start_side", "side"]
                },
            },
            required: ["category", "summary", "issues", "suggestions", "meta"],
        },
    },
};