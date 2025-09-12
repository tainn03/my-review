import { Type } from "@google/genai";

export const geminiAiConfig = {
    thinkingConfig: {
        thinkingBudget: 0,
    },
    systemInstruction:
        "You are a senior software engineer. Provide a detail review of the following pull request, including code changes and commit messages. Highlight any potential issues, improvements, or best practices that should be considered.",
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                category: {
                    type: Type.STRING,
                    enum: ["LOW 🔵", "MEDIUM 🟡", "HIGH 🟠", "CRITICAL 🔴", "LGTM ✅"],
                    "description": "The review category indicating the severity or approval level of the comment. 'LGTM ✅' indicates no changes needed, just use if everything looks good and no issues found.",
                },
                summary: {
                    type: Type.STRING,
                    "description": "A detailed summary of the review comment.",
                },
                issues: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    "description": "A list of specific issues identified in the code.",
                },
                solutions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    "description": "A list of suggested solutions or improvements for the code. Return code snippets if applicable.",
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
            required: ["category", "summary", "issues", "solutions", "meta"],
        },
    },
};