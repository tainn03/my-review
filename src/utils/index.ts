import type { ReviewComment } from "../types/index.js";

export const generatePullRequestReview = (
    diff: string
) => `You are a senior engineer code reviewer.
Your task is to review the following pull request and provide feedback in a structured JSON array format. Each comment should include a category, summary, and metadata about the file path and line number. If applicable, include a start_line for multi-line comments. Respond in Vietnamese, ensuring clarity and professionalism.

Categories:
1. "LGTM ✅" - Looks Good To Me, no changes needed.
2. "LOW 🔵" - Low priority changes, minor improvements.
3. "MEDIUM 🟡" - Medium priority changes, may require some effort.
4. "HIGH 🟠" - High priority changes, significant issues that must be addressed.
5. "CRITICAL 🔴" - Critical issues, immediate attention required.

Guidelines:
- Focus on correctness, security, performance, readability.
- If everything looks good, return one object with category "LGTM ✅".
- Use existing diff context; only reference lines that exist in the diff.
- For missing line info, default to path "src/index.ts" and line 1.
- For multi-line comments, ensure start_line < line.

Now analyze the following diff and provide your review:
${diff}
`;

export const generateCommentBody = (c: ReviewComment) => {
    let body = `
> My Review ✨

## 📝 Summary

${c.summary}

### 🛠️ Code Review Feedback

| Issue                           | Suggestion |
| ------------------------------- | ---------- |
| ${c.issues?.[0] ? `**${c.issues[0]}**` : ""} | ${c.suggestions?.[0] ?? ""} |
`;

    // Add additional issues/suggestions if present
    if ((c.issues?.length ?? 0) > 1 || (c.suggestions?.length ?? 0) > 1) {
        for (
            let i = 1;
            i < Math.max(c.issues?.length ?? 0, c.suggestions?.length ?? 0);
            i++
        ) {
            const issue = c.issues?.[i] ?? "";
            const solution = c.suggestions?.[i] ?? "";
            body += `| ${issue} | ${solution} |\n`;
        }
    }

    body += `

---

## 📢 Next Steps

- Address the issues above and push updates to this PR.
- If you disagree with any suggestions, let us know in a reply!
- Once all issues are resolved, we can proceed to merge the PR. 🎉

> **🎈Note:** This is an automated review. Please verify suggestions before applying. If you have questions, reply to this comment.
`;

    return body;
};
