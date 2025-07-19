import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { Environment } from "../../src/types/index.js";

// Create mock functions for @actions/core
const mockInfo = vi.fn<(message: string) => void>();
const mockWarning = vi.fn<(message: string) => void>();
const mockError = vi.fn<(message: string) => void>();
const mockDebug = vi.fn<(message: string) => void>();
const mockGetInput = vi.fn<(name: string, options?: object) => string>();

// Mock @actions/core using vi.mock for ESM
vi.mock("@actions/core", () => ({
  info: mockInfo,
  warning: mockWarning,
  error: mockError,
  debug: mockDebug,
  getInput: mockGetInput,
}));

// Define the GitHubAPI interface for mocking
interface GitHubAPI {
  request: MockedFunction<(route: string, options?: Record<string, unknown>) => Promise<{ data: unknown }>>;
}

// Mock variables
let mockOctokit: GitHubAPI;
let mockContext: Environment;

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => mockOctokit),
}));

// No need to mock action module anymore since we pass environment directly

// Import modules after mocking
const { GitHubService } = await import("../../src/services/github.service.js");
const { createMockContext } = await import("../fixtures/mocks.js");

describe("GitHubService", () => {
  let githubService: InstanceType<typeof GitHubService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock octokit
    mockOctokit = {
      request: vi.fn(),
    };

    // Create mock context
    mockContext = createMockContext();

    // Mock the getInput to return a test token
    mockGetInput.mockImplementation((name: string) => {
      if (name === "github-token") return "test-token";
      return "";
    });

    githubService = new GitHubService(mockContext);
  });

  describe("createIssue", () => {
    it("should successfully create an issue", async () => {
      const mockResponse = {
        data: {
          number: 123,
          html_url: "https://github.com/test-owner/test-repo/issues/123",
          state: "open",
        },
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.createIssue("Test Issue", "Test body");

      expect(mockOctokit.request).toHaveBeenCalledWith("POST /repos/{owner}/{repo}/issues", {
        owner: "test-owner",
        repo: "test-repo",
        title: "Test Issue",
        body: "Test body",
      });

      expect(result).toEqual({
        number: 123,
        htmlUrl: "https://github.com/test-owner/test-repo/issues/123",
        state: "open",
      });
    });

    it("should throw error when issue creation fails", async () => {
      const error = new Error("API Error");
      mockOctokit.request.mockRejectedValue(error);

      await expect(githubService.createIssue("Test Issue", "Test body")).rejects.toThrow(
        "Failed to create issue: Error: API Error",
      );
    });
  });

  describe("closeIssue", () => {
    it("should successfully close an issue", async () => {
      mockOctokit.request.mockResolvedValue({ data: {} });

      await githubService.closeIssue(123);

      expect(mockOctokit.request).toHaveBeenCalledWith(
        "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
        {
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 123,
          state: "closed",
        },
      );

      expect(mockInfo).toHaveBeenCalledWith("Issue #123 closed successfully");
    });

    it("should handle error when closing issue fails", async () => {
      const error = new Error("Close failed");
      mockOctokit.request.mockRejectedValue(error);

      await githubService.closeIssue(123);

      expect(mockWarning).toHaveBeenCalledWith("Failed to close issue #123: Error: Close failed");
    });
  });

  describe("listIssueComments", () => {
    it("should successfully list issue comments without since parameter", async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            body: "Comment 1",
            user: { login: "user1" },
            created_at: "2023-01-01T00:00:00Z",
          },
          {
            id: 2,
            body: "Comment 2",
            user: { login: "user2" },
            created_at: "2023-01-02T00:00:00Z",
          },
        ],
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.listIssueComments(123);

      expect(mockOctokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 123,
          per_page: 100,
          since: undefined,
        },
      );

      expect(result).toEqual([
        {
          id: 1,
          body: "Comment 1",
          user: { login: "user1" },
          createdAt: "2023-01-01T00:00:00Z",
        },
        {
          id: 2,
          body: "Comment 2",
          user: { login: "user2" },
          createdAt: "2023-01-02T00:00:00Z",
        },
      ]);
    });

    it("should successfully list issue comments with since parameter", async () => {
      const sinceDate = new Date("2023-01-01T00:00:00Z");
      const mockResponse = {
        data: [
          {
            id: 1,
            body: "Comment 1",
            user: { login: "user1" },
            created_at: "2023-01-01T00:00:00Z",
          },
        ],
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.listIssueComments(123, sinceDate);

      expect(mockOctokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 123,
          per_page: 100,
          since: "2023-01-01T00:00:00.000Z",
        },
      );

      expect(result).toHaveLength(1);
    });

    it("should throw error when listing comments fails", async () => {
      const error = new Error("List failed");
      mockOctokit.request.mockRejectedValue(error);

      await expect(githubService.listIssueComments(123)).rejects.toThrow(
        "Failed to list issue comments: Error: List failed",
      );
    });
  });

  describe("checkUserPermission", () => {
    it("should return true for users with write permission", async () => {
      const mockResponse = {
        data: { permission: "write" },
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.checkUserPermission("test-user");

      expect(mockOctokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/collaborators/{username}/permission",
        {
          owner: "test-owner",
          repo: "test-repo",
          username: "test-user",
        },
      );

      expect(result).toBe(true);
    });

    it("should return true for users with maintain permission", async () => {
      const mockResponse = {
        data: { permission: "maintain" },
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.checkUserPermission("test-user");

      expect(result).toBe(true);
    });

    it("should return true for users with admin permission", async () => {
      const mockResponse = {
        data: { permission: "admin" },
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.checkUserPermission("test-user");

      expect(result).toBe(true);
    });

    it("should return false for users with read permission", async () => {
      const mockResponse = {
        data: { permission: "read" },
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.checkUserPermission("test-user");

      expect(result).toBe(false);
    });

    it("should return false for users with no permission", async () => {
      const mockResponse = {
        data: { permission: "none" },
      };

      mockOctokit.request.mockResolvedValue(mockResponse);

      const result = await githubService.checkUserPermission("test-user");

      expect(result).toBe(false);
    });

    it("should handle error and return false", async () => {
      const error = new Error("Permission check failed");
      mockOctokit.request.mockRejectedValue(error);

      const result = await githubService.checkUserPermission("test-user");

      expect(result).toBe(false);
      expect(mockWarning).toHaveBeenCalledWith(
        "Failed to check user permission for test-user: Error: Permission check failed",
      );
    });
  });

  describe("checkTeamMembership", () => {
    it("should return true for team members", async () => {
      mockOctokit.request.mockResolvedValue({ data: {} });

      const result = await githubService.checkTeamMembership("test-team", "team-member");

      expect(mockOctokit.request).toHaveBeenCalledWith(
        "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
        {
          org: "test-owner",
          team_slug: "test-team",
          username: "team-member",
        },
      );

      expect(result).toBe(true);
    });

    it("should return false for non-team members", async () => {
      const error = new Error("Not a member");
      mockOctokit.request.mockRejectedValue(error);

      const result = await githubService.checkTeamMembership("test-team", "non-member");

      expect(result).toBe(false);
      expect(mockWarning).toHaveBeenCalledWith(
        "User non-member is not a member of team test-team: Error: Not a member",
      );
    });

    it("should handle other errors and return false", async () => {
      const error = new Error("API Error");
      mockOctokit.request.mockRejectedValue(error);

      const result = await githubService.checkTeamMembership("test-team", "user");

      expect(result).toBe(false);
      expect(mockWarning).toHaveBeenCalledWith(
        "User user is not a member of team test-team: Error: API Error",
      );
    });
  });

  describe("error handling", () => {
    it("should handle network errors gracefully", async () => {
      const networkError = new Error("Network timeout");
      mockOctokit.request.mockRejectedValue(networkError);

      await expect(githubService.createIssue("Test", "Body")).rejects.toThrow(
        "Failed to create issue: Error: Network timeout",
      );
    });

    it("should handle API rate limiting errors", async () => {
      const rateLimitError = new Error("API rate limit exceeded");
      mockOctokit.request.mockRejectedValue(rateLimitError);

      await expect(githubService.listIssueComments(123)).rejects.toThrow(
        "Failed to list issue comments: Error: API rate limit exceeded",
      );
    });

    it("should handle malformed API responses", async () => {
      const malformedResponse = { data: null };
      mockOctokit.request.mockResolvedValue(malformedResponse);

      await expect(githubService.createIssue("Test", "Body")).rejects.toThrow();
    });
  });

  describe("context handling", () => {
    it("should use correct context values for all operations", async () => {
      const customService = new GitHubService(mockContext);
      mockOctokit.request.mockResolvedValue({
        data: { number: 1, html_url: "test", state: "open" },
      });

      await customService.createIssue("Test", "Body");

      expect(mockOctokit.request).toHaveBeenCalledWith("POST /repos/{owner}/{repo}/issues", {
        owner: "test-owner",
        repo: "test-repo",
        title: "Test",
        body: "Body",
      });
    });
  });
});
