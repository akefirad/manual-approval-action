import { Config, Option, Redacted } from "effect";
import * as E from "effect/Effect";
import { Service } from "effect/Effect";
import * as core from "./core.js";

export interface IEnvironment {
  readonly token: Redacted.Redacted<string>;
  readonly owner: string;
  readonly repo: string;
  readonly workflowName: string;
  readonly jobName: string;
  readonly runId: number;
  readonly actionId: string;
  readonly actor: string;
  readonly eventName: string;
}

export class Environment extends Service<Environment>()("Environment", {
  accessors: true,
  effect: E.gen(function* () {
    const env = yield* Config.redacted("GITHUB_TOKEN").pipe(Config.option);
    const token = Option.isSome(env)
      ? env.value
      : yield* core.getInput("github-token", { required: true }).pipe(E.map(Redacted.make));

    const [owner, repo] = yield* Config.nonEmptyString("GITHUB_REPOSITORY").pipe(
      Config.validate({
        message: "Expected a string with format 'owner/repo'",
        validation: (s) => /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(s),
      }),
      Config.map((s) => s.split("/")), // TODO: Change to NonEmptyString
    );

    const eventName = yield* Config.nonEmptyString("GITHUB_EVENT_NAME") //
      .pipe(Config.withDefault("undefined-event"));

    const workflowName = yield* Config.nonEmptyString("GITHUB_WORKFLOW") //
      .pipe(Config.withDefault("undefined-workflow"));

    // Technically, would be nice to get the actual job name,
    // but it seems to be impossible to get it from the API.
    const jobId = yield* Config.nonEmptyString("GITHUB_JOB") //
      .pipe(Config.withDefault("undefined-job")); // ID defined in the workflow file!

    const runId = yield* Config.number("GITHUB_RUN_ID") //
      .pipe(Config.withDefault(0));

    const actionId = yield* Config.nonEmptyString("GITHUB_ACTION") //
      .pipe(Config.withDefault("undefined-action"));

    const actor = yield* Config.nonEmptyString("GITHUB_ACTOR") //
      .pipe(Config.withDefault("undefined-actor"));

    const res: IEnvironment = {
      token, // FIXME: Change to NonEmptyString
      owner, // FIXME: Change to NonEmptyString
      repo, // FIXME: Change to NonEmptyString
      eventName,
      workflowName,
      jobName: jobId,
      runId,
      actionId,
      actor,
    };
    core.debug(`GitHub environment: ${JSON.stringify(res)}`);
    return res;
  }),
}) {}
