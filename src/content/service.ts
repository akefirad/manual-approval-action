import { Context, Layer } from "effect";
import * as E from "effect/Effect";
import * as core from "../github/core.js";
import type { IEnvironment } from "../github/environment.js";
import { Environment } from "../github/environment.js";
import type { IInputs } from "../github/inputs.js";
import { Inputs } from "../github/inputs.js";
import { fitGithubIssueBody, fitGithubIssueTitle } from "../utils/issue-size.utils.js";
import { processTemplate } from "../utils/template.utils.js";

export interface IContentService {
  readonly title: string;
  readonly body: string;
}

export class ContentService extends Context.Service<ContentService, IContentService>()(
  "ContentService",
  {
    make: E.gen(function* () {
      const inputs = yield* Inputs;
      const env = yield* Environment;

      const rawTitle = getTitle(inputs, env);
      const rawBody = getBody(inputs, env);
      const title = fitGithubIssueTitle(rawTitle);
      const body = fitGithubIssueBody(rawBody);

      if (title !== rawTitle) {
        yield* core.warning("Issue title exceeds GitHub's 256-character limit and was truncated.");
      }
      if (body !== rawBody) {
        yield* core.warning("Issue body exceeds GitHub's 65536-character limit and was truncated.");
      }

      return { title, body } satisfies IContentService;
    }),
  },
) {
  static readonly layerWithoutDependencies = Layer.effect(this, this.make);
  static readonly layer = this.layerWithoutDependencies.pipe(
    Layer.provide(Inputs.layer),
    Layer.provide(Environment.layer),
  );
}

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
