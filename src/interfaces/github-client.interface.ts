import { Comment, Environment } from "../types/index.js";

export interface Issue {
  number: number;
  htmlUrl: string;
  state: "open" | "closed";
}

export interface IGitHubClient {
  createIssue(title: string, body: string): Promise<Issue>;
  closeIssue(issueNumber: number): Promise<void>;
  getIssue(issueNumber: number): Promise<Issue>;
  listIssueComments(issueNumber: number, since?: Date): Promise<Comment[]>;
  checkUserPermission(username: string): Promise<boolean>;
  checkTeamMembership(teamSlug: string, username: string): Promise<boolean>;
  getEnvironment(): Promise<Environment>;
}
