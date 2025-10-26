import * as E from "effect/Effect";
import { Service } from "effect/Effect";
import type { Result } from "../effect/types.js";
import * as core from "./core.js";

export interface IInputs {
  timeoutSeconds: number;
  approvalKeywords: string[];
  rejectionKeywords: string[];
  failOnRejection: boolean;
  failOnTimeout: boolean;
  issueTitle: string;
  issueBody: string;
  pollIntervalSeconds: number;
}

export class Inputs extends Service<Inputs>()("Inputs", {
  accessors: true,
  effect: E.gen(function* () {
    const parseKeywords = (inputName: string, defaultKeywords: string[] = []): Result<string[]> =>
      core
        .getCommaSeparatedWords(inputName) //
        .pipe(E.map((l) => l.map((w) => w.toLowerCase())))
        .pipe(E.map((l) => (l.length > 0 ? l : defaultKeywords)));

    const approvalKeywords = yield* parseKeywords("approval-keywords", ["approved!"]);
    const rejectionKeywords = yield* parseKeywords("rejections-keywords", []); // no default!
    const failOnRejection = yield* core.getBooleanInput("fail-on-rejection");
    const failOnTimeout = yield* core.getBooleanInput("fail-on-timeout");
    const issueTitle = yield* core.getInput("issue-title");
    const issueBody = yield* core.getInput("issue-body");
    const timeoutSeconds = yield* core.getPositiveNumber("timeout-seconds");
    const pollIntervalSeconds = yield* core.getPositiveNumber("poll-interval-seconds");
    return {
      timeoutSeconds,
      approvalKeywords,
      rejectionKeywords,
      failOnRejection,
      failOnTimeout,
      issueTitle,
      issueBody,
      pollIntervalSeconds,
    } satisfies IInputs;
  }),
}) {}
