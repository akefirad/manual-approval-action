import * as E from "effect/Effect";
import * as core from "./github/core.js";
import { GitHubService } from "./github/service.js";

const exit = await E.gen(function* () {
  const github = yield* GitHubService;
  const approvalRequest = yield* core.getState("approval_request");
  if (!approvalRequest) {
    yield* core.info("No approval request found for cleanup");
    return;
  }
  const request = JSON.parse(approvalRequest);
  yield* github.closeIssue(request.id, "not_planned");
}).pipe(E.provide(GitHubService.Default), E.runPromiseExit);

console.log(exit);
