import * as E from "effect/Effect";
import { Service } from "effect/Effect";
import type { IEnvironment } from "../github/environment.js";
import { Environment } from "../github/environment.js";
import type { IInputs } from "../github/inputs.js";
import { Inputs } from "../github/inputs.js";
import { processTemplate } from "../utils/template.utils.js";

export interface IContentService {
  readonly title: string;
  readonly body: string;
}

export class ContentService extends Service<ContentService>()("ContentService", {
  accessors: true,
  dependencies: [Inputs.Default, Environment.Default],
  effect: E.gen(function* () {
    const inputs = yield* Inputs;
    const env = yield* Environment;

    const title = getTitle(inputs, env);
    const body = getBody(inputs, env);
    return { title, body } satisfies IContentService;
  }),
}) {}

function getTitle(inputs: IInputs, env: IEnvironment): string {
  const { issueTitle } = inputs;
  return issueTitle || getDefaultIssueTitle(env);
}

function getDefaultIssueTitle(env: IEnvironment): string {
  const { workflowName: workflow, jobName: jobId, actionId } = env;
  return `Approval Request: ${workflow}/${jobId}/${actionId}`;
}

function getBody(inputs: IInputs, env: IEnvironment): string {
  const { issueBody, timeoutSeconds, approvalKeywords, rejectionKeywords } = inputs;
  const { workflowName, jobName, actionId, actor, owner, repo, runId } = env;
  const templateBody = issueBody || getDefaultIssueBody(inputs, env);
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

function getDefaultIssueBody(inputs: IInputs, env: IEnvironment): string {
  const { owner, repo, workflowName, runId, jobName: jobId, actionId } = env;
  const { approvalKeywords, rejectionKeywords, timeoutSeconds } = inputs;
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
