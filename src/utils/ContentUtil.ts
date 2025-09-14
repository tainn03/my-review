import type { ReviewComment } from "../types/index.js";

/**
 * Generate a pull request review prompt
 * @param diff The diff to generate review comments for
 * @returns  The prompt string
 */
export const generatePullRequestReview = (
    diff: string
) => `You are a senior engineer code reviewer.
Provide a detailed review of the following pull request, including code changes and commit messages. Highlight any potential issues, improvements, or best practices that should be considered.
Responded in Vietnamese and respond in JSON format with the following schema:
- category: One of "SUGGESTION 🟦", "WARNING 🟨", "ERROR 🟥", "LGTM ✅"
- summary: A detailed content of the review comment.
- issues: The specific issues identified in the code. It should be concise and to the point. Add emoji ⚠️ in the first line of every issue.
- suggestions: The suggested solutions or improvements for code. Add emoji 💡 in the first line of every suggestion.
- codeSnippet: A markdown-formatted suggested code related to the suggestions, if applicable. It should be concise and to the point.
- meta: An object containing metadata about the code review comment, including:
    - path: The file path of the code being reviewed.
    - line: The line number of the code being reviewed.
    - side: The side of the code being reviewed (LEFT or RIGHT).
    - start_line: The starting line number of the code being reviewed.
    - start_side: The starting side of the code being reviewed (LEFT or RIGHT).

If there are multiple comments, return an array of objects.
If everything is fine, return a single object with category "LGTM ✅".

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
> **${comment.category}**

<details>
<summary>📢 About</summary>

- Bot review code tự động sử dụng mô hình Gemini của Google.
- Nếu bạn không đồng ý với bất kỳ đề xuất nào, hãy chọn **Resolve conversation**.
- Thông tin chi tiết về bot có tại [my-review](https://github.com/tainn03/my-review).

> **🚀 Note:** Đây là bot review tự động. Vui lòng xác minh trước khi làm theo. Mọi thông tin mà AI phản hồi đều chỉ mang tính chất tham khảo.

</details>

### 📃 Summary

${comment.summary}
`;

    if (comment.category !== "LGTM ✅") {
        const issueCell = comment.issues ?? "---";
        const suggestionCell = comment.suggestions ?? "---";

        body += `
### 🛠️ Review Feedback

| Issue                           | Suggestion |
| ------------------------------- | ---------- |
| ${issueCell} | ${suggestionCell} |

---
`;
    }

    if (comment.codeSnippet) {
        body += `
### 🧱 Code Snippet
${comment.codeSnippet}
`;

    }
    return body;
};
