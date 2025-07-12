import * as core from "@actions/core";

// Whitelist of allowed GitHub context variables
const ALLOWED_GITHUB_CONTEXT_VARIABLES = new Set([
  "workflow", // GITHUB_WORKFLOW
  "job", // GITHUB_JOB
  "action", // GITHUB_ACTION
  "actor", // GITHUB_ACTOR
  "repository", // GITHUB_REPOSITORY
  "event_name", // GITHUB_EVENT_NAME
  "ref", // GITHUB_REF
  "sha", // GITHUB_SHA
  "run_id", // GITHUB_RUN_ID
  "run_number", // GITHUB_RUN_NUMBER
  "run_attempt", // GITHUB_RUN_ATTEMPT
  "head_ref", // GITHUB_HEAD_REF
  "base_ref", // GITHUB_BASE_REF
  "server_url", // GITHUB_SERVER_URL
  "api_url", // GITHUB_API_URL
  "graphql_url", // GITHUB_GRAPHQL_URL
]);

function formatArray(array: string[], tags: string[]): string {
  if (!Array.isArray(array) || array.length === 0) {
    return "";
  }

  let items = [...array]; // Create a copy to avoid mutating original

  // Apply code formatting if <code> tag is present
  if (tags.includes("code")) {
    items = items.map((item) => `\`${item}\``);
  }

  // Apply list formatting - ol takes precedence over ul if both are present
  if (tags.includes("ol")) {
    return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  } else if (tags.includes("ul")) {
    return items.map((item) => `- ${item}`).join("\n");
  } else {
    // Default: comma-separated
    return items.join(", ");
  }
}

function processFormattedVariables(
  template: string,
  variables: Record<string, boolean | number | string | string[] | undefined | null>,
): string {
  // Pattern to match {{ ...content... }} where content may include HTML tags and variable name
  const formattedPattern = /{{[\s]*([^}]+)[\s]*}}/g;

  return template.replace(formattedPattern, (match, content) => {
    // Extract variable name - look for kebab-case variable names that aren't inside angle brackets
    const variableMatch = content.match(/([\w-]+)(?![^<]*>)/);
    if (!variableMatch) {
      return match; // Can't find variable name
    }

    const variableName = variableMatch[1].trim();
    const value = variables[variableName];

    if (value === undefined) {
      core.debug(`Template variable not found: ${variableName}`);
      return match; // Return original if variable not found
    }

    // If it's not an array, treat as simple variable
    if (!Array.isArray(value)) {
      core.debug(`Replacing formatted variable (non-array): ${variableName} -> ${value}`);
      return String(value);
    }

    // Extract all opening tags (handle tags with or without attributes)
    const tagMatches = content.match(/<(\w+)(?:\s[^>]*)?>|<(\w+)$/g);
    const tags: string[] = [];
    if (tagMatches) {
      tagMatches.forEach((tag: string) => {
        // Extract just the tag name, ignoring attributes and malformed tags
        const tagNameMatch = tag.match(/<(\w+)/);
        if (tagNameMatch) {
          tags.push(tagNameMatch[1]);
        }
      });
    }

    const formatted = formatArray(value, tags);
    core.debug(
      `Replacing formatted variable (array): ${variableName} with tags [${tags.join(", ")}] -> ${formatted}`,
    );
    return formatted;
  });
}

export function processTemplate(
  template: string,
  variables: Record<string, boolean | number | string | string[] | undefined | null>,
): string {
  core.debug(`Processing template with variables: ${JSON.stringify(variables)}`);
  let result = template;

  // Replace {{ <tag>variable</tag> }} patterns with HTML formatting
  result = processFormattedVariables(result, variables);

  // Replace {{ variable }} patterns
  Object.entries(variables).forEach(([key, value]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    const replacements = result.match(pattern);
    const occurrences = replacements?.length || 0;
    if (replacements) {
      core.debug(`Replacing template variable (${occurrences} occurrences): ${key} -> ${value}`);
      result = result.replace(pattern, String(value));
    }
  });

  // Replace GitHub context variables like ${{ github.workflow }}
  const githubContextPattern = /\${{[\s]*github\.([\w]+)[\s]*}}/g;
  result = result.replace(githubContextPattern, (match, property) => {
    if (!ALLOWED_GITHUB_CONTEXT_VARIABLES.has(property.toLowerCase())) {
      core.warning(`Blocked access to potentially sensitive GitHub context variable: ${property}`);
      return match;
    }

    const envVar = `GITHUB_${property.toUpperCase()}`;
    const value = process.env[envVar] || match;
    core.debug(`Replacing GitHub context variable: ${match} -> ${value}`);
    return value;
  });

  core.debug(`Template processing completed (result length: ${result.length})`);
  return result;
}
