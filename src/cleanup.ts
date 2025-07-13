import * as core from "@actions/core";
import { getEnvironment } from "./action.js";
import { ApprovalService } from "./services/approval.service.js";
import { GitHubService } from "./services/github.service.js";
import { ApprovalRequest } from "./types/index.js";

/**
 * Runs the post-phase cleanup.
 *
 * @returns Resolves when the post-phase cleanup is complete.
 */
export async function run(): Promise<void> {
  try {
    core.info("Running post-phase cleanup...");

    // Check if there's saved state to cleanup
    const savedState = core.getState("approval_request");
    if (!savedState) {
      core.info("No saved state found for cleanup");
      return;
    }

    // Create GitHub service
    const environment = getEnvironment();
    const githubService = new GitHubService(environment);

    // Create minimal inputs and request for cleanup, TODO: remove this
    const inputs = {
      timeoutSeconds: 0,
      approvalKeywords: [],
      rejectionKeywords: [],
      pollIntervalSeconds: 0,
    };

    const request: ApprovalRequest = JSON.parse(savedState);
    const approval = new ApprovalService(githubService, inputs, request);
    await approval.cleanup();
  } catch (error) {
    core.warning(`Post-phase cleanup failed: ${error}`);
  }
}

run();
