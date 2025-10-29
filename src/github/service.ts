import { getOctokit } from "@actions/github";
import { Redacted } from "effect";
import * as E from "effect/Effect";
import { Service } from "effect/Effect";
import type { Result } from "../effect/types.js";
import * as core from "./core.js";
import { Environment } from "./environment.js";
import type { Comment, Issue } from "./types.js";

type GitHubResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly data: any; // FIXME: This is a hack!
};

type GitHubIssueComment = {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
};

const makeOctokit = (token: Redacted.Redacted<string>) =>
  E.sync(() => getOctokit(Redacted.value(token))).pipe(
    E.map((octokit) => ({
      request: (route: string, options?: Record<string, unknown>): Result<GitHubResponse> =>
        E.promise(() => octokit.request(route, options)),
    })),
  );

export interface IGitHubService {
  getIssue(issueNumber: number): Result<Issue>;
  createIssue(title: string, body: string): Result<Issue>;
  closeIssue(issueNumber: number, stateReason?: "completed" | "not_planned"): Result<void>;
  listIssueComments(issueNumber: number, since?: Date): Result<Comment[]>;
  addIssueComment(issueNumber: number, body: string): Result<void>;
  checkUserPermission(username: string): Result<boolean>; // TODO: should return the permisison!
  checkTeamMembership(teamSlug: string, username: string): Result<boolean>;
}

export class GitHubService extends Service<GitHubService>()("GitHubService", {
  accessors: true,
  dependencies: [Environment.Default],
  effect: E.gen(function* () {
    const { token } = yield* Environment;
    const octokit = yield* makeOctokit(token);
    const { owner, repo } = yield* Environment;
    const issuesUrl = `/repos/{owner}/{repo}/issues`;

    const getIssue: IGitHubService["getIssue"] = (issueNumber) =>
      E.gen(function* () {
        const req = { owner, repo, issue_number: issueNumber };
        yield* core.debug(`Getting issue with: ${JSON.stringify(req)}`);
        const { data } = yield* octokit.request(`GET ${issuesUrl}/{issue_number}`, req);
        const res: Issue = {
          number: data.number,
          htmlUrl: data.html_url,
          state: data.state,
        };
        return res;
      });

    const createIssue: IGitHubService["createIssue"] = (title, body) =>
      E.gen(function* () {
        const req = { owner, repo, title, body };
        yield* core.debug(`Creating issue with request: ${JSON.stringify(req)}`);
        const { data } = yield* octokit.request(`POST ${issuesUrl}`, req);
        const res: Issue = {
          number: data.number,
          htmlUrl: data.html_url,
          state: data.state,
        };
        yield* core.info(`Successfully created issue: ${res.htmlUrl}`);
        return res;
      });

    const closeIssue: IGitHubService["closeIssue"] = (issueNumber, stateReason) =>
      E.gen(function* () {
        const req = {
          owner,
          repo,
          issue_number: issueNumber,
          state: "closed",
          state_reason: stateReason,
        };
        yield* core.debug(`Closing issue with: ${JSON.stringify(req)}`);
        yield* octokit.request(`PATCH ${issuesUrl}/{issue_number}`, req);
      });

    const listIssueComments: IGitHubService["listIssueComments"] = (issueNumber, since) =>
      E.gen(function* () {
        const req = {
          owner,
          repo,
          issue_number: issueNumber,
          since: since?.toISOString(),
        };
        yield* core.debug(`Listing issue comments with: ${JSON.stringify(req)}`);
        // TODO: How about paginating?
        const { data } = yield* octokit.request(`GET ${issuesUrl}/{issue_number}/comments`, req);
        const comments = data.map((comment: GitHubIssueComment) => ({
          id: comment.id,
          body: comment.body,
          user: { login: comment.user.login },
          createdAt: comment.created_at,
        }));
        return comments;
      });

    const addIssueComment: IGitHubService["addIssueComment"] = (issueNumber, body) =>
      E.gen(function* () {
        const req = { owner, repo, issue_number: issueNumber, body };
        yield* core.debug(`Adding issue comment with: ${JSON.stringify(req)}`);
        yield* octokit.request(`POST ${issuesUrl}/{issue_number}/comments`, req);
      });

    const checkUserPermission: IGitHubService["checkUserPermission"] = (username) =>
      E.gen(function* () {
        const req = { owner, repo, username };
        yield* core.debug(`Checking user permission with: ${JSON.stringify(req)}`);
        const { data } = yield* octokit.request(
          "GET /repos/{owner}/{repo}/collaborators/{username}/permission",
          req,
        );
        return (
          data.permission === "write" ||
          data.permission === "maintain" ||
          data.permission === "admin"
        );
      });

    const checkTeamMembership: IGitHubService["checkTeamMembership"] = (teamSlug, username) =>
      E.gen(function* () {
        const req = { org: owner, team_slug: teamSlug, username };
        yield* core.debug(`Checking team membership with: ${JSON.stringify(req)}`);
        const { data } = yield* octokit.request(
          "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
          req,
        );
        return (
          data.permission === "write" ||
          data.permission === "maintain" ||
          data.permission === "admin"
        );
      });

    return {
      getIssue,
      createIssue,
      closeIssue,
      listIssueComments,
      addIssueComment,
      checkUserPermission,
      checkTeamMembership,
    } satisfies IGitHubService;
  }),
}) {}
