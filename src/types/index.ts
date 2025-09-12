export type ReviewComment = {
    category: "LOW 🔵" | "MEDIUM 🟡" | "HIGH 🟠" | "CRITICAL 🔴" | "LGTM ✅";
    summary: string;
    issues: string[];
    solutions: string[];
    meta: Meta;
};

export type Meta = {
    path: string;
    start_line?: number;
    line: number;
    start_side?: "LEFT" | "RIGHT";
    side: "LEFT" | "RIGHT";
};