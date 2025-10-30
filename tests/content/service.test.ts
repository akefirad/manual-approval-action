import { it } from "@effect/vitest";
import { Layer, Redacted } from "effect";
import * as E from "effect/Effect";
import { describe, expect } from "vitest";
import { Environment, type IEnvironment } from "../../src/github/environment.js";
import { type IInputs, Inputs } from "../../src/github/inputs.js";

// Import without mocking - use real implementation
const { ContentService } = await import("../../src/content/service.js");

describe("ContentService", () => {
  const mockInputs = (inputs: Partial<IInputs> = {}) =>
    Layer.succeed(
      Inputs,
      Inputs.make({
        timeoutSeconds: 300,
        approvalKeywords: ["approved!", "lgtm"],
        rejectionKeywords: ["reject!", "denied"],
        failOnRejection: true,
        failOnTimeout: true,
        issueTitle: "", // default title
        issueBody: "", // default body
        pollIntervalSeconds: 3,
        ...inputs,
      }),
    );

  const mockEnvironment = (environment: Partial<IEnvironment> = {}) =>
    Layer.succeed(
      Environment,
      Environment.make({
        token: Redacted.make("test-token"),
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

  describe("getTitle", () => {
    it.effect("should return default title when no custom title provided", () => {
      const deps = Layer.provide(Layer.merge(mockInputs({}), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const title = yield* ContentService.title;
        expect(title).toBe("Approval Request: Test Workflow/test-job/test-action");
      }).pipe(E.provide(subject));
    });

    it.effect("should return custom title when provided", () => {
      const issueTitle = "Custom Approval Title";
      const deps = Layer.provide(Layer.merge(mockInputs({ issueTitle }), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const title = yield* ContentService.title;
        expect(title).toBe(issueTitle);
      }).pipe(E.provide(subject));
    });
  });

  describe("getBody", () => {
    it.effect("should use default body when no custom body provided", () => {
      const deps = Layer.provide(Layer.merge(mockInputs({}), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("**Manual approval required:**");
        expect(body).toContain("Test Workflow");
        expect(body).toContain("test-job");
        expect(body).toContain("test-action");
      }).pipe(E.provide(subject));
    });

    it.effect("should return custom body when provided and process templates", () => {
      const issueBody = "Custom body with {{ timeout-seconds }} timeout and actor {{ actor }}";
      const deps = Layer.provide(Layer.merge(mockInputs({ issueBody }), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toBe("Custom body with 300 timeout and actor test-actor");
      }).pipe(E.provide(subject));
    });

    it.effect("should process template variables correctly", () => {
      const issueBody = "Workflow: {{ workflow-name }}, Job: {{ job-id }}, Action: {{ action-id }}";
      const deps = Layer.provide(Layer.merge(mockInputs({ issueBody }), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toBe("Workflow: Test Workflow, Job: test-job, Action: test-action");
      }).pipe(E.provide(subject));
    });

    it.effect("should handle array variables in templates", () => {
      const issueBody =
        "Approval keywords: {{ approval-keywords }}, Rejection keywords: {{ rejection-keywords }}";
      const deps = Layer.provide(Layer.merge(mockInputs({ issueBody }), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toBe(
          "Approval keywords: approved!, lgtm, Rejection keywords: reject!, denied",
        );
      }).pipe(E.provide(subject));
    });
  });

  describe("getDefaultIssueBody", () => {
    it.effect("should generate complete default body with all links", () => {
      const deps = Layer.provide(Layer.merge(mockInputs(), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("**Manual approval required:**");
        expect(body).toContain("`Test Workflow`/`test-job`/`test-action`");
        expect(body).toContain("https://github.com/test-owner/test-repo/actions/runs/12345");
        expect(body).toContain("To approve, comment with `approved!, lgtm`");
        expect(body).toContain(
          "To reject, comment with `reject!, denied` or simply close the issue!",
        );
        expect(body).toContain("This request will timeout in 300 seconds.");
      }).pipe(E.provide(subject));
    });

    it.effect("should handle empty approval keywords", () => {
      const overrideInputs = { approvalKeywords: [] };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("To approve, comment with `approved!`"); // Fallback value
      }).pipe(E.provide(subject));
    });

    it.effect("should handle empty rejection keywords", () => {
      const overrideInputs = { rejectionKeywords: [] };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("To reject, simply close the issue!");
        expect(body).not.toContain("comment with `` or"); // Should not have empty rejection text
      }).pipe(E.provide(subject));
    });

    it.effect("should handle missing URLs gracefully", () => {
      const deps = Layer.provide(Layer.merge(mockInputs({}), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        // Should still generate the run URL from environment data
        expect(body).toContain("https://github.com/test-owner/test-repo/actions/runs/12345");
      }).pipe(E.provide(subject));
    });

    it.effect("should handle single approval and rejection keywords", () => {
      const overrideInputs = { approvalKeywords: ["approve"], rejectionKeywords: ["deny"] };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("To approve, comment with `approve`");
        expect(body).toContain("To reject, comment with `deny` or simply close the issue!");
      }).pipe(E.provide(subject));
    });

    it.effect("should format timeout correctly", () => {
      const timeoutSeconds = 1800;
      const deps = Layer.provide(Layer.merge(mockInputs({ timeoutSeconds }), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("This request will timeout in 1800 seconds.");
      }).pipe(E.provide(subject));
    });
  });

  describe("integration scenarios", () => {
    it.effect("should work with real template processing for custom body", () => {
      const overrideInputs = { issueBody: "Timeout: {{ timeout-seconds }}s, Actor: {{ actor }}" };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("Timeout: 300s");
        expect(body).toContain("Actor: test-actor");
      }).pipe(E.provide(subject));
    });

    it.effect("should handle complex approval/rejection keyword arrays", () => {
      const overrideInputs = {
        approvalKeywords: ["approved", "lgtm", "✅", "ship it"],
        rejectionKeywords: ["rejected", "nope", "❌", "block"],
      };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("To approve, comment with `approved, lgtm, ✅, ship it`");
        expect(body).toContain(
          "To reject, comment with `rejected, nope, ❌, block` or simply close the issue!",
        );
      }).pipe(E.provide(subject));
    });

    it.effect("should handle GitHub context variables in custom templates", () => {
      // Set up environment variables for GitHub context
      process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
      process.env.GITHUB_ACTOR = "test-actor";

      const overrideInputs = {
        issueBody: "Repository: ${{ github.repository }}, Actor: ${{ github.actor }}",
      };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain("Repository: test-owner/test-repo");
        expect(body).toContain("Actor: test-actor");

        // Clean up
        delete process.env.GITHUB_REPOSITORY;
        delete process.env.GITHUB_ACTOR;
      }).pipe(E.provide(subject));
    });

    it.effect("should process run-url template variable in custom body", () => {
      const overrideInputs = {
        issueBody: "Please review: {{ run-url }} and approve with {{ approval-keywords }}",
      };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        expect(body).toContain(
          "Please review: https://github.com/test-owner/test-repo/actions/runs/12345",
        );
        expect(body).toContain("and approve with approved!, lgtm");
      }).pipe(E.provide(subject));
    });

    it.effect("should combine template variables and GitHub context in default body", () => {
      const overrideInputs = { timeoutSeconds: 600 };
      const deps = Layer.provide(Layer.merge(mockInputs(overrideInputs), mockEnvironment()));
      const subject = ContentService.DefaultWithoutDependencies.pipe(deps);

      return E.gen(function* () {
        const body = yield* ContentService.body;
        // Should process the template variables in the default body
        expect(body).toContain("This request will timeout in 600 seconds.");
        expect(body).toContain("Test Workflow");
        expect(body).toContain("test-job");
        expect(body).toContain("test-action");
      }).pipe(E.provide(subject));
    });
  });
});
