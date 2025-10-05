import type { Comment, Environment } from "../types/index.js";

export interface Issue {
  number: number;
  htmlUrl: string;
  state: "open" | "closed";
}

export interface IGitHubClient {
  createIssue(title: string, body: string): Promise<Issue>;
  closeIssue(issueNumber: number, stateReason?: "completed" | "not_planned"): Promise<void>;
  getIssue(issueNumber: number): Promise<Issue>;
  listIssueComments(issueNumber: number, since?: Date): Promise<Comment[]>;
  addIssueComment(issueNumber: number, body: string): Promise<void>;
  checkUserPermission(username: string): Promise<boolean>;
  checkTeamMembership(teamSlug: string, username: string): Promise<boolean>;
  getEnvironment(): Promise<Environment>;
}
