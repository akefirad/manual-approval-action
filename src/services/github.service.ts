import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { IGitHubClient, Issue } from "../interfaces/github-client.interface.js";
import { Comment, Environment } from "../types/index.js";

type GitHubResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

type GitHubIssueComment = {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
};

interface GitHubAPI {
  request(route: string, options?: Record<string, unknown>): Promise<GitHubResponse>;
}

export class GitHubService implements IGitHubClient {
  private readonly octokit: GitHubAPI;

  constructor(private readonly environment: Environment) {
    const githubToken = core.getInput("github-token", { required: true });
    this.octokit = getOctokit(githubToken);
  }

  async createIssue(title: string, body: string): Promise<Issue> {
    const { owner, repo } = this.environment;
    const request = { owner, repo, title, body };
    core.debug(`Creating issue in ${owner}/${repo} with request: ${JSON.stringify(request)}`);
    const response = await this.octokit.request("POST /repos/{owner}/{repo}/issues", request);

    const issue = {
      number: response.data.number,
      htmlUrl: response.data.html_url,
      state: response.data.state,
    };

    core.info(`Issue created successfully: ${issue.htmlUrl}`);
    return issue;
  }

  async closeIssue(issueNumber: number, stateReason?: "completed" | "not_planned"): Promise<void> {
    const { owner, repo } = this.environment;
    try {
      const request: Record<string, unknown> = {
        owner,
        repo,
        issue_number: issueNumber,
        state: "closed",
      };
      if (stateReason) {
        request.state_reason = stateReason;
      }
      core.debug(
        `Closing ${owner}/${repo}/issues/${issueNumber} with state_reason: ${stateReason || "default"}`,
      );
      await this.octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", request);
      core.info(`Issue #${issueNumber} closed successfully`);
    } catch (error) {
      core.warning(`Failed to close issue #${issueNumber}: ${error}`);
    }
  }

  async getIssue(issueNumber: number): Promise<Issue> {
    const { owner, repo } = this.environment;
    const request = { owner, repo, issue_number: issueNumber };
    core.debug(`Getting ${owner}/${repo}/issues/${issueNumber}`);
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}",
      request,
    );

    const issue = {
      number: response.data.number,
      htmlUrl: response.data.html_url,
      state: response.data.state,
    };
    return issue;
  }

  async listIssueComments(issueNumber: number, since?: Date): Promise<Comment[]> {
    const { owner, repo } = this.environment;
    const request = {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      since: since?.toISOString(),
    };
    core.debug(`Listing comments for ${owner}/${repo}/issues/${issueNumber}`);
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      request,
    );

    const comments = response.data.map((comment: GitHubIssueComment) => ({
      id: comment.id,
      body: comment.body,
      user: { login: comment.user.login },
      createdAt: comment.created_at,
    }));
    return comments;
  }

  async addIssueComment(issueNumber: number, body: string): Promise<void> {
    const { owner, repo } = this.environment;
    try {
      const request = { owner, repo, issue_number: issueNumber, body };
      core.debug(`Adding comment to ${owner}/${repo}/issues/${issueNumber}`);
      await this.octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        request,
      );
      core.debug(`Comment added successfully to issue #${issueNumber}`);
    } catch (error) {
      core.warning(`Failed to add comment to issue #${issueNumber}: ${error}`);
    }
  }

  async checkUserPermission(username: string): Promise<boolean> {
    const { owner, repo } = this.environment;
    try {
      const request = { owner, repo, username };
      core.debug(`Checking user permission for ${username} in ${owner}/${repo}`);
      const response = await this.octokit.request(
        "GET /repos/{owner}/{repo}/collaborators/{username}/permission",
        request,
      );

      const permission = response.data.permission;
      core.debug(`User ${username} has permission level: ${permission}`);
      return permission === "write" || permission === "maintain" || permission === "admin";
    } catch (error) {
      core.warning(`Failed to check user permission for ${username}: ${error}`);
      return false;
    }
  }

  async checkTeamMembership(teamSlug: string, username: string): Promise<boolean> {
    const { owner } = this.environment;
    try {
      const request = { org: owner, team_slug: teamSlug, username };
      core.debug(`Checking team membership for ${username} in team ${teamSlug} (org: ${owner})`);
      await this.octokit.request(
        "GET /orgs/{org}/teams/{team_slug}/memberships/{username}",
        request,
      );
      core.debug(`User ${username} is a member of team ${teamSlug}`);
      return true;
    } catch (error) {
      core.warning(`User ${username} is not a member of team ${teamSlug}: ${error}`);
      return false;
    }
  }

  async getEnvironment(): Promise<Environment> {
    return this.environment;
  }
}
