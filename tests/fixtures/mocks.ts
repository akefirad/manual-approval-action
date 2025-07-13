import { IGitHubClient, Issue } from "../../src/interfaces/github-client.interface";
import { Comment, Environment } from "../../src/types";

export class MockGitHubClient implements IGitHubClient {
  private issues: Map<number, Issue> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private issueCounter = 1;
  private commentCounter = 1;

  async createIssue(title: string, body: string): Promise<Issue> {
    const issue: Issue = {
      number: this.issueCounter++,
      htmlUrl: `https://github.com/test/repo/issues/${this.issueCounter - 1}`,
      state: "open",
    };
    this.issues.set(issue.number, issue);
    this.comments.set(`${issue.number}`, []);
    return issue;
  }

  async closeIssue(issueNumber: number): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (issue) {
      issue.state = "closed";
    }
  }

  async getIssue(issueNumber: number): Promise<Issue> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found`);
    }
    return { ...issue };
  }

  async listIssueComments(issueNumber: number, since?: Date): Promise<Comment[]> {
    const comments = this.comments.get(`${issueNumber}`) || [];
    if (since) {
      return comments.filter((c) => new Date(c.createdAt) > since);
    }
    return comments;
  }

  async checkUserPermission(username: string): Promise<boolean> {
    // Mock implementation - can be configured for tests
    return username === "authorized-user" || username === "test-actor";
  }

  async checkTeamMembership(teamSlug: string, username: string): Promise<boolean> {
    // Mock implementation - can be configured for tests
    return teamSlug === "test-team" && username === "team-member";
  }

  // Test helper methods
  addComment(issueNumber: number, username: string, body: string): void {
    const key = `${issueNumber}`;
    const comments = this.comments.get(key) || [];
    comments.push({
      id: this.commentCounter++,
      body,
      user: { login: username },
      createdAt: new Date().toISOString(),
    });
    this.comments.set(key, comments);
  }

  // Test helper method to close an issue for testing
  closeIssueForTest(issueNumber: number): void {
    const issue = this.issues.get(issueNumber);
    if (issue) {
      issue.state = "closed";
    }
  }

  async getWorkflowRun(
    runId: number,
  ): Promise<import("../../src/interfaces/github-client.interface.js").WorkflowRun> {
    return {
      id: runId,
      htmlUrl: `https://github.com/test-owner/test-repo/actions/runs/${runId}`,
      workflowId: 123456,
    };
  }

  async getWorkflowJobs(
    runId: number,
  ): Promise<import("../../src/interfaces/github-client.interface.js").Job[]> {
    return [
      {
        id: 1,
        htmlUrl: `https://github.com/test-owner/test-repo/actions/runs/${runId}/jobs/1`,
        name: "test-job",
      },
    ];
  }

  async getEnvironmentWithUrls(): Promise<Environment> {
    return createMockContext();
  }

  getEnvironment(): Environment {
    return createMockContext();
  }
}

export function createMockContext(overrides?: Partial<Environment>): Environment {
  return {
    owner: "test-owner",
    repo: "test-repo",
    workflow: "test-workflow",
    jobId: "test-job",
    runId: 12345,
    actionId: "test-action",
    actor: "test-actor",
    eventName: "push",
    workflowUrl: "https://github.com/test-owner/test-repo/actions/workflows/123456",
    jobUrl: "https://github.com/test-owner/test-repo/actions/runs/12345/jobs/1",
    runUrl: "https://github.com/test-owner/test-repo/actions/runs/12345",
    ...overrides,
  };
}
