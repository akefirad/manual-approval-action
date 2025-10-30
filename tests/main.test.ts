import { it } from "@effect/vitest";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import { beforeEach, describe, expect, vi } from "vitest";

// Create mock functions
const mockGetInput = vi.fn<(name: string, _options?: object) => string>();
const mockGetBooleanInput = vi.fn<(name: string) => boolean>();
const mockSetOutput = vi.fn<(name: string, value: string) => void>();
const mockSetFailed = vi.fn<(message: string) => void>();
const mockDebug = vi.fn<(message: string) => void>();
const mockInfo = vi.fn<(message: string) => void>();
const mockWarning = vi.fn<(message: string) => void>();
const mockSaveState = vi.fn<(name: string, value: string) => void>();
const mockGetState = vi.fn<(name: string) => string>();

// Mock Octokit
const mockOctokit = {
  request: vi.fn<(url: string, options?: object) => Promise<{ data: unknown }>>(),
};

const mockGetOctokit = vi.fn();

// Mock modules using vi.mock for ESM
vi.mock("@actions/core", () => ({
  getInput: mockGetInput,
  getBooleanInput: mockGetBooleanInput,
  setOutput: mockSetOutput,
  setFailed: mockSetFailed,
  debug: mockDebug,
  info: mockInfo,
  warning: mockWarning,
  saveState: mockSaveState,
  getState: mockGetState,
}));

vi.mock("@actions/github", () => ({
  getOctokit: mockGetOctokit,
}));

