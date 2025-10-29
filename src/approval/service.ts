import { Data, Schedule } from "effect";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import { Service } from "effect/Effect";
import { ContentService } from "../content/service.js";
import type { Result } from "../effect/types.js";
import * as core from "../github/core.js";
import { Environment } from "../github/environment.js";
import { Inputs } from "../github/inputs.js";
import { GitHubService } from "../github/service.js";
import type { Comment } from "../github/types.js";
import type {
  ApprovalResponse,
  RepliedApprovalResponse,
  TimedOutApprovalResponse,
} from "../types/index.js";

type ProcessCommentResult = "approved" | "rejected" | "none";

class NoApprovalResponseException extends Data.TaggedError("NoApprovalResponseException")<{
  message?: string;
}> {}

export class ApprovalService extends Service<ApprovalService>()("ApprovalService", {
  dependencies: [
    Inputs.Default,
    Environment.Default,
    GitHubService.Default,
    ContentService.Default,
  ],
  effect: E.gen(function* () {
    const inputs = yield* Inputs;
    const { timeoutSeconds, pollIntervalSeconds, approvalKeywords, rejectionKeywords } = inputs;
    const { title, body } = yield* ContentService;
    const github = yield* GitHubService;
    const issue = yield* github.createIssue(title, body);
    const request = {
      id: issue.number,
      issueUrl: issue.htmlUrl,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutSeconds * 1000),
    };
    yield* core.saveState("approval_request", JSON.stringify(request));

    const processComment = (comment: Comment): Result<ProcessCommentResult> =>
      E.gen(function* () {
        const commenter = comment.user.login;
        const commentBody = comment.body.toLowerCase();

        yield* core.debug(
          `Processing comment from ${commenter}: "${commentBody.substring(0, 100)}..."`,
        );

        // Check for rejection keywords first
        if (rejectionKeywords.some((k) => commentBody.includes(k.toLowerCase()))) {
          const hasPermission = yield* github.checkUserPermission(commenter);
          yield* core.debug(`Rejection ignored from user ${commenter}? ${hasPermission}`);
          if (hasPermission) {
            return "rejected" as const;
          }
        }

        // Check for approval keywords
        if (approvalKeywords.some((k) => commentBody.includes(k.toLowerCase()))) {
          const hasPermission = yield* github.checkUserPermission(commenter);
          yield* core.debug(`Approval ignored from user ${commenter}? ${hasPermission}`);
          if (hasPermission) {
            return "approved" as const;
          }
        }

        yield* core.debug(`No relevant keywords found in comment from ${commenter}`);
        return "none" as const;
      });

    const checkForResponse = (): Result<RepliedApprovalResponse, NoApprovalResponseException> =>
      E.gen(function* () {
        const issueState = yield* github.getIssue(request.id).pipe(E.map(({ state }) => state));

        if (issueState === "closed") {
          // TODO: Maybe check the reason, if it's not "completed", treat as rejection?
          yield* core.info("Issue was closed unexpectedly, treating as rejection");
          return {
            status: "rejected" as const,
            failed: true,
            approvers: [],
            issueUrl: request.issueUrl,
            timestamp: new Date(), // TODO: add the issue closed timestamp!
          };
        }

        // Check comments for approval/rejection
        const comments = yield* github.listIssueComments(request.id); // TODO: add since?
        yield* core.debug(`Found ${comments.length} comments to process`);

        for (const comment of comments) {
          const result = yield* processComment(comment);

          const base = {
            approvers: [comment.user.login],
            issueUrl: request.issueUrl,
            timestamp: new Date(), // TODO: add the comment timestamp!
          };

          if (result === "approved") {
            return {
              ...base,
              status: result,
              failed: false,
            };
          } else if (result === "rejected") {
            return {
              ...base,
              status: result,
              failed: true,
            };
          }
        }

        return yield* new NoApprovalResponseException({ message: "No approval response found" });
      });

    const handleResponse = (res: RepliedApprovalResponse): Result<ApprovalResponse> =>
      E.gen(function* () {
        yield* core.debug(`Handling response: ${JSON.stringify(res)}`);
        const { status } = res;
        if (status === "approved") {
          const { approvers } = res;
          const approverText = approvers.length > 0 ? ` by @${approvers.join(", @")}` : "";
          const msg = `✅ **Approval Received${approverText}**\n\nThe manual approval request has been approved.`;
          yield* core.info(msg);
          yield* github.addIssueComment(request.id, msg);
          yield* github.closeIssue(request.id, "completed");
          return res;
        } else {
          const msg = `❌ **Approval Rejected**\n\nThe manual approval request has been rejected.`;
          yield* core.info(msg);
          yield* github.addIssueComment(request.id, msg);
          yield* github.closeIssue(request.id, "not_planned");
          return {
            ...res,
            failed: inputs.failOnRejection,
          };
        }
      });

    const handleTimeout = (): Result<TimedOutApprovalResponse> =>
      E.gen(function* () {
        yield* core.info(`⏱️ Approval request timed out, handling timeout...`);
        const result = {
          status: "timed-out" as const,
          failed: inputs.failOnTimeout,
          issueUrl: request.issueUrl,
          timestamp: new Date(),
        };
        const reason = inputs.failOnTimeout ? "not_planned" : "completed";
        const outcome = reason === "completed" ? "approved" : "timed out";
        const msg = `⏱️ **Approval Timed Out**\n\nThe manual approval request has been ${outcome}.`;
        yield* core.info(msg);
        yield* github.addIssueComment(request.id, msg);
        yield* github.closeIssue(request.id, reason);
        return result;
      });

    return {
      await: () =>
        E.gen(function* () {
          const { issueUrl } = request;
          yield* core.debug(`Starting approval request process with ${JSON.stringify(request)}`);
          yield* core.info(`Approval request created at ${issueUrl}`);
          yield* core.info(`Waiting for approval at ${issueUrl}`);

          const msgWaiting = `Still waiting for approval at ${issueUrl}`;

          return yield* checkForResponse().pipe(
            E.flatMap((res) => handleResponse(res)),
            E.tapErrorTag("NoApprovalResponseException", () => core.info(msgWaiting)),
            E.retry(Schedule.fixed(Duration.seconds(pollIntervalSeconds))),
            E.timeout(Duration.seconds(timeoutSeconds)),
            E.catchTag("TimeoutException", () => handleTimeout()),
          );
        }).pipe(
          E.tap((res) => core.debug(`Approval response: ${JSON.stringify(res)}`)),
          E.tapError((e) => core.error(`Failed to await approval: ${e}`)),
        ),
    };
  }),
}) {}
