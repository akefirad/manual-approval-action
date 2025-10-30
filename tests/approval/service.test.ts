import { it } from "@effect/vitest";
import { Duration, Fiber, Layer, Redacted, TestClock } from "effect";
import * as E from "effect/Effect";
import { afterAll, beforeAll, beforeEach, describe, expect } from "vitest";
import { ApprovalService } from "../../src/approval/service.js";
import { ContentService, type IContentService } from "../../src/content/service.js";
import { Environment, type IEnvironment } from "../../src/github/environment.js";
import { type IInputs, Inputs } from "../../src/github/inputs.js";
import { GitHubService, type IGitHubService } from "../../src/github/service.js";
import type { Issue } from "../../src/github/types.js";

describe("ApprovalService", () => {
  const mockInputs = (inputs: Partial<IInputs> = {}) =>
    Layer.succeed(
      Inputs,
      Inputs.make({
        timeoutSeconds: 1,
        approvalKeywords: ["approved!"],
        rejectionKeywords: ["reject!"],
        failOnRejection: true,
        failOnTimeout: true,
        issueTitle: "Test Approval",
        issueBody: "Please approve this test",
        pollIntervalSeconds: 1,
        ...inputs,
      }),
    );

  const mockEnvironment = (environment: Partial<IEnvironment> = {}) =>
    Layer.succeed(
      Environment,
      Environment.make({
        token: Redacted.make("ghp_1234567890abcdefghijklmnopqrstuvwxyz"),
        owner: "test-owner",
        repo: "test-repo",
        workflowName: "Test Workflow",
        jobName: "test-job",
        runId: 12345,
        actionId: "test-action",
        actor: "test-actor",
        eventName: "push",
        ...environment,
      }),
    );

  const mockContent = (content: Partial<IContentService> = {}) =>
    Layer.mock(ContentService, {
      _tag: "ContentService",
      title: "Test title",
      body: "Test body",
      ...content,
    });

  const mockGitHub = (github: Partial<IGitHubService> = {}) =>
    Layer.mock(GitHubService, {
      _tag: "GitHubService",
      ...github,
    });

  const mockGitHubIssue = (
    issue: {
      number: number;
      state?: "open" | "closed";
      comments?: Array<{ body: string; user?: { login: string }; createdAt?: string }>;
    },
    github: Partial<IGitHubService> = {},
  ) => {
    const i: Issue = {
      number: issue.number,
      htmlUrl: `https://github.com/test-owner/test-repo/issues/${issue.number}`,
      state: issue.state || "open",
    };
    const c =
      issue.comments?.map((comment, index) => ({
        id: index + 1,
        body: comment.body,
        user: comment.user || { login: `test-user-${index + 1}` },
        createdAt: comment.createdAt || new Date().toISOString(),
      })) || [];
    return mockGitHub({
      createIssue: () => E.succeed(i),
      getIssue: () => E.succeed(i),
      listIssueComments: () => E.succeed(c),
      addIssueComment: () => E.succeed(undefined),
      closeIssue: () => E.succeed(undefined),
      checkUserPermission: () => E.succeed(false),
      checkTeamMembership: () => E.succeed(false),
      ...github,
    });
  };

  const newApprovalService = (
    deps: {
      inputs?: ReturnType<typeof mockInputs>;
      environment?: ReturnType<typeof mockEnvironment>;
      content?: ReturnType<typeof mockContent>;
      github?: ReturnType<typeof mockGitHub> | ReturnType<typeof mockGitHubIssue>;
    } = {},
  ) => {
    const layers = Layer.mergeAll(
      deps.inputs ?? mockInputs(),
      deps.environment ?? mockEnvironment(),
      deps.content ?? mockContent(),
      deps.github ?? mockGitHub(),
    );
    return ApprovalService.DefaultWithoutDependencies.pipe(Layer.provide(layers));
  };

  beforeAll(() => {});

  beforeEach(() => {});

  afterAll(() => {});

  describe("await", () => {
    it.effect("should approve when authorized user posts an approval comment", () => {
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "approved!" }],
        },
        {
          checkUserPermission: () => E.succeed(true),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        expect(response).toMatchObject({
          failed: false,
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "approved",
          approvers: ["test-user-1"],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should reject when authorized user posts a rejection comment", () => {
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "reject!" }],
        },
        {
          checkUserPermission: () => E.succeed(true),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        expect(response).toMatchObject({
          failed: true, // failOnRejection is true by default
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "rejected",
          approvers: ["test-user-1"],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should timeout when no approval or rejection is received", () => {
      const github = mockGitHubIssue({
        number: 1,
        state: "open",
        comments: [],
      });

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const awaitFiber = yield* E.fork(service.await());
        yield* TestClock.adjust(Duration.seconds(2));
        const response = yield* Fiber.join(awaitFiber);
        expect(response).toMatchObject({
          failed: true, // failOnTimeout is true by default
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "timed-out",
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should reject when issue is closed", () => {
      const github = mockGitHubIssue({
        number: 1,
        state: "closed",
        comments: [],
      });

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        expect(response).toMatchObject({
          failed: true,
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "rejected",
          approvers: [],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should ignore approval from unauthorized user and timeout", () => {
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "approved!" }],
        },
        {
          checkUserPermission: () => E.succeed(false),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const awaitFiber = yield* E.fork(service.await());
        yield* TestClock.adjust(Duration.seconds(2));
        const response = yield* Fiber.join(awaitFiber);
        expect(response).toMatchObject({
          failed: true,
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "timed-out",
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should approve when multiple approval keywords are used", () => {
      const inputs = mockInputs({ approvalKeywords: ["approved!", "lgtm", "👍"] });
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "lgtm" }],
        },
        {
          checkUserPermission: () => E.succeed(true),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        expect(response).toMatchObject({
          failed: false,
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "approved",
          approvers: ["test-user-1"],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ inputs, github })));
    });

    it.effect("should reject when multiple approval and rejection keywords are used", () => {
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "approved!" }, { body: "reject!" }],
        },
        {
          checkUserPermission: () => E.succeed(true),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        // First comment is processed first
        expect(response).toMatchObject({
          failed: false,
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "approved",
          approvers: ["test-user-1"],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should approve when case insensitive approval keyword is used", () => {
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "APPROVED!" }],
        },
        {
          checkUserPermission: () => E.succeed(true),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        expect(response).toMatchObject({
          failed: false,
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "approved",
          approvers: ["test-user-1"],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ github })));
    });

    it.effect("should not fail on rejection when failOnRejection is false", () => {
      const inputs = mockInputs({ failOnRejection: false });
      const github = mockGitHubIssue(
        {
          number: 1,
          state: "open",
          comments: [{ body: "reject!" }],
        },
        {
          checkUserPermission: () => E.succeed(true),
        },
      );

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const response = yield* service.await();
        expect(response).toMatchObject({
          failed: false, // failOnRejection is false, so should not fail
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "rejected",
          approvers: ["test-user-1"],
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ inputs, github })));
    });

    it.effect("should not fail on timeout when failOnTimeout is false", () => {
      const inputs = mockInputs({ failOnTimeout: false });
      const github = mockGitHubIssue({
        number: 1,
        state: "open",
        comments: [],
      });

      return E.gen(function* () {
        const service = yield* ApprovalService;
        const awaitFiber = yield* E.fork(service.await());
        yield* TestClock.adjust(Duration.seconds(2));
        const response = yield* Fiber.join(awaitFiber);
        expect(response).toMatchObject({
          failed: false, // failOnTimeout is false
          issueUrl: "https://github.com/test-owner/test-repo/issues/1",
          status: "timed-out",
          timestamp: expect.any(Date),
        });
      }).pipe(E.provide(newApprovalService({ inputs, github })));
    });
  });
});
