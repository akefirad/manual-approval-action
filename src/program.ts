import * as E from "effect/Effect";
import { ApprovalService } from "./approval/service.js";
import * as core from "./github/core.js";
import { GitHubService } from "./github/service.js";

export const mainProgram = E.gen(function* () {
  const approvalService = yield* ApprovalService;
  const response = yield* approvalService.await();

  const { status, issueUrl, failed } = response;
  const approvers = status === "timed-out" ? [] : response.approvers;

  yield* core.setOutput("status", status);
  yield* core.setOutput("approvers", approvers.join(","));
  yield* core.setOutput("issue-url", issueUrl);

  if (status === "approved") {
    yield* core.info(`✅ Approval granted by: ${approvers.join(", ")}`);
  } else {
    const msg =
      status === "rejected" //
        ? "❌ Approval request was rejected"
        : "⏱️ Approval request timed out";
    yield* core.info(msg);
    if (failed) {
      yield* core.setFailed(msg);
    }
  }

  return response;
});

export const cleanupProgram = E.gen(function* () {
  const github = yield* GitHubService;
  const approvalRequest = yield* core.getState("approval_request");
  if (!approvalRequest) {
    yield* core.info("No approval request found for cleanup");
    return;
  }
  const request = JSON.parse(approvalRequest);
  yield* github.closeIssue(request.id, "not_planned");
});

export const main = mainProgram.pipe(E.provide(ApprovalService.Default));
export const cleanup = cleanupProgram.pipe(E.provide(GitHubService.Default));
