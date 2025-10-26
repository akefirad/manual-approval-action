import * as E from "effect/Effect";
import { ApprovalService } from "./approval/service.js";
import * as core from "./github/core.js";

const exit = await E.gen(function* () {
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
}).pipe(E.provide(ApprovalService.Default), E.runPromiseExit);
console.log(exit);
