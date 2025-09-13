/**
 * Remove code fences from a string
 * @param s The string to process
 * @returns The processed string without code fences
 */
export function stripCodeFences(s: string) {
    return s
        .replace(/```json/gi, "```")
        .replace(/```ts/gi, "```")
        .replace(/```javascript/gi, "```")
        .replace(/```/g, "")
        .trim();
}

/**
 * Generate a JSON array slice from a string
 * @param s The string to process
 * @returns The first JSON array slice found in the string, or null if none found
 */
export function firstJsonArraySlice(s: string): string | null {
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) return null;
    return s.slice(start, end + 1);
}

/**
 * Try to parse a JSON array from a string
 * @param raw The raw string to parse
 * @returns The parsed JSON array, or an empty array if parsing failed
 */
export function tryParseArray<T = unknown>(raw: string): T[] {
    const attempts: string[] = [];
    attempts.push(raw);
    attempts.push(stripCodeFences(raw));
    const slice = firstJsonArraySlice(raw);
    if (slice) attempts.push(slice);
    for (const candidate of attempts) {
        try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) return parsed as T[];
        } catch {
            /* continue */
        }
    }
    return [];
}