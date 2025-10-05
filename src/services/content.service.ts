import type { ApprovalInputs, Environment } from "../types/index.js";
import { processTemplate } from "../utils/template.utils.js";

export class ContentService {
  constructor(
    private readonly inputs: ApprovalInputs,
    private readonly environment: Environment,
  ) {}

  async getTitle(): Promise<string> {
    const { issueTitle } = this.inputs;
    return issueTitle || this.getDefaultIssueTitle();
  }

  private getDefaultIssueTitle(): string {
    const { workflowName: workflow, jobName: jobId, actionId } = this.environment;
    return `Approval Request: ${workflow}/${jobId}/${actionId}`;
  }

  async getBody(): Promise<string> {
    const { issueBody, timeoutSeconds, approvalKeywords, rejectionKeywords } = this.inputs;
    const { workflowName, jobName, actionId, actor, owner, repo, runId } = this.environment;
    const templateBody = issueBody || this.getDefaultIssueBody();
    const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
    const processedBody = processTemplate(templateBody, {
      "timeout-seconds": timeoutSeconds,
      "workflow-name": workflowName,
      "job-id": jobName, // TODO: fix job-id vs job-name issue!
      "action-id": actionId,
      actor: actor,
      "approval-keywords": approvalKeywords,
      "rejection-keywords": rejectionKeywords,
      "run-url": runUrl,
    });
    return processedBody;
  }

  private getDefaultIssueBody(): string {
    const { owner, repo, workflowName, runId, jobName: jobId, actionId } = this.environment;
    const { approvalKeywords, rejectionKeywords, timeoutSeconds } = this.inputs;
    const approve = approvalKeywords.join(", ") || "approved!";
    const approveMsg = `comment with \`${approve}\``;
    const reject = rejectionKeywords.join(", ");
    const rejectMsg = `${reject ? `comment with \`${reject}\` or ` : ""}simply close the issue!`;
    const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;

    return `
**Manual approval required:** [\`${workflowName}\`/\`${jobId}\`/\`${actionId}\`](${runUrl})
✅ To approve, ${approveMsg}
❌ To reject, ${rejectMsg}

This request will timeout in ${timeoutSeconds} seconds.
`.trim();
  }
}
