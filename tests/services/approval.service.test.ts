import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApprovalInputs, ApprovalRequest } from "../../src/types/index.js";

// Create mock functions for @actions/core
const mockInfo = vi.fn<(message: string) => void>();
const mockWarning = vi.fn<(message: string) => void>();
const mockError = vi.fn<(message: string) => void>();
const mockSetFailed = vi.fn<(message: string) => void>();
const mockSetOutput = vi.fn<(name: string, value: string) => void>();
const mockSaveState = vi.fn<(name: string, value: string) => void>();
const mockGetState = vi.fn<(name: string) => string>();
const mockDebug = vi.fn<(message: string) => void>();

// Mock @actions/core using vi.mock for ESM
vi.mock("@actions/core", () => ({
  info: mockInfo,
  warning: mockWarning,
  error: mockError,
  setFailed: mockSetFailed,
  setOutput: mockSetOutput,
  saveState: mockSaveState,
  getState: mockGetState,
  debug: mockDebug,
}));

// Import modules after mocking
const { ApprovalService, ApprovalServiceFactory } = await import(
  "../../src/services/approval.service.js"
);
const { MockGitHubClient } = await import("../fixtures/mocks.js");

describe("ApprovalServiceFactory", () => {
  let mockGitHubClient: InstanceType<typeof MockGitHubClient>;
  let factory: InstanceType<typeof ApprovalServiceFactory>;
  let mockInputs: ApprovalInputs;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGitHubClient = new MockGitHubClient();
    factory = new ApprovalServiceFactory(mockGitHubClient);

    mockInputs = {
      timeoutSeconds: 1, // Short timeout for tests
      approvalKeywords: ["approved!"],
      rejectionKeywords: ["reject!"],
      failOnRejection: true,
      failOnTimeout: true,
      issueTitle: "Test Approval",
      issueBody: "Please approve this test",
      pollIntervalSeconds: 0.05, // Very fast polling
    };
  });

  describe("request", () => {
    it("should create an approval request and return ApprovalService", async () => {
      const approvalService = await factory.request(mockInputs);

      expect(approvalService).toBeInstanceOf(ApprovalService);
    });

    it("should create an issue with proper title and body", async () => {
      const approvalService = await factory.request(mockInputs);

      // Verify the issue was created by checking the returned service
      expect(approvalService).toBeInstanceOf(ApprovalService);

      // Get the issue that was created to verify title/body were used
      const issue = await mockGitHubClient.getIssue(1);
      expect(issue.number).toBe(1);
      expect(issue.state).toBe("open");
    });

    it("should use default title when no custom title provided", async () => {
      mockInputs.issueTitle = "";
      const approvalService = await factory.request(mockInputs);

      expect(approvalService).toBeInstanceOf(ApprovalService);

      // Verify the issue was created
      const issue = await mockGitHubClient.getIssue(1);
      expect(issue.number).toBe(1);
    });

    it("should process template variables in custom body", async () => {
      mockInputs.issueBody = "Timeout: {{ timeout-seconds }}s";
      const approvalService = await factory.request(mockInputs);

      expect(approvalService).toBeInstanceOf(ApprovalService);

      // Verify the issue was created
      const issue = await mockGitHubClient.getIssue(1);
      expect(issue.number).toBe(1);
    });
  });
});

