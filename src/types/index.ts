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

type BaseApprovalResponse = {
  issueUrl: string;
  timestamp: Date;
};

export type ApprovedApprovalResponse = BaseApprovalResponse & {
  status: "approved";
  failed: false;
  approvers: string[];
};

export type RejectedApprovalResponse = BaseApprovalResponse & {
  status: "rejected";
  failed: boolean;
  approvers: string[];
};

export type TimedOutApprovalResponse = BaseApprovalResponse & {
  status: "timed-out";
  failed: boolean;
};

export type RepliedApprovalResponse = ApprovedApprovalResponse | RejectedApprovalResponse;

export type ApprovalResponse =
  | ApprovedApprovalResponse
  | RejectedApprovalResponse
  | TimedOutApprovalResponse;

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
