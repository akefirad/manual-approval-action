import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Create mock functions
const mockGetInput = jest.fn<(name: string, _options?: object) => string>();
const mockGetState = jest.fn<(name: string) => string>();
const mockDebug = jest.fn<(message: string) => void>();
const mockInfo = jest.fn<(message: string) => void>();
const mockWarning = jest.fn<(message: string) => void>();

// Mock Octokit
const mockOctokit = {
  request: jest.fn<(url: string, options?: object) => Promise<{ data: unknown }>>(),
};

const mockGetOctokit = jest.fn();

// Mock modules using unstable_mockModule for ESM
jest.unstable_mockModule("@actions/core", () => ({
  getInput: mockGetInput,
  getState: mockGetState,
  debug: mockDebug,
  info: mockInfo,
  warning: mockWarning,
}));

jest.unstable_mockModule("@actions/github", () => ({
  getOctokit: mockGetOctokit,
}));

describe("Cleanup Phase", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
    process.env.GITHUB_WORKFLOW = "test-workflow";
    process.env.GITHUB_JOB = "test-job";
    process.env.GITHUB_ACTION = "test-action";
    process.env.GITHUB_RUN_ID = "12345";
    process.env.GITHUB_ACTOR = "test-actor";
    process.env.GITHUB_EVENT_NAME = "push";
  });

  it("should successfully cleanup an approval issue", async () => {
    // Mock inputs
    mockGetInput.mockImplementation((name: string) => {
      if (name === "github-token") return "mock-token";
      return "";
    });

    mockGetState.mockImplementation((name: string) => {
      if (name === "approval_request") {
        return JSON.stringify({
          id: 123,
          issueUrl: "https://github.com/test-owner/test-repo/issues/123",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        });
      }
      return "";
    });

    // Mock GitHub API
    mockOctokit.request.mockImplementation((route: string) => {
      if (route === "PATCH /repos/{owner}/{repo}/issues/{issue_number}") {
        return Promise.resolve({
          data: {
            number: 123,
            html_url: "https://github.com/test-owner/test-repo/issues/123",
            state: "closed",
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockGetOctokit.mockReturnValue(mockOctokit);

    // Import and run the cleanup
    const { run } = await import("../src/cleanup.js");
    await run();

    // Verify the issue was closed
    expect(mockOctokit.request).toHaveBeenCalledWith(
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
      expect.objectContaining({
        owner: "test-owner",
        repo: "test-repo",
        issue_number: 123,
        state: "closed",
      }),
    );

    expect(mockInfo).toHaveBeenCalledWith("Issue #123 closed successfully");
  });

  it("should handle error when no GitHub token provided", async () => {
    // Mock the input to throw an error for required github-token
    mockGetInput.mockImplementation((name: string) => {
      if (name === "github-token") {
        throw new Error("Input required and not supplied: github-token");
      }
      return "";
    });

    const { run } = await import("../src/cleanup.js");
    await run();

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining("Post-phase cleanup failed:"));
    expect(mockOctokit.request).not.toHaveBeenCalled();
  });

  it("should skip cleanup when no approval request state found", async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === "github-token") return "mock-token";
      return "";
    });

    mockGetState.mockImplementation(() => "");

    const { run } = await import("../src/cleanup.js");
    await run();

    expect(mockOctokit.request).not.toHaveBeenCalled();
  });

  it("should handle cleanup errors gracefully", async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === "github-token") return "mock-token";
      return "";
    });

    mockGetState.mockImplementation((name: string) => {
      if (name === "approval_request") {
        return JSON.stringify({
          id: 123,
          issueUrl: "https://github.com/test-owner/test-repo/issues/123",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        });
      }
      return "";
    });

    // Mock API failure
    mockOctokit.request.mockRejectedValue(new Error("API Error"));
    mockGetOctokit.mockReturnValue(mockOctokit);

    const { run } = await import("../src/cleanup.js");
    await run();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("Failed to close issue #123:"),
    );
  });
});
