import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalInputs, Environment } from "../../src/types/index.js";

// Import without mocking - use real implementation
const { ContentService } = await import("../../src/services/content.service.js");

describe("ContentService", () => {
  let contentService: InstanceType<typeof ContentService>;
  let mockInputs: ApprovalInputs;
  let mockEnvironment: Environment;

  beforeEach(() => {
    mockInputs = {
      timeoutSeconds: 300,
      approvalKeywords: ["approved!", "lgtm"],
      rejectionKeywords: ["reject!", "denied"],
      failOnRejection: true,
      failOnTimeout: true,
      issueTitle: "",
      issueBody: "",
      pollIntervalSeconds: 3,
    };

    mockEnvironment = {
      owner: "test-owner",
      repo: "test-repo",
      workflowName: "Test Workflow",
      jobName: "test-job",
      runId: 12345,
      actionId: "test-action",
      actor: "test-actor",
      eventName: "push",
    };

    contentService = new ContentService(mockInputs, mockEnvironment);
  });

  describe("getTitle", () => {
    it("should return custom title when provided", async () => {
      mockInputs.issueTitle = "Custom Approval Title";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getTitle();

      expect(result).toBe("Custom Approval Title");
    });

    it("should return default title when no custom title provided", async () => {
      mockInputs.issueTitle = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getTitle();

      expect(result).toBe("Approval Request: Test Workflow/test-job/test-action");
    });
  });

  describe("getBody", () => {
    it("should return custom body when provided and process templates", async () => {
      mockInputs.issueBody = "Custom body with {{ timeout-seconds }} timeout and actor {{ actor }}";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toBe("Custom body with 300 timeout and actor test-actor");
    });

    it("should use default body when no custom body provided", async () => {
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("**Manual approval required:**");
      expect(result).toContain("Test Workflow");
      expect(result).toContain("test-job");
      expect(result).toContain("test-action");
    });

    it("should process template variables correctly", async () => {
      mockInputs.issueBody =
        "Workflow: {{ workflow-name }}, Job: {{ job-id }}, Action: {{ action-id }}";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toBe("Workflow: Test Workflow, Job: test-job, Action: test-action");
    });

    it("should handle array variables in templates", async () => {
      mockInputs.issueBody =
        "Approval keywords: {{ approval-keywords }}, Rejection keywords: {{ rejection-keywords }}";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toBe(
        "Approval keywords: approved!, lgtm, Rejection keywords: reject!, denied",
      );
    });
  });

  describe("getDefaultIssueBody", () => {
    it("should generate complete default body with all links", async () => {
      mockInputs.issueBody = ""; // Force default body
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("**Manual approval required:**");
      expect(result).toContain("`Test Workflow`/`test-job`/`test-action`");
      expect(result).toContain("https://github.com/test-owner/test-repo/actions/runs/12345");
      expect(result).toContain("To approve, comment with `approved!, lgtm`");
      expect(result).toContain(
        "To reject, comment with `reject!, denied` or simply close the issue!",
      );
      expect(result).toContain("This request will timeout in 300 seconds.");
    });

    it("should handle empty approval keywords", async () => {
      mockInputs.approvalKeywords = [];
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("To approve, comment with `approved!`"); // Fallback value
    });

    it("should handle empty rejection keywords", async () => {
      mockInputs.rejectionKeywords = [];
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("To reject, simply close the issue!");
      expect(result).not.toContain("comment with `` or"); // Should not have empty rejection text
    });

    it("should handle missing URLs gracefully", async () => {
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      // Should still generate the run URL from environment data
      expect(result).toContain("https://github.com/test-owner/test-repo/actions/runs/12345");
    });

    it("should handle single approval and rejection keywords", async () => {
      mockInputs.approvalKeywords = ["approve"];
      mockInputs.rejectionKeywords = ["deny"];
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("To approve, comment with `approve`");
      expect(result).toContain("To reject, comment with `deny` or simply close the issue!");
    });

    it("should format timeout correctly", async () => {
      mockInputs.timeoutSeconds = 1800; // 30 minutes
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("This request will timeout in 1800 seconds.");
    });
  });

  describe("integration scenarios", () => {
    it("should work with real template processing for custom body", async () => {
      mockInputs.issueBody = "Timeout: {{ timeout-seconds }}s, Actor: {{ actor }}";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("Timeout: 300s");
      expect(result).toContain("Actor: test-actor");
    });

    it("should handle complex approval/rejection keyword arrays", async () => {
      mockInputs.approvalKeywords = ["approved", "lgtm", "✅", "ship it"];
      mockInputs.rejectionKeywords = ["rejected", "nope", "❌", "block"];
      mockInputs.issueBody = "";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain("To approve, comment with `approved, lgtm, ✅, ship it`");
      expect(result).toContain(
        "To reject, comment with `rejected, nope, ❌, block` or simply close the issue!",
      );
    });

    it("should handle GitHub context variables in custom templates", async () => {
      mockInputs.issueBody = "Repository: ${{ github.repository }}, Actor: ${{ github.actor }}";

      // Set up environment variables for GitHub context
      process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
      process.env.GITHUB_ACTOR = "test-actor";

      contentService = new ContentService(mockInputs, mockEnvironment);
      const result = await contentService.getBody();

      expect(result).toContain("Repository: test-owner/test-repo");
      expect(result).toContain("Actor: test-actor");

      // Clean up
      delete process.env.GITHUB_REPOSITORY;
      delete process.env.GITHUB_ACTOR;
    });

    it("should process run-url template variable in custom body", async () => {
      mockInputs.issueBody =
        "Please review: {{ run-url }} and approve with {{ approval-keywords }}";
      contentService = new ContentService(mockInputs, mockEnvironment);

      const result = await contentService.getBody();

      expect(result).toContain(
        "Please review: https://github.com/test-owner/test-repo/actions/runs/12345",
      );
      expect(result).toContain("and approve with approved!, lgtm");
    });

    it("should combine template variables and GitHub context in default body", async () => {
      mockInputs.issueBody = ""; // Use default body
      mockInputs.timeoutSeconds = 600;

      contentService = new ContentService(mockInputs, mockEnvironment);
      const result = await contentService.getBody();

      // Should process the template variables in the default body
      expect(result).toContain("This request will timeout in 600 seconds.");
      expect(result).toContain("Test Workflow");
      expect(result).toContain("test-job");
      expect(result).toContain("test-action");
    });
  });
});
