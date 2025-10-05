import { beforeEach, describe, expect, it, vi } from "vitest";
import { Environment } from "../../src/types/index.js";

// Create mock functions for @actions/core
const mockDebug = vi.fn();
const mockWarning = vi.fn();

// Mock @actions/core using vi.mock for ESM
vi.mock("@actions/core", () => ({
  debug: mockDebug,
  warning: mockWarning,
}));

// Import modules after mocking
const { PermissionChecker } = await import("../../src/utils/permission.utils.js");
const { MockGitHubClient, createMockContext } = await import("../fixtures/mocks.js");

describe("PermissionChecker", () => {
  let mockGitHubClient: InstanceType<typeof MockGitHubClient>;
  let permissionChecker: InstanceType<typeof PermissionChecker>;
  let mockContext: Environment;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGitHubClient = new MockGitHubClient();
    mockContext = createMockContext();
    mockContext.actor = "test-author";
    permissionChecker = new PermissionChecker(mockGitHubClient, mockContext);
  });

  describe("isApproverAllowed", () => {
    it("should allow anyone when 'anyone' is in allowed approvers", async () => {
      const result = await permissionChecker.isApproverAllowed("random-user", ["anyone"]);

      expect(result).toBe(true);
    });

    it("should allow workflow author when 'author' is in allowed approvers", async () => {
      const result = await permissionChecker.isApproverAllowed("test-author", ["author"]);

      expect(result).toBe(true);
    });

    it("should not allow non-author when only 'author' is in allowed approvers", async () => {
      const result = await permissionChecker.isApproverAllowed("other-user", ["author"]);

      expect(result).toBe(false);
    });

    it("should allow explicitly listed users", async () => {
      const result = await permissionChecker.isApproverAllowed("specific-user", [
        "specific-user",
        "another-user",
      ]);

      expect(result).toBe(true);
    });

    it("should not allow users not explicitly listed", async () => {
      const result = await permissionChecker.isApproverAllowed("unlisted-user", [
        "specific-user",
        "another-user",
      ]);

      expect(result).toBe(false);
    });

    it("should allow team members when team is in allowed approvers", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockResolvedValue(true);

      const result = await permissionChecker.isApproverAllowed("team-member", ["team:developers"]);

      expect(result).toBe(true);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith(
        "developers",
        "team-member",
      );
    });

    it("should not allow non-team members", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockResolvedValue(false);

      const result = await permissionChecker.isApproverAllowed("non-member", ["team:developers"]);

      expect(result).toBe(false);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("developers", "non-member");
    });

    it("should check multiple teams if multiple teams are listed", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership")
        .mockResolvedValueOnce(false) // First team check fails
        .mockResolvedValueOnce(true); // Second team check succeeds

      const result = await permissionChecker.isApproverAllowed("user", [
        "team:admins",
        "team:developers",
      ]);

      expect(result).toBe(true);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("admins", "user");
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("developers", "user");
    });

    it("should fall back to repository permissions when no approvers are configured", async () => {
      vi.spyOn(mockGitHubClient, "checkUserPermission").mockResolvedValue(true);

      const result = await permissionChecker.isApproverAllowed("collaborator", []);

      expect(result).toBe(true);
      expect(mockGitHubClient.checkUserPermission).toHaveBeenCalledWith("collaborator");
    });

    it("should reject users without repository permissions when no approvers are configured", async () => {
      vi.spyOn(mockGitHubClient, "checkUserPermission").mockResolvedValue(false);

      const result = await permissionChecker.isApproverAllowed("outsider", []);

      expect(result).toBe(false);
      expect(mockGitHubClient.checkUserPermission).toHaveBeenCalledWith("outsider");
    });

    it("should handle mixed approver types correctly", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockResolvedValue(false);

      const result = await permissionChecker.isApproverAllowed("test-author", [
        "other-user",
        "team:developers",
        "author",
      ]);

      expect(result).toBe(true);
    });

    it("should correctly parse team names from team: prefix", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockResolvedValue(true);

      await permissionChecker.isApproverAllowed("user", ["team:frontend-team"]);

      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("frontend-team", "user");
    });

    it("should stop checking teams once a match is found", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockResolvedValueOnce(true); // First team check succeeds

      const result = await permissionChecker.isApproverAllowed("user", [
        "team:admins",
        "team:developers",
      ]);

      expect(result).toBe(true);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledTimes(1);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("admins", "user");
    });

    it("should handle empty team name gracefully", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockResolvedValue(false);

      const result = await permissionChecker.isApproverAllowed("user", ["team:"]);

      expect(result).toBe(false);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("", "user");
    });

    it("should handle team membership check errors gracefully", async () => {
      vi.spyOn(mockGitHubClient, "checkTeamMembership").mockRejectedValue(new Error("API Error"));

      const result = await permissionChecker.isApproverAllowed("user", [
        "team:developers",
        "fallback-user",
      ]);

      expect(result).toBe(false);
      expect(mockGitHubClient.checkTeamMembership).toHaveBeenCalledWith("developers", "user");
    });

    it("should handle repository permission check errors gracefully", async () => {
      vi.spyOn(mockGitHubClient, "checkUserPermission").mockRejectedValue(new Error("API Error"));

      const result = await permissionChecker.isApproverAllowed("user", []);

      expect(result).toBe(false);
      expect(mockGitHubClient.checkUserPermission).toHaveBeenCalledWith("user");
    });
  });
});
