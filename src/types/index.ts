export interface ApprovalInputs {
  timeoutSeconds: number;
  approvalKeywords: string[];
  rejectionKeywords: string[];
  failOnRejection: boolean;
  failOnTimeout: boolean;
  issueTitle: string;
  issueBody: string;
  pollIntervalSeconds: number;
}

export interface ApprovalRequest {
  id: number;
  issueUrl: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ApprovalResponse {
  status: "approved" | "rejected" | "timed-out";
  approvers: string[];
  issueUrl: string;
  timestamp: Date;
}

export interface Comment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  createdAt: string;
}

export interface Environment {
  owner: string;
  repo: string;
  workflowName: string;
  jobName: string;
  runId: number;
  actionId: string;
  actor: string;
  eventName: string;
}
