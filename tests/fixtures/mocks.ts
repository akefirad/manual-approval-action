import { IGitHubClient, Issue } from "../../src/interfaces/github-client.interface";
import { Comment, Environment } from "../../src/types";

export class MockGitHubClient implements IGitHubClient {
  private issues: Map<number, Issue> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private issueCounter = 1;
  private commentCounter = 1;

  async createIssue(_title: string, _body: string): Promise<Issue> {
    const issue: Issue = {
      number: this.issueCounter++,
      htmlUrl: `https://github.com/test/repo/issues/${this.issueCounter - 1}`,
      state: "open",
    };
    this.issues.set(issue.number, issue);
    this.comments.set(`${issue.number}`, []);
    return issue;
  }

  async closeIssue(issueNumber: number, stateReason?: "completed" | "not_planned"): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (issue) {
      issue.state = "closed";
      // Store state reason for testing purposes
      (issue as Issue & { stateReason?: string }).stateReason = stateReason;
    }
  }

  async addIssueComment(issueNumber: number, body: string): Promise<void> {
    const key = `${issueNumber}`;
    const comments = this.comments.get(key) || [];
    comments.push({
      id: this.commentCounter++,
      body,
      user: { login: "github-actions[bot]" },
      createdAt: new Date().toISOString(),
    });
    this.comments.set(key, comments);
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

  // Test helper to get all comments for an issue
  getComments(issueNumber: number): Comment[] {
    return this.comments.get(`${issueNumber}`) || [];
  }

  // Test helper to get issue state reason
  getIssueStateReason(issueNumber: number): string | undefined {
    const issue = this.issues.get(issueNumber);
    return issue ? (issue as Issue & { stateReason?: string }).stateReason : undefined;
  }

  getEnvironment(): Promise<Environment> {
    return Promise.resolve(createMockContext());
  }
}

export function createMockContext(overrides?: Partial<Environment>): Environment {
  return {
    owner: "test-owner",
    repo: "test-repo",
    workflowName: "test-workflow",
    jobName: "test-job",
    runId: 12345,
    actionId: "test-action",
    actor: "test-actor",
    eventName: "push",
    ...overrides,
  };
}
