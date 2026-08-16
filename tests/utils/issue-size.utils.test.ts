import { describe, expect, it } from "vitest";
import {
  GITHUB_ISSUE_BODY_MAX_LENGTH,
  GITHUB_ISSUE_TITLE_MAX_LENGTH,
  ISSUE_BODY_TRUNCATION_NOTICE,
  ISSUE_TITLE_TRUNCATION_SUFFIX,
  codePointLength,
  fitGithubIssueBody,
  fitGithubIssueTitle,
  truncateToCodePointLimit,
} from "../../src/utils/issue-size.utils.js";

describe("issue-size.utils", () => {
  describe("truncateToCodePointLimit", () => {
    it("returns the original text when it fits", () => {
      expect(truncateToCodePointLimit("hello", 5, "…")).toBe("hello");
    });

    it("appends the suffix and stays within the limit", () => {
      expect(truncateToCodePointLimit("hello world", 8, "…")).toBe("hello w…");
      expect(codePointLength(truncateToCodePointLimit("hello world", 8, "…"))).toBe(8);
    });

    it("counts emoji as one character", () => {
      expect(truncateToCodePointLimit("🚀🚀🚀", 2, "…")).toBe("🚀…");
    });

    it("uses only the suffix when the suffix is longer than the limit", () => {
      expect(truncateToCodePointLimit("hello", 3, "abcdef")).toBe("abc");
    });
  });

  describe("fitGithubIssueTitle", () => {
    it("leaves titles at the limit unchanged", () => {
      const title = "a".repeat(GITHUB_ISSUE_TITLE_MAX_LENGTH);
      expect(fitGithubIssueTitle(title)).toBe(title);
    });

    it("truncates titles over the limit", () => {
      const title = "a".repeat(GITHUB_ISSUE_TITLE_MAX_LENGTH + 1);
      const fitted = fitGithubIssueTitle(title);

      expect(fitted).toHaveLength(GITHUB_ISSUE_TITLE_MAX_LENGTH);
      expect(fitted.endsWith(ISSUE_TITLE_TRUNCATION_SUFFIX)).toBe(true);
      expect(fitted.startsWith("a".repeat(GITHUB_ISSUE_TITLE_MAX_LENGTH - 1))).toBe(true);
    });
  });

  describe("fitGithubIssueBody", () => {
    it("leaves bodies at the limit unchanged", () => {
      const body = "b".repeat(GITHUB_ISSUE_BODY_MAX_LENGTH);
      expect(fitGithubIssueBody(body)).toBe(body);
    });

    it("truncates bodies over the limit and appends a notice", () => {
      const body = "b".repeat(GITHUB_ISSUE_BODY_MAX_LENGTH + 50);
      const fitted = fitGithubIssueBody(body);

      expect(codePointLength(fitted)).toBe(GITHUB_ISSUE_BODY_MAX_LENGTH);
      expect(fitted.endsWith(ISSUE_BODY_TRUNCATION_NOTICE)).toBe(true);
      expect(fitted.startsWith("b")).toBe(true);
    });
  });
});
