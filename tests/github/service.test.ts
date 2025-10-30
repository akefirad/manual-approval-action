import { getOctokit } from "@actions/github";
import { it } from "@effect/vitest";
import * as E from "effect/Effect";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { GitHubService } from "../../src/github/service.js";

// Mock @actions/github module
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
}));

// Mock @actions/core module for environment setup
vi.mock("@actions/core", () => ({
  getInput: vi.fn((name: string) => {
    if (name === "github-token") return "ghp_test_token";
    return "";
  }),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

describe("GitHubService.checkTeamMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
    process.env.GITHUB_WORKFLOW = "Test Workflow";
    process.env.GITHUB_JOB = "test-job";
    process.env.GITHUB_RUN_ID = "12345";
    process.env.GITHUB_ACTION = "test-action";
    process.env.GITHUB_ACTOR = "test-actor";
    process.env.GITHUB_EVENT_NAME = "push";
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_WORKFLOW;
    delete process.env.GITHUB_JOB;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_ACTION;
    delete process.env.GITHUB_ACTOR;
    delete process.env.GITHUB_EVENT_NAME;
  });

  it.effect("should return true for admin permission", () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        permission: "admin",
        role: "member",
        state: "active",
      },
    });

    vi.mocked(getOctokit).mockReturnValue({
      request: mockRequest,
    } as unknown as ReturnType<typeof getOctokit>);

    return E.gen(function* () {
      const service = yield* GitHubService;
      const hasPermission = yield* service.checkTeamMembership("test-team", "admin-user");

      expect(hasPermission).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
        {
          org: "test-owner",
          team_slug: "test-team",
          username: "admin-user",
        },
      );
    }).pipe(E.provide(GitHubService.Default));
  });

  it.effect("should return true for maintain permission", () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        permission: "maintain",
        role: "member",
        state: "active",
      },
    });

    vi.mocked(getOctokit).mockReturnValue({
      request: mockRequest,
    } as unknown as ReturnType<typeof getOctokit>);

    return E.gen(function* () {
      const service = yield* GitHubService;
      const hasPermission = yield* service.checkTeamMembership("test-team", "maintainer-user");

      expect(hasPermission).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
        {
          org: "test-owner",
          team_slug: "test-team",
          username: "maintainer-user",
        },
      );
    }).pipe(E.provide(GitHubService.Default));
  });

  it.effect("should return true for write permission", () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        permission: "write",
        role: "member",
        state: "active",
      },
    });

    vi.mocked(getOctokit).mockReturnValue({
      request: mockRequest,
    } as unknown as ReturnType<typeof getOctokit>);

    return E.gen(function* () {
      const service = yield* GitHubService;
      const hasPermission = yield* service.checkTeamMembership("test-team", "writer-user");

      expect(hasPermission).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
        {
          org: "test-owner",
          team_slug: "test-team",
          username: "writer-user",
        },
      );
    }).pipe(E.provide(GitHubService.Default));
  });

  it.effect("should return false for read permission", () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        permission: "read",
        role: "member",
        state: "active",
      },
    });

    vi.mocked(getOctokit).mockReturnValue({
      request: mockRequest,
    } as unknown as ReturnType<typeof getOctokit>);

    return E.gen(function* () {
      const service = yield* GitHubService;
      const hasPermission = yield* service.checkTeamMembership("test-team", "readonly-user");

      expect(hasPermission).toBe(false);
      expect(mockRequest).toHaveBeenCalledWith(
        "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
        {
          org: "test-owner",
          team_slug: "test-team",
          username: "readonly-user",
        },
      );
    }).pipe(E.provide(GitHubService.Default));
  });
});
