/** GitHub issue title limit (`title is too long (maximum is 256 characters)`). */
export const GITHUB_ISSUE_TITLE_MAX_LENGTH = 256;

/** GitHub issue body limit (`body is too long (maximum is 65536 characters)`). */
export const GITHUB_ISSUE_BODY_MAX_LENGTH = 65536;

export const ISSUE_TITLE_TRUNCATION_SUFFIX = "…";

export const ISSUE_BODY_TRUNCATION_NOTICE =
  "\n\n… (truncated to GitHub's 65536-character issue body limit)";

export function codePointLength(text: string): number {
  return [...text].length;
}

export function truncateToCodePointLimit(text: string, maxLength: number, suffix: string): string {
  const chars = [...text];
  if (chars.length <= maxLength) {
    return text;
  }

  const suffixChars = [...suffix];
  if (suffixChars.length >= maxLength) {
    return suffixChars.slice(0, maxLength).join("");
  }

  return chars.slice(0, maxLength - suffixChars.length).join("") + suffix;
}

export function fitGithubIssueTitle(title: string): string {
  return truncateToCodePointLimit(
    title,
    GITHUB_ISSUE_TITLE_MAX_LENGTH,
    ISSUE_TITLE_TRUNCATION_SUFFIX,
  );
}

export function fitGithubIssueBody(body: string): string {
  return truncateToCodePointLimit(body, GITHUB_ISSUE_BODY_MAX_LENGTH, ISSUE_BODY_TRUNCATION_NOTICE);
}