describe("Manual Approval Action Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
    process.env.GITHUB_WORKFLOW = "test-workflow";
    process.env.GITHUB_JOB = "test-job";
    process.env.GITHUB_ACTION = "test-action";
    process.env.GITHUB_RUN_ID = "12345";
    process.env.GITHUB_ACTOR = "test-actor";
    process.env.GITHUB_EVENT_NAME = "push";
  });

  it("should handle a complete approval workflow with default inputs", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        "timeout-seconds": "2",
        "approval-keywords": "approved!",
        "rejections-keywords": "reject!",
        "issue-title": "",
        "issue-body": "",
        "poll-interval-seconds": "1",
      };
      return inputs[name] || "";
    });

    mockGetBooleanInput.mockImplementation((name: string) => {
      const booleans: Record<string, boolean> = {
        "fail-on-rejection": true,
        "fail-on-timeout": true,
      };
      return booleans[name] || false;
    });

    mockOctokit.request.mockImplementation((route: string, _options?: object) => {
      if (route === "POST /repos/{owner}/{repo}/issues") {
        return Promise.resolve({
          data: {
            number: 1,
            html_url: "https://github.com/test-owner/test-repo/issues/1",
            state: "open",
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}") {
        return Promise.resolve({
          data: {
            id: 12345,
            html_url: "https://github.com/test-owner/test-repo/actions/runs/12345",
            workflow_id: 67890,
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
        return Promise.resolve({
          data: {
            jobs: [
              {
                id: 1,
                html_url: "https://github.com/test-owner/test-repo/actions/runs/12345/jobs/1",
                name: "test-job",
              },
            ],
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
        // Always return approval comment immediately for testing
        return Promise.resolve({
          data: [
            {
              id: 1,
              body: "approved!",
              user: { login: "test-actor" },
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      if (route === "GET /repos/{owner}/{repo}/collaborators/{username}/permission") {
        return Promise.resolve({
          data: {
            permission: "write",
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockGetOctokit.mockReturnValue(mockOctokit);

    // Import the action
    const { main } = await import("../src/program.js");

    // Run the action (this would normally be called by the action runner)
    const exit = await E.runPromiseExit(main);

    // Verify the exit result
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toMatchObject({
        status: "approved",
        failed: false,
        approvers: ["test-actor"],
        issueUrl: "https://github.com/test-owner/test-repo/issues/1",
      });
      expect(exit.value.timestamp).toBeInstanceOf(Date);
    }

    // Verify outputs were set
    expect(mockSetOutput).toHaveBeenCalledWith("status", "approved");
    expect(mockSetOutput).toHaveBeenCalledWith("approvers", "test-actor");
    expect(mockSetOutput).toHaveBeenCalledWith(
      "issue-url",
      "https://github.com/test-owner/test-repo/issues/1",
    );

    // Verify no errors
    expect(mockSetFailed).not.toHaveBeenCalled();
  }, 3000);

  it("should handle a complete approval workflow with custom inputs", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        "github-token": "mock-token",
        "timeout-seconds": "2",
        "approval-keywords": "LGTM,approved!",
        "rejections-keywords": "reject!,denied",
        "issue-title": "Test Approval Request",
        "issue-body": "Please approve this custom test workflow",
        "poll-interval-seconds": "1",
      };
      return inputs[name] || "";
    });

    mockGetBooleanInput.mockImplementation((name: string) => {
      const booleans: Record<string, boolean> = {
        "fail-on-rejection": true,
        "fail-on-timeout": true,
      };
      return booleans[name] || false;
    });

    mockOctokit.request.mockImplementation((route: string, _options?: object) => {
      if (route === "POST /repos/{owner}/{repo}/issues") {
        return Promise.resolve({
          data: {
            number: 2,
            html_url: "https://github.com/test-owner/test-repo/issues/2",
            state: "open",
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}") {
        return Promise.resolve({
          data: {
            id: 12345,
            html_url: "https://github.com/test-owner/test-repo/actions/runs/12345",
            workflow_id: 67890,
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
        return Promise.resolve({
          data: {
            jobs: [
              {
                id: 1,
                html_url: "https://github.com/test-owner/test-repo/actions/runs/12345/jobs/1",
                name: "test-job",
              },
            ],
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
        // Return approval comment with custom keyword
        return Promise.resolve({
          data: [
            {
              id: 1,
              body: "LGTM",
              user: { login: "test-actor" },
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      if (route === "GET /repos/{owner}/{repo}/collaborators/{username}/permission") {
        return Promise.resolve({
          data: {
            permission: "admin",
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockGetOctokit.mockReturnValue(mockOctokit);

    // Import the action
    const { main } = await import("../src/program.js");

    // Run the action (this would normally be called by the action runner)
    const exit = await E.runPromiseExit(main);

    // Verify the exit result
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toMatchObject({
        status: "approved",
        failed: false,
        approvers: ["test-actor"],
        issueUrl: "https://github.com/test-owner/test-repo/issues/2",
      });
      expect(exit.value.timestamp).toBeInstanceOf(Date);
    }

    // Verify outputs were set
    expect(mockSetOutput).toHaveBeenCalledWith("status", "approved");
    expect(mockSetOutput).toHaveBeenCalledWith("approvers", "test-actor");
    expect(mockSetOutput).toHaveBeenCalledWith(
      "issue-url",
      "https://github.com/test-owner/test-repo/issues/2",
    );

    // Verify no errors
    expect(mockSetFailed).not.toHaveBeenCalled();
  }, 3000);

  it("should handle rejection workflow and call setFailed", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        "timeout-seconds": "2",
        "approval-keywords": "approved!",
        "rejections-keywords": "reject!",
        "issue-title": "",
        "issue-body": "",
        "poll-interval-seconds": "1",
      };
      return inputs[name] || "";
    });

    mockGetBooleanInput.mockImplementation((name: string) => {
      const booleans: Record<string, boolean> = {
        "fail-on-rejection": true,
        "fail-on-timeout": true,
      };
      return booleans[name] || false;
    });

    mockOctokit.request.mockImplementation((route: string, _options?: object) => {
      if (route === "POST /repos/{owner}/{repo}/issues") {
        return Promise.resolve({
          data: {
            number: 3,
            html_url: "https://github.com/test-owner/test-repo/issues/3",
            state: "open",
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}") {
        return Promise.resolve({
          data: {
            id: 12345,
            html_url: "https://github.com/test-owner/test-repo/actions/runs/12345",
            workflow_id: 67890,
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
        return Promise.resolve({
          data: {
            jobs: [
              {
                id: 1,
                html_url: "https://github.com/test-owner/test-repo/actions/runs/12345/jobs/1",
                name: "test-job",
              },
            ],
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
        // Return rejection comment
        return Promise.resolve({
          data: [
            {
              id: 1,
              body: "reject!",
              user: { login: "test-actor" },
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      if (route === "GET /repos/{owner}/{repo}/collaborators/{username}/permission") {
        return Promise.resolve({
          data: {
            permission: "write",
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockGetOctokit.mockReturnValue(mockOctokit);

    // Import the action
    const { main } = await import("../src/program.js");

    // Run the action
    const exit = await E.runPromiseExit(main);

    // Verify the exit result
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toMatchObject({
        status: "rejected",
        failed: true,
        approvers: ["test-actor"],
        issueUrl: "https://github.com/test-owner/test-repo/issues/3",
      });
      expect(exit.value.timestamp).toBeInstanceOf(Date);
    }

    // Verify outputs were set
    expect(mockSetOutput).toHaveBeenCalledWith("status", "rejected");
    expect(mockSetOutput).toHaveBeenCalledWith("approvers", "test-actor");
    expect(mockSetOutput).toHaveBeenCalledWith(
      "issue-url",
      "https://github.com/test-owner/test-repo/issues/3",
    );

    // Verify setFailed was called with rejection message
    expect(mockInfo).toHaveBeenCalledWith("❌ Approval request was rejected");
    expect(mockSetFailed).toHaveBeenCalledWith("❌ Approval request was rejected");
  }, 3000);

  it("should handle timeout workflow and call setFailed", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        "timeout-seconds": "1",
        "approval-keywords": "approved!",
        "rejections-keywords": "reject!",
        "issue-title": "",
        "issue-body": "",
        "poll-interval-seconds": "1",
      };
      return inputs[name] || "";
    });

    mockGetBooleanInput.mockImplementation((name: string) => {
      const booleans: Record<string, boolean> = {
        "fail-on-rejection": true,
        "fail-on-timeout": true,
      };
      return booleans[name] || false;
    });

    mockOctokit.request.mockImplementation((route: string, _options?: object) => {
      if (route === "POST /repos/{owner}/{repo}/issues") {
        return Promise.resolve({
          data: {
            number: 4,
            html_url: "https://github.com/test-owner/test-repo/issues/4",
            state: "open",
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}") {
        return Promise.resolve({
          data: {
            id: 12345,
            html_url: "https://github.com/test-owner/test-repo/actions/runs/12345",
            workflow_id: 67890,
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
        return Promise.resolve({
          data: {
            jobs: [
              {
                id: 1,
                html_url: "https://github.com/test-owner/test-repo/actions/runs/12345/jobs/1",
                name: "test-job",
              },
            ],
          },
        });
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
        // Return no comments to trigger timeout
        return Promise.resolve({
          data: [],
        });
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}") {
        return Promise.resolve({
          data: {
            number: 4,
            html_url: "https://github.com/test-owner/test-repo/issues/4",
            state: "open",
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockGetOctokit.mockReturnValue(mockOctokit);

    // Import the action
    const { main } = await import("../src/program.js");

    // Run the action
    const exit = await E.runPromiseExit(main);

    // Verify the exit result
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toMatchObject({
        status: "timed-out",
        failed: true,
        issueUrl: "https://github.com/test-owner/test-repo/issues/4",
      });
      expect(exit.value.timestamp).toBeInstanceOf(Date);
    }

    // Verify outputs were set
    expect(mockSetOutput).toHaveBeenCalledWith("status", "timed-out");
    expect(mockSetOutput).toHaveBeenCalledWith("approvers", "");
    expect(mockSetOutput).toHaveBeenCalledWith(
      "issue-url",
      "https://github.com/test-owner/test-repo/issues/4",
    );

    // Verify setFailed was called with timeout message
    expect(mockInfo).toHaveBeenCalledWith("⏱️ Approval request timed out");
    expect(mockSetFailed).toHaveBeenCalledWith("⏱️ Approval request timed out");
  }, 3000);
});
