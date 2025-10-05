import * as core from "@actions/core";
import type { ApprovalInputs, Environment } from "./types/index.js";

/**
 * Gets environment context from GitHub Actions environment variables.
 */
export function getEnvironment(): Environment {
  core.debug("Getting GitHub environment context");

  core.debug(`Repository: ${process.env.GITHUB_REPOSITORY}`);
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "/").split("/");

  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY format: ${process.env.GITHUB_REPOSITORY}`);
  }

  const eventName = process.env.GITHUB_EVENT_NAME || "";
  const runId = parseInt(process.env.GITHUB_RUN_ID || "0", 10);
  core.debug(`Event name: ${eventName}, Run ID: ${runId}`);

  // Technically, would be nice to get the actual job name,
  // but it seems to be impossible to get it from the API.
  const jobId = process.env.GITHUB_JOB || ""; // ID defined in the workflow file!

  const environment = {
    owner,
    repo,
    workflowName: process.env.GITHUB_WORKFLOW || "",
    jobName: jobId,
    runId,
    actionId: process.env.GITHUB_ACTION || "",
    actor: process.env.GITHUB_ACTOR || "",
    eventName,
  };

  core.debug(`GitHub environment context: ${JSON.stringify(environment)}`);
  return environment;
}

/**
 * Gets action inputs from GitHub Actions core.
 */
export function getInput(): ApprovalInputs {
  core.debug("Getting action inputs");

  const timeoutSeconds = getPositiveNumber("timeout-seconds");
  const approvalKeywords = parseKeywords("approval-keywords") || ["approved!"];
  const rejectionKeywords = parseKeywords("rejections-keywords") || []; // no default!
  const failOnRejection = core.getBooleanInput("fail-on-rejection");
  const failOnTimeout = core.getBooleanInput("fail-on-timeout");
  const issueTitle = core.getInput("issue-title") || "";
  const issueBody = core.getInput("issue-body") || "";
  const pollIntervalSeconds = getPositiveNumber("poll-interval-seconds");

  core.debug(
    `Input validation completed: timeout=${timeoutSeconds}s,` +
      ` pollInterval=${pollIntervalSeconds}s,` +
      ` approvalKeywords=${approvalKeywords.join(",")}, ` +
      ` rejectionKeywords=${rejectionKeywords.join(",")}, ` +
      ` failOnRejection=${failOnRejection}, ` +
      ` failOnTimeout=${failOnTimeout}, ` +
      ` issueTitle=${issueTitle}, ` +
      ` issueBody=${issueBody}`,
  );

  return {
    timeoutSeconds,
    approvalKeywords,
    rejectionKeywords,
    failOnRejection,
    failOnTimeout,
    issueTitle,
    issueBody,
    pollIntervalSeconds,
  };
}

function parseKeywords(inputName: string): string[] {
  const input = core.getInput(inputName).trim();

  const keywords = input
    .trim()
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);

  return keywords;
}

function getPositiveNumber(input: string): number {
  const value = core.getInput(input);
  const number = parseFloat(value);
  if (Number.isNaN(number) || number <= 0) {
    throw new Error(`Invalid ${input}: ${value}`);
  }
  return number;
}
