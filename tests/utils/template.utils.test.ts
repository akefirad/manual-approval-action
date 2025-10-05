import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create mock functions
const mockDebug = vi.fn<(message: string) => void>();
const mockWarning = vi.fn<(message: string) => void>();

// Mock @actions/core using vi.mock for ESM
vi.mock("@actions/core", () => ({
  debug: mockDebug,
  warning: mockWarning,
}));

// Import the utility after mocking
const { processTemplate } = await import("../../src/utils/template.utils.js");

describe("template.utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.GITHUB_WORKFLOW;
    delete process.env.GITHUB_JOB;
    delete process.env.GITHUB_ACTION;
    delete process.env.GITHUB_ACTOR;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_RUN_NUMBER;
    delete process.env.GITHUB_RUN_ATTEMPT;
    delete process.env.GITHUB_HEAD_REF;
    delete process.env.GITHUB_BASE_REF;
    delete process.env.GITHUB_SERVER_URL;
    delete process.env.GITHUB_API_URL;
    delete process.env.GITHUB_GRAPHQL_URL;
    // Clean up potentially sensitive vars used in security tests
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_SECRET;
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.GITHUB_PATH;
    delete process.env.GITHUB_ENV;
    delete process.env.GITHUB_STEP_SUMMARY;
  });

  describe("processTemplate", () => {
    it("should replace simple template variables", () => {
      const template = "Hello {{ name }}, welcome to {{ project }}!";
      const variables = { name: "John", project: "MyApp" };

      const result = processTemplate(template, variables);

      expect(result).toBe("Hello John, welcome to MyApp!");
    });

    it("should handle template variables with whitespace", () => {
      const template = "{{ name }}, {{   timeout-seconds   }}, {{job}}";
      const variables = { name: "test", "timeout-seconds": 60, job: "build" };

      const result = processTemplate(template, variables);

      expect(result).toBe("test, 60, build");
    });

    it("should replace multiple occurrences of the same variable", () => {
      const template = "{{ name }} says hello to {{ name }} again!";
      const variables = { name: "Alice" };

      const result = processTemplate(template, variables);

      expect(result).toBe("Alice says hello to Alice again!");
    });

    it("should convert non-string values to strings", () => {
      const template = "Count: {{ count }}, Active: {{ active }}, Price: {{ price }}";
      const variables = { count: 42, active: true, price: 19.99 };

      const result = processTemplate(template, variables);

      expect(result).toBe("Count: 42, Active: true, Price: 19.99");
    });

    it("should handle empty template", () => {
      const template = "";
      const variables = { name: "test" };

      const result = processTemplate(template, variables);

      expect(result).toBe("");
    });

    it("should handle empty variables", () => {
      const template = "Hello {{ name }}!";
      const variables = {};

      const result = processTemplate(template, variables);

      expect(result).toBe("Hello {{ name }}!");
    });

    it("should handle template with no variables", () => {
      const template = "This is a plain string with no variables.";
      const variables = { name: "test" };

      const result = processTemplate(template, variables);

      expect(result).toBe("This is a plain string with no variables.");
    });

    it("should replace GitHub context variables from environment", () => {
      process.env.GITHUB_WORKFLOW = "CI";
      process.env.GITHUB_JOB = "test";
      process.env.GITHUB_ACTOR = "testuser";

      const template =
        "Workflow: ${{ github.workflow }}, Job: ${{ github.job }}, Actor: ${{ github.actor }}";
      const variables = {};

      const result = processTemplate(template, variables);

      expect(result).toBe("Workflow: CI, Job: test, Actor: testuser");
    });

    it("should handle GitHub context variables with whitespace", () => {
      process.env.GITHUB_WORKFLOW = "Build";

      const template = "${{github.workflow}}, ${{ github.workflow }}, ${{   github.workflow   }}";
      const variables = {};

      const result = processTemplate(template, variables);

      expect(result).toBe("Build, Build, Build");
    });

    it("should leave unknown GitHub context variables unchanged", () => {
      const template = "Unknown: ${{ github.unknown }}";
      const variables = {};

      const result = processTemplate(template, variables);

      expect(result).toBe("Unknown: ${{ github.unknown }}");
    });

    it("should handle mixed template and GitHub context variables", () => {
      process.env.GITHUB_WORKFLOW = "CI";

      const template = "{{ title }} for ${{ github.workflow }} - timeout: {{ timeout-seconds }}s";
      const variables = { title: "Approval", "timeout-seconds": 300 };

      const result = processTemplate(template, variables);

      expect(result).toBe("Approval for CI - timeout: 300s");
    });

    it("should handle complex nested patterns", () => {
      const template = "{{ prefix }}{{ name }}{{ suffix }}";
      const variables = { prefix: "[", name: "test", suffix: "]" };

      const result = processTemplate(template, variables);

      expect(result).toBe("[test]");
    });

    it("should handle variables with special regex characters", () => {
      const template = "Value: {{ special }}";
      const variables = { special: "$100 (20% off)" };

      const result = processTemplate(template, variables);

      expect(result).toBe("Value: $100 (20% off)");
    });

    it("should handle null and undefined variables", () => {
      const template = "Null: {{ null-var }}, Undefined: {{ undefined-var }}";
      const variables = { "null-var": null, "undefined-var": undefined };

      const result = processTemplate(template, variables);

      expect(result).toBe("Null: null, Undefined: undefined");
    });

    it("should handle case sensitivity in GitHub context variables", () => {
      process.env.GITHUB_REPOSITORY = "owner/repo";

      const template = "Repo: ${{ github.repository }}, REPO: ${{ github.REPOSITORY }}";
      const variables = {};

      const result = processTemplate(template, variables);

      // Both should resolve to the same env var (GITHUB_REPOSITORY)
      expect(result).toBe("Repo: owner/repo, REPO: owner/repo");
    });

    it("should process template variables with quoted content", () => {
      const template = "{{ 'literal {{ value }}' }}";
      const variables = { "'literal {{ value }}'": "resolved" };

      const result = processTemplate(template, variables);

      // Template variables work with quoted keys if defined in variables
      expect(result).toBe("resolved");
    });

    it("should preserve literal dollar signs that are not part of GitHub patterns", () => {
      process.env.GITHUB_WORKFLOW = "test";

      const template = "Price: $100, Variable: ${{ github.workflow }}";
      const variables = {};

      const result = processTemplate(template, variables);

      // Literal $ not followed by {{ is preserved
      expect(result).toBe("Price: $100, Variable: test");
    });

    it("should leave malformed GitHub patterns unchanged", () => {
      const template = "Malformed: ${{ github.workflow, Missing: ${{ github.job }";
      const variables = {};
      process.env.GITHUB_WORKFLOW = "test";
      process.env.GITHUB_JOB = "build";

      const result = processTemplate(template, variables);

      // Malformed patterns (missing closing }}) are left unchanged
      expect(result).toBe("Malformed: ${{ github.workflow, Missing: ${{ github.job }");
    });

    it("should fallback to original pattern when GitHub environment variable is not set", () => {
      // Ensure the env var is NOT set
      delete process.env.GITHUB_WORKFLOW;

      const template = "Workflow: ${{ github.workflow }}";
      const variables = {};

      const result = processTemplate(template, variables);

      // Should fallback to the original pattern since env var is not set
      expect(result).toBe("Workflow: ${{ github.workflow }}");
    });

    describe("escaping behavior, not implemented", () => {
      it.fails("should handle quoted GitHub variables by NOT processing inner expressions", () => {
        process.env.GITHUB_JOB = "test-job";

        // This is the specific case mentioned: ${{ '${{ github.job }}' }}
        // EXPECTED: The quoted inner expression should NOT be processed
        const template = "${{ '${{ github.job }}' }}";
        const variables = {};

        const result = processTemplate(template, variables);

        // EXPECTED: The inner expression should remain literal and the outer should resolve to the literal string
        expect(result).toBe("${{ github.job }}");
      });

      it.fails("should respect quotes in nested expressions", () => {
        process.env.GITHUB_WORKFLOW = "CI";
        process.env.GITHUB_JOB = "build";

        const template = "Outer: ${{ github.workflow }}, Inner: ${{ '${{ github.job }}' }}";
        const variables = {};

        const result = processTemplate(template, variables);

        // EXPECTED: The outer GitHub variable resolves normally
        // The inner quoted expression should output the literal string
        expect(result).toBe("Outer: CI, Inner: ${{ github.job }}");
      });

      it.fails("should support backslash escaping", () => {
        process.env.GITHUB_WORKFLOW = "test";

        const template = "Escaped: \\${{ github.workflow }}, Normal: ${{ github.workflow }}";
        const variables = {};

        const result = processTemplate(template, variables);

        // EXPECTED: Backslash should escape the pattern, preventing processing
        expect(result).toBe("Escaped: ${{ github.workflow }}, Normal: test");
      });

      it.fails("should support escaping to show literal GitHub variable syntax", () => {
        process.env.GITHUB_REPOSITORY = "owner/repo";

        // EXPECTED: Should be able to escape to show the literal syntax
        const template = "I want to show: \\${{ github.repository }} literally";
        const variables = {};

        const result = processTemplate(template, variables);

        // EXPECTED: Escaped pattern should remain literal
        expect(result).toBe("I want to show: ${{ github.repository }} literally");
      });

      it.fails("should support escaping regular template variables", () => {
        const template = "Escaped: \\{{ name }}, Normal: {{ name }}";
        const variables = { name: "John" };

        const result = processTemplate(template, variables);

        // EXPECTED: Escaped pattern should remain literal
        expect(result).toBe("Escaped: {{ name }}, Normal: John");
      });

      it.fails("should handle double escaping", () => {
        process.env.GITHUB_WORKFLOW = "test";

        const template = "Double: \\\\${{ github.workflow }}, Single: \\${{ github.workflow }}";
        const variables = {};

        const result = processTemplate(template, variables);

        // EXPECTED: Double backslash should result in literal backslash followed by processed variable
        // Single backslash should escape the pattern
        expect(result).toBe("Double: \\test, Single: ${{ github.workflow }}");
      });
    });

    describe("security - GitHub context variable whitelist", () => {
      it("should allow whitelisted GitHub context variables", () => {
        process.env.GITHUB_WORKFLOW = "test-workflow";
        process.env.GITHUB_JOB = "test-job";
        process.env.GITHUB_ACTOR = "test-actor";

        const template =
          "Workflow: ${{ github.workflow }}, Job: ${{ github.job }}, Actor: ${{ github.actor }}";
        const variables = {};

        const result = processTemplate(template, variables);

        expect(result).toBe("Workflow: test-workflow, Job: test-job, Actor: test-actor");
      });

      it("should block non-whitelisted GitHub context variables", () => {
        process.env.GITHUB_TOKEN = "secret-token";
        process.env.GITHUB_SECRET = "secret-value";

        const template = "Token: ${{ github.token }}, Secret: ${{ github.secret }}";
        const variables = {};

        const result = processTemplate(template, variables);

        expect(result).toBe("Token: ${{ github.token }}, Secret: ${{ github.secret }}");
      });

      it("should handle case-insensitive blocking", () => {
        process.env.GITHUB_TOKEN = "secret-token";

        const template = "Token: ${{ github.TOKEN }}, Token2: ${{ github.Token }}";
        const variables = {};

        const result = processTemplate(template, variables);

        expect(result).toBe("Token: ${{ github.TOKEN }}, Token2: ${{ github.Token }}");
      });

      it("should block common sensitive environment variables", () => {
        process.env.GITHUB_TOKEN = "ghp_secret";
        process.env.GITHUB_APP_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----";
        process.env.GITHUB_CLIENT_SECRET = "client-secret";

        const template =
          "App: ${{ github.token }}, Key: ${{ github.app_private_key }}, Client: ${{ github.client_secret }}";
        const variables = {};

        const result = processTemplate(template, variables);

        // All should be blocked
        expect(result).toBe(
          "App: ${{ github.token }}, Key: ${{ github.app_private_key }}, Client: ${{ github.client_secret }}",
        );
      });

      it("should allow all standard GitHub Actions context variables", () => {
        process.env.GITHUB_WORKFLOW = "CI";
        process.env.GITHUB_JOB = "test";
        process.env.GITHUB_ACTOR = "user";
        process.env.GITHUB_ACTION = "test-action";
        process.env.GITHUB_REPOSITORY = "owner/repo";
        process.env.GITHUB_EVENT_NAME = "push";
        process.env.GITHUB_REF = "refs/heads/main";
        process.env.GITHUB_SHA = "abc123";
        process.env.GITHUB_RUN_ID = "123";
        process.env.GITHUB_RUN_NUMBER = "1";
        process.env.GITHUB_RUN_ATTEMPT = "1";
        process.env.GITHUB_HEAD_REF = "feature";
        process.env.GITHUB_BASE_REF = "main";
        process.env.GITHUB_SERVER_URL = "https://github.com";
        process.env.GITHUB_API_URL = "https://api.github.com";
        process.env.GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

        const template = [
          "Workflow: ${{ github.workflow }}",
          "Job: ${{ github.job }}",
          "Actor: ${{ github.actor }}",
          "Action: ${{ github.action }}",
          "Repository: ${{ github.repository }}",
          "Event: ${{ github.event_name }}",
          "Ref: ${{ github.ref }}",
          "SHA: ${{ github.sha }}",
          "Run ID: ${{ github.run_id }}",
          "Run Number: ${{ github.run_number }}",
          "Run Attempt: ${{ github.run_attempt }}",
          "Head Ref: ${{ github.head_ref }}",
          "Base Ref: ${{ github.base_ref }}",
          "Server: ${{ github.server_url }}",
          "API: ${{ github.api_url }}",
          "GraphQL: ${{ github.graphql_url }}",
        ].join("\n          ");
        const variables = {};

        const result = processTemplate(template, variables);

        // Should contain all resolved values, no warnings
        expect(result).toContain("Workflow: CI");
        expect(result).toContain("Job: test");
        expect(result).toContain("Actor: user");
        expect(result).toContain("Action: test-action");
        expect(result).toContain("Repository: owner/repo");
        expect(result).toContain("Event: push");
        expect(result).toContain("Ref: refs/heads/main");
        expect(result).toContain("SHA: abc123");
        expect(result).toContain("Run ID: 123");
        expect(result).toContain("Run Number: 1");
        expect(result).toContain("Run Attempt: 1");
        expect(result).toContain("Head Ref: feature");
        expect(result).toContain("Base Ref: main");
        expect(result).toContain("Server: https://github.com");
        expect(result).toContain("API: https://api.github.com");
        expect(result).toContain("GraphQL: https://api.github.com/graphql");
      });
    });

    describe("array formatting with HTML tags", () => {
      it("should format arrays with basic comma separation", () => {
        const template = "Keywords: {{ approval-keywords }}";
        const variables = { "approval-keywords": ["approved!", "LGTM", "🚀"] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Keywords: approved!, LGTM, 🚀");
      });

      it("should format arrays with code tags", () => {
        const template = "Keywords: {{ <code>approval-keywords</code> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM", "🚀"] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Keywords: `approved!`, `LGTM`, `🚀`");
      });

      it("should format arrays with unordered list tags", () => {
        const template = "Keywords:\n{{ <ul>approval-keywords</ul> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM", "🚀"] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Keywords:\n- approved!\n- LGTM\n- 🚀");
      });

      it("should format arrays with ordered list tags", () => {
        const template = "Keywords:\n{{ <ol>rejection-keywords</ol> }}";
        const variables = { "rejection-keywords": ["reject!", "deny", "cancel"] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Keywords:\n1. reject!\n2. deny\n3. cancel");
      });

      it("should combine code and unordered list tags", () => {
        const template = "Please respond with:\n{{ <ul><code>approval-keywords</code></ul> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM", "🚀"] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Please respond with:\n- `approved!`\n- `LGTM`\n- `🚀`");
      });

      it("should combine code and ordered list tags", () => {
        const template = "Options:\n{{ <ol><code>rejection-keywords</code></ol> }}";
        const variables = { "rejection-keywords": ["reject!", "deny", "cancel"] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Options:\n1. `reject!`\n2. `deny`\n3. `cancel`");
      });

      it("should handle kebab-case variable names", () => {
        const template =
          "{{ <code>approval-keywords</code> }} or {{ <code>rejection-keywords</code> }}";
        const variables = {
          "approval-keywords": ["approved!", "LGTM"],
          "rejection-keywords": ["reject!", "deny"],
        };

        const result = processTemplate(template, variables);

        expect(result).toBe("`approved!`, `LGTM` or `reject!`, `deny`");
      });

      it("should handle empty arrays gracefully", () => {
        const template = "Keywords: {{ <ul>approval-keywords</ul> }}";
        const variables = { "approval-keywords": [] };

        const result = processTemplate(template, variables);

        expect(result).toBe("Keywords: ");
      });

      it("should handle non-array variables in formatted templates", () => {
        const template = "Timeout: {{ <code>timeout</code> }} seconds";
        const variables = { timeout: 300 };

        const result = processTemplate(template, variables);

        expect(result).toBe("Timeout: 300 seconds");
      });

      it("should handle unknown variables in formatted templates", () => {
        const template = "Unknown: {{ <ul>unknown-var</ul> }}";
        const variables = {};

        const result = processTemplate(template, variables);

        expect(result).toBe("Unknown: {{ <ul>unknown-var</ul> }}");
      });

      it("should handle malformed HTML tags gracefully", () => {
        const template = "Keywords: {{ <invalid>approval-keywords</invalid> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since 'invalid' is not recognized
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should work with mixed regular and formatted variables", () => {
        const template =
          "Workflow: {{ workflow }}, Keywords: {{ <code>approval-keywords</code> }}, Timeout: {{ timeout-seconds }}s";
        const variables = {
          workflow: "CI",
          "approval-keywords": ["approved!", "LGTM"],
          "timeout-seconds": 300,
        };

        const result = processTemplate(template, variables);

        expect(result).toBe("Workflow: CI, Keywords: `approved!`, `LGTM`, Timeout: 300s");
      });
    });

    describe("malformed HTML tags handling", () => {
      it("should handle unclosed opening tags", () => {
        const template = "Keywords: {{ <code>approval-keywords }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should apply code formatting even without closing tag
        expect(result).toBe("Keywords: `approved!`, `LGTM`");
      });

      it("should handle missing opening bracket", () => {
        const template = "Keywords: {{ code>approval-keywords</code> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since tag is malformed
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should handle missing closing bracket", () => {
        const template = "Keywords: {{ <code approval-keywords</code> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should leave template unchanged since tag is too malformed to parse
        expect(result).toBe("Keywords: {{ <code approval-keywords</code> }}");
      });

      it("should handle mismatched opening and closing tags", () => {
        const template = "Keywords: {{ <ul>approval-keywords</code> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should apply ul formatting since opening tag is recognized
        expect(result).toBe("Keywords: - approved!\n- LGTM");
      });

      it("should handle empty tags", () => {
        const template = "Keywords: {{ <>approval-keywords</> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since tags are empty
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should handle self-closing tags", () => {
        const template = "Keywords: {{ <code/>approval-keywords }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since self-closing isn't supported
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should handle nested unclosed tags", () => {
        const template = "Keywords: {{ <ul><code>approval-keywords }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should apply both ul and code formatting even without closing tags
        expect(result).toBe("Keywords: - `approved!`\n- `LGTM`");
      });

      it("should handle tags with attributes", () => {
        const template = 'Keywords: {{ <ul class="list">approval-keywords</ul> }}';
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should ignore attributes and apply ul formatting
        expect(result).toBe("Keywords: - approved!\n- LGTM");
      });

      it("should handle extra spaces in tags", () => {
        const template = "Keywords: {{ < ul >< code >approval-keywords</ code ></ ul > }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since tags have spaces
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should handle multiple consecutive opening tags without closing", () => {
        const template = "Keywords: {{ <ul><ol><code>approval-keywords }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should apply ol formatting (later list tag wins) with code
        expect(result).toBe("Keywords: 1. `approved!`\n2. `LGTM`");
      });

      it("should handle completely broken template syntax", () => {
        const template = "Keywords: {{ <<>>approval-keywords<<>> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should handle variable name mixed with broken tags", () => {
        const template = "Keywords: {{ <code approval-keywords code> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should not find variable name and leave template unchanged
        expect(result).toBe("Keywords: {{ <code approval-keywords code> }}");
      });

      it("should handle very long malformed tag names", () => {
        const template = "Keywords: {{ <verylongtagname>approval-keywords</anotherlongtagname> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since tags aren't recognized
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should handle special characters in tag names", () => {
        const template = "Keywords: {{ <code-123>approval-keywords</code-123> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should fall back to comma-separated since tags have special chars
        expect(result).toBe("Keywords: approved!, LGTM");
      });

      it("should leave unchanged when no variable name can be extracted", () => {
        const template = "Keywords: {{ <ul><code></code></ul> }}";
        const variables = { "approval-keywords": ["approved!", "LGTM"] };

        const result = processTemplate(template, variables);

        // Should leave template unchanged since no variable name found
        expect(result).toBe("Keywords: {{ <ul><code></code></ul> }}");
      });
    });
  });
});
