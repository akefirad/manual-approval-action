import * as core from "@actions/core";
import type { IGitHubClient } from "../interfaces/github-client.interface.js";
import type { Environment } from "../types/index.js";

export class PermissionChecker {
  constructor(
    private readonly githubClient: IGitHubClient,
    private readonly context: Environment,
  ) {}

  async isApproverAllowed(username: string, allowedApprovers: string[]): Promise<boolean> {
    core.debug(
      `Checking if user ${username} is allowed to approve.` +
        ` Allowed approvers: [${allowedApprovers.join(", ")}]`,
    );

    if (allowedApprovers.includes("anyone")) {
      core.debug(`User ${username} is allowed (anyone can approve)`);
      return true;
    }

    if (allowedApprovers.includes("author") && username === this.context.actor) {
      core.debug(`User ${username} is allowed (is the workflow author: ${this.context.actor})`);
      return true;
    }

    if (allowedApprovers.includes(username)) {
      core.debug(`User ${username} is allowed (explicitly listed)`);
      return true;
    }

    for (const approver of allowedApprovers) {
      if (approver.startsWith("team:")) {
        const teamSlug = approver.substring(5);
        core.debug(`Checking team membership: ${username} in team ${teamSlug}`);
        try {
          const isMember = await this.githubClient.checkTeamMembership(teamSlug, username);
          if (isMember) {
            core.debug(`User ${username} is allowed (member of team ${teamSlug})`);
            return true;
          }
        } catch (error) {
          core.warning(
            `Failed to check team membership for ${username} in team ${teamSlug}: ${error}`,
          );
          // Continue checking other approvers
        }
      }
    }

    if (allowedApprovers.length === 0) {
      core.debug(
        `No explicit approvers configured, checking repository permissions for ${username}`,
      );
      try {
        const hasPermission = await this.githubClient.checkUserPermission(username);
        if (hasPermission) {
          core.debug(`User ${username} is allowed (has repository write permissions)`);
          return true;
        }
      } catch (error) {
        core.warning(`Failed to check repository permissions for ${username}: ${error}`);
        // Fall through to return false
      }
    }

    core.debug(`User ${username} is not in allowed approvers list`);
    return false;
  }
}
