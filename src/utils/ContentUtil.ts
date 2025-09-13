import type { ReviewComment } from "../types/index.js";

/**
 * Generate a pull request review prompt
 * @param diff The diff to generate review comments for
 * @returns  The prompt string
 */
export const generatePullRequestReview = (
    diff: string
) => `You are a senior engineer code reviewer.
Return ONLY a valid JSON array (no markdown, no backticks, no explanations).
Each element must follow:
{
  "category": "SUGGESTION 🔵" | "MINOR 🟡" | "MAJOR 🟠" | "CRITICAL 🔴" | "LGTM ✅",
  "summary": string,
  "issues": string[],
  "suggestions": string[],
  "meta": {
     "path": string,
     "line": number,
     "side": "LEFT" | "RIGHT",
     "start_line": number,
     "start_side": "LEFT" | "RIGHT"
  }
}

If everything is fine, return a single object with category "LGTM ✅".
Use only file paths & line numbers present in the diff. Default fallback: path "src/index.ts", line 1.

Now review this diff:
${diff}
`;

/**
 * Generate the body of a review comment
 * @param comment The review comment
 * @returns The formatted comment body
 */
export const generateCommentBody = (comment: ReviewComment) => {
    let body = `
> Level: **${comment.category}**

## 📝 Summary

${comment.summary}
`;

    if (comment.category !== "LGTM ✅") {
        body += `
### 🛠️ Code Review Feedback

| Issue                           | Suggestion |
| ------------------------------- | ---------- |
| ${comment.issues?.[0] ? `**${comment.issues[0]}**` : ""} | ${comment.suggestions?.[0] ?? ""} |
`;

        // Add additional issues/suggestions if present
        if ((comment.issues?.length ?? 0) > 1 || (comment.suggestions?.length ?? 0) > 1) {
            for (
                let i = 1;
                i < Math.max(comment.issues?.length ?? 0, comment.suggestions?.length ?? 0);
                i++
            ) {
                const issue = comment.issues?.[i] ?? "";
                const solution = comment.suggestions?.[i] ?? "";
                body += `| ${issue} | ${solution} |\n`;
            }
        }

        body += `

---

## 📢 Next Steps

- Giải quyết các vấn đề được nêu trên và push lên nhánh của bạn.
- Nếu bạn không đồng ý với bất kỳ đề xuất nào, hãy reply vào comment này.
- Khi tất cả các vấn đề được giải quyết, chúng ta có thể tiến hành merge PR. 🎉

> **🎈Lưu ý:** Đây là bot review tự động. Vui lòng xác minh trước khi làm theo. Mọi thông tin mà AI phản hồi đều chỉ mang tính chất tham khảo.
`;
    }

    return body;
};
