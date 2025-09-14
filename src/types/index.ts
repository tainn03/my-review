export type ReviewComment = {
    category: "SUGGESTION 🔵" | "MINOR 🟡" | "MAJOR 🟠" | "CRITICAL 🔴" | "LGTM ✅";
    summary: string;
    issues: string;
    suggestions: string;
    codeSnippet?: string;
    meta: Meta;
};

export type Meta = {
    path: string;
    start_line: number;
    line: number;
    start_side: "LEFT" | "RIGHT";
    side: "LEFT" | "RIGHT";
};

export type CommentPayload = {
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
}