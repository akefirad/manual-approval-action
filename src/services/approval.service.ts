import * as core from "@actions/core";
import { IGitHubClient } from "../interfaces/github-client.interface.js";
import { ApprovalInputs, ApprovalRequest, ApprovalResponse, Comment } from "../types/index.js";
import { TimeoutManager } from "../utils/timeout.utils.js";
import { ContentService } from "./content.service.js";

export class ApprovalServiceFactory {
  constructor(private readonly github: IGitHubClient) {}

  async request(inputs: ApprovalInputs): Promise<ApprovalService> {
    const env = await this.github.getEnvironment();
    const content = new ContentService(inputs, env);
    const title = await content.getTitle();
    const body = await content.getBody();

    const issue = await this.github.createIssue(title, body);
    const request = {
      id: issue.number,
      issueUrl: issue.htmlUrl,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + inputs.timeoutSeconds * 1000),
    };

    return new ApprovalService(this.github, inputs, request);
  }
}

export class ApprovalService {
  private readonly timeoutManager = new TimeoutManager();

  constructor(
    private readonly github: Pick<
      IGitHubClient,
      | "createIssue"
      | "closeIssue"
      | "getIssue"
      | "listIssueComments"
      | "addIssueComment"
      | "checkUserPermission"
    >,
    private readonly inputs: Pick<
      ApprovalInputs,
      "timeoutSeconds" | "pollIntervalSeconds" | "rejectionKeywords" | "approvalKeywords"
    >,
    private readonly request: ApprovalRequest,
  ) {}

  async await(): Promise<ApprovalResponse> {
    try {
      core.debug(`Starting approval request process with ${JSON.stringify(this.request)}`);
      core.info(`Approval request created at ${this.request.issueUrl}`);
      core.info(`Waiting for approval at ${this.request.issueUrl}`);

      return await this.waitForApproval();
    } catch (error) {
      core.error(`Failed to request approval: ${error}`);
      throw error;
    }
  }

  private async waitForApproval(): Promise<ApprovalResponse> {
    const { timeoutSeconds, pollIntervalSeconds } = this.inputs;
    const { id, issueUrl, createdAt } = this.request;
    return new Promise<ApprovalResponse>((resolve) => {
      let isResolved = false;

      const timeoutHandle = this.timeoutManager.createTimeout(timeoutSeconds, () => {
        if (!isResolved) {
          core.debug("Approval request timed out");
          isResolved = true;
          clearInterval(logInterval);
          const response: ApprovalResponse = {
            status: "timed-out",
            approvers: [],
            issueUrl: this.request!.issueUrl,
            timestamp: new Date(),
          };

          this.cleanup("timed-out").then(() => this.saveState(true));

          // Always resolve with the response, let main.ts handle the failure
          resolve(response);
        }
      });

      const logInterval = setInterval(() => {
        if (!isResolved) core.info(`Still waiting for approval, visit ${issueUrl}`);
      }, 3 * 1000);

      const pollInterval = setInterval(async () => {
        if (isResolved) {
          clearInterval(pollInterval);
          clearInterval(logInterval);
          return;
        }

        try {
          try {
            const { state } = await this.github.getIssue(id);
            if (state === "closed") {
              core.info("Issue was closed unexpectedly, treating as rejection");

              isResolved = true;
              clearInterval(pollInterval);
              clearInterval(logInterval);
              timeoutHandle.cancel();

              const response: ApprovalResponse = {
                status: "rejected",
                approvers: [], // TODO: add who closed the issue!
                issueUrl: this.request!.issueUrl,
                timestamp: new Date(),
              };

              this.cleanup("rejected").then(() => this.saveState(true));
              // Always resolve with the response, let main.ts handle the failure
              resolve(response);
              return;
            }
          } catch (error) {
            core.warning(`Error checking issue status: ${error}`);
          }

          const comments = await this.github.listIssueComments(id, createdAt);
          core.debug(`Found ${comments.length} comments to process`);

          for (const comment of comments) {
            const result = await this.processComment(comment, this.inputs);

            if (result === "none") {
              core.debug(`No relevant keywords found in comment from ${comment.user.login}`);
              continue;
            }

            isResolved = true;
            clearInterval(pollInterval);
            clearInterval(logInterval);
            timeoutHandle.cancel();

            const response: ApprovalResponse = {
              status: result,
              approvers: [comment.user.login],
              issueUrl: this.request!.issueUrl,
              timestamp: new Date(),
            };

            this.cleanup(result, [comment.user.login]).then(() => this.saveState(true));
            resolve(response); // Always resolve, let main.ts handle the failure
            break;
          }
        } catch (error) {
          core.warning(`Error checking comments: ${error}`);
        }
      }, pollIntervalSeconds * 1000);
    });
  }

  private async processComment(
    comment: Comment,
    inputs: Pick<ApprovalInputs, "rejectionKeywords" | "approvalKeywords">,
  ): Promise<"approved" | "rejected" | "none"> {
    const commenter = comment.user.login;
    const body = comment.body.toLowerCase();

    core.debug(`Processing comment from ${commenter}: "${body.substring(0, 100)}..."`);

    const { rejectionKeywords, approvalKeywords } = inputs;
    if (rejectionKeywords.some((k) => body.includes(k.toLowerCase()))) {
      const hasPermission = await this.github.checkUserPermission(commenter);
      if (hasPermission) {
        return "rejected";
      } else {
        core.debug(`Rejection ignored from unauthorized user ${commenter}`);
      }
    }

    if (approvalKeywords.some((k) => body.includes(k.toLowerCase()))) {
      const hasPermission = await this.github.checkUserPermission(commenter);
      if (hasPermission) {
        return "approved";
      } else {
        core.debug(`Approval ignored from unauthorized user ${commenter}`);
      }
    }

    core.debug(`No relevant keywords found in comment from ${commenter}`);
    return "none";
  }

  async saveState(cleanupCompleted: boolean = false): Promise<void> {
    if (this.request) {
      core.debug(`Saving approval request state: ${this.request.id}`);
      core.saveState("approval_request", JSON.stringify(this.request));
      core.saveState("cleanup_completed", cleanupCompleted ? "true" : "false");
    } else {
      core.debug("No approval request to save");
    }
  }

  async cleanup(
    status?: "approved" | "rejected" | "timed-out",
    approvers?: string[],
  ): Promise<void> {
    core.debug("Performing cleanup...");
    this.timeoutManager.cancel();
    try {
      const issueNumber = this.request.id;

      // Add comment based on status
      if (status === "approved") {
        const approverText =
          approvers && approvers.length > 0 ? ` by @${approvers.join(", @")}` : "";
        await this.github.addIssueComment(
          issueNumber,
          `✅ **Approval received${approverText}**\n\nThe manual approval request has been approved. Proceeding with the workflow.`,
        );
        await this.github.closeIssue(issueNumber, "completed");
      } else if (status === "rejected") {
        await this.github.addIssueComment(
          issueNumber,
          `❌ **Approval rejected**\n\nThe manual approval request has been rejected. The workflow will not proceed.`,
        );
        await this.github.closeIssue(issueNumber, "not_planned");
      } else if (status === "timed-out") {
        await this.github.addIssueComment(
          issueNumber,
          `⏱️ **Approval timed out**\n\nThe manual approval request has timed out after ${this.inputs.timeoutSeconds} seconds. The workflow will not proceed.`,
        );
        await this.github.closeIssue(issueNumber, "not_planned");
      } else {
        // Default case - just close without comment
        await this.github.closeIssue(issueNumber);
      }
    } catch (error) {
      core.warning(`Failed to cleanup from state: ${error}`);
    }
  }
}