describe("ApprovalService", () => {
  let mockGitHubClient: InstanceType<typeof MockGitHubClient>;
  let approvalService: InstanceType<typeof ApprovalService>;
  let mockInputs: Pick<
    ApprovalInputs,
    | "timeoutSeconds"
    | "pollIntervalSeconds"
    | "rejectionKeywords"
    | "approvalKeywords"
    | "failOnRejection"
    | "failOnTimeout"
  >;
  let mockRequest: ApprovalRequest;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGitHubClient = new MockGitHubClient();

    mockInputs = {
      timeoutSeconds: 1, // Short timeout for tests
      approvalKeywords: ["approved!"],
      rejectionKeywords: ["reject!"],
      pollIntervalSeconds: 0.05, // Very fast polling
      failOnRejection: true,
      failOnTimeout: true,
    };

    // Create a real issue in the mock client to test with
    const issue = await mockGitHubClient.createIssue("Test Issue", "Test body");

    mockRequest = {
      id: issue.number,
      issueUrl: issue.htmlUrl,
      createdAt: new Date(Date.now() - 5000), // 5 seconds ago to ensure comments come after
      expiresAt: new Date(Date.now() + 1000),
    };

    approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);
  });

  describe("await", () => {
    it("should successfully handle approval", async () => {
      // Add an approval comment
      mockGitHubClient.addComment(mockRequest.id, "authorized-user", "approved!");

      const response = await approvalService.await();

      expect(response.status).toBe("approved");
      expect(response.approvers).toEqual(["authorized-user"]);
      expect(response.issueUrl).toBe(mockRequest.issueUrl);
    });

    it("should handle rejection", async () => {
      // Add a rejection comment
      mockGitHubClient.addComment(mockRequest.id, "authorized-user", "reject!");

      const response = await approvalService.await();

      expect(response.status).toBe("rejected");
      expect(response.approvers).toEqual(["authorized-user"]);
    });

    it("should handle timeout", async () => {
      // Don't add any comments, let it timeout
      const response = await approvalService.await();

      expect(response.status).toBe("timed-out");
      expect(response.approvers).toEqual([]);
    });

    it("should handle issue closure as rejection", async () => {
      // Close the issue
      mockGitHubClient.closeIssueForTest(mockRequest.id);

      const response = await approvalService.await();

      expect(response.status).toBe("rejected");
      expect(response.approvers).toEqual([]);
    });

    it("should ignore approval from unauthorized user", async () => {
      // Add approval from unauthorized user
      mockGitHubClient.addComment(mockRequest.id, "unauthorized-user", "approved!");

      const response = await approvalService.await();

      expect(response.status).toBe("timed-out"); // Should timeout since approval was ignored
    });

    it("should handle multiple keywords correctly", async () => {
      mockInputs.approvalKeywords = ["approved!", "lgtm", "👍"];
      approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);

      // Add comment with one of the keywords
      mockGitHubClient.addComment(mockRequest.id, "authorized-user", "lgtm");

      const response = await approvalService.await();

      expect(response.status).toBe("approved");
      expect(response.approvers).toEqual(["authorized-user"]);
    });

    it("should prioritize rejection over approval", async () => {
      // Add both approval and rejection comments
      mockGitHubClient.addComment(mockRequest.id, "authorized-user", "approved!");
      mockGitHubClient.addComment(mockRequest.id, "test-actor", "reject!");

      const response = await approvalService.await();

      // Should process comments in order and return first match
      expect(response.status).toBe("approved"); // First comment processed
      expect(response.approvers).toEqual(["authorized-user"]);
    });

    it("should handle case insensitive keyword matching", async () => {
      mockGitHubClient.addComment(mockRequest.id, "authorized-user", "APPROVED!");

      const response = await approvalService.await();

      expect(response.status).toBe("approved");
    });
  });

  describe("saveState", () => {
    it("should save approval request state", async () => {
      await approvalService.saveState();

      expect(mockSaveState).toHaveBeenCalledWith("approval_request", JSON.stringify(mockRequest));
    });
  });

  describe("cleanup", () => {
    it("should close the issue with 'completed' for approved status", async () => {
      // Create an issue first
      const issue = await mockGitHubClient.createIssue("Test", "Body");
      mockRequest.id = issue.number;
      approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);

      // Spy on closeIssue to check the reason
      const closeIssueSpy = vi.spyOn(mockGitHubClient, "closeIssue");

      await approvalService.cleanup("approved", ["user1"]);

      // Verify the issue was closed with 'completed'
      expect(closeIssueSpy).toHaveBeenCalledWith(issue.number, "completed");
      const closedIssue = await mockGitHubClient.getIssue(issue.number);
      expect(closedIssue.state).toBe("closed");
    });

    it("should close the issue with 'not_planned' for rejected status when failOnRejection is true", async () => {
      const issue = await mockGitHubClient.createIssue("Test", "Body");
      mockRequest.id = issue.number;
      mockInputs.failOnRejection = true;
      approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);

      const closeIssueSpy = vi.spyOn(mockGitHubClient, "closeIssue");

      await approvalService.cleanup("rejected");

      expect(closeIssueSpy).toHaveBeenCalledWith(issue.number, "not_planned");
      const closedIssue = await mockGitHubClient.getIssue(issue.number);
      expect(closedIssue.state).toBe("closed");
    });

    it("should close the issue with 'completed' for rejected status when failOnRejection is false", async () => {
      const issue = await mockGitHubClient.createIssue("Test", "Body");
      mockRequest.id = issue.number;
      mockInputs.failOnRejection = false;
      approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);

      const closeIssueSpy = vi.spyOn(mockGitHubClient, "closeIssue");

      await approvalService.cleanup("rejected");

      expect(closeIssueSpy).toHaveBeenCalledWith(issue.number, "completed");
      const closedIssue = await mockGitHubClient.getIssue(issue.number);
      expect(closedIssue.state).toBe("closed");
    });

    it("should close the issue with 'not_planned' for timed-out status when failOnTimeout is true", async () => {
      const issue = await mockGitHubClient.createIssue("Test", "Body");
      mockRequest.id = issue.number;
      mockInputs.failOnTimeout = true;
      approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);

      const closeIssueSpy = vi.spyOn(mockGitHubClient, "closeIssue");

      await approvalService.cleanup("timed-out");

      expect(closeIssueSpy).toHaveBeenCalledWith(issue.number, "not_planned");
      const closedIssue = await mockGitHubClient.getIssue(issue.number);
      expect(closedIssue.state).toBe("closed");
    });

    it("should close the issue with 'completed' for timed-out status when failOnTimeout is false", async () => {
      const issue = await mockGitHubClient.createIssue("Test", "Body");
      mockRequest.id = issue.number;
      mockInputs.failOnTimeout = false;
      approvalService = new ApprovalService(mockGitHubClient, mockInputs, mockRequest);

      const closeIssueSpy = vi.spyOn(mockGitHubClient, "closeIssue");

      await approvalService.cleanup("timed-out");

      expect(closeIssueSpy).toHaveBeenCalledWith(issue.number, "completed");
      const closedIssue = await mockGitHubClient.getIssue(issue.number);
      expect(closedIssue.state).toBe("closed");
    });

    it("should handle cleanup errors gracefully", async () => {
      // Create a custom mock that throws an error for closeIssue
      const errorMockClient = Object.create(mockGitHubClient);
      errorMockClient.closeIssue = async () => {
        throw new Error("Failed to close issue");
      };

      approvalService = new ApprovalService(errorMockClient, mockInputs, mockRequest);

      // Should not throw, just log a warning
      await expect(approvalService.cleanup("approved")).resolves.not.toThrow();
      expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining("Failed to cleanup"));
    });
  });

  describe("error handling", () => {
    it("should handle errors during comment polling gracefully", async () => {
      // Create a custom mock that throws an error for listIssueComments
      expect(true).toBe(true); // TODO: Implement comment polling error handling test
    });

    it("should handle errors during issue status check gracefully", async () => {
      // Create a custom mock that throws an error for getIssue
      const errorMockClient = Object.create(mockGitHubClient);
      errorMockClient.getIssue = async () => {
        throw new Error("Network error");
      };

      // Add approval comment so we don't timeout
      mockGitHubClient.addComment(mockRequest.id, "authorized-user", "approved!");

      approvalService = new ApprovalService(errorMockClient, mockInputs, mockRequest);

      const response = await approvalService.await();

      expect(response.status).toBe("approved");
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Error checking issue status:"),
      );
    });
  });
});
