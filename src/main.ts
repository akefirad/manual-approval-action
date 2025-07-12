import * as core from "@actions/core";
import { getEnvironment, getInput } from "./action.js";
import { GitHubService } from "./services/github.service.js";
import { ApprovalServiceFactory } from "./services/approval.service.js";

/**
 * Runs the main phase of the action.
 *
 * @returns Resolves when the main phase is complete.
 */
export async function run(): Promise<void> {
  try {
    core.info(`Starting approval workflow for ${process.env.GITHUB_ACTION}`);

    // Get action inputs
    const inputs = getInput();
    const environment = getEnvironment();
    const githubService = new GitHubService(environment);

    const factory = new ApprovalServiceFactory(githubService);
    const approval = await factory.request(inputs);
    const response = await approval.await();

    await approval.saveState();

    core.debug(`Setting outputs: ${JSON.stringify(response)}`);

    core.setOutput("status", response.status);
    core.setOutput("approvers", response.approvers.join(","));
    core.setOutput("issue-url", response.issueUrl);

    if (response.status === "approved") {
      core.info(`✅ Approval granted by: ${response.approvers.join(", ")}`);
    } else if (response.status === "rejected") {
      core.info("❌ Approval request was rejected");
      if (inputs.failOnRejection) {
        core.setFailed("Approval request was rejected");
        return;
      }
    } else if (response.status === "timed-out") {
      core.info("⏱️ Approval request timed out");
      if (inputs.failOnTimeout) {
        core.setFailed("Approval request timed out");
        return;
      }
    }

    core.debug("Main phase completed successfully");
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

run();
