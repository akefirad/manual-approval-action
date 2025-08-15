# Manual Approval GitHub Action

A GitHub Action that pauses workflow execution and waits for manual approval before proceeding.
Perfect for scenarios requiring human review, such as Terraform deployments (review plan before
apply), or any workflow requiring manual verification.

## Features

- 🔐 Secure approval through GitHub issues with automatic write permission validation
- ⏱️ Configurable timeout with automatic failure handling
- 📝 Fully customizable approval messages with template variable support
- 🚦 Clear approval/rejection status reporting with proper GitHub issue states
- 💬 Automatic status comments before closing issues for audit trail
- 🔄 Automatic issue cleanup with appropriate resolution states (completed/not_planned)
- 🎯 Fast polling intervals for quick response times
- 🏷️ Support for multiple approval/rejection keywords
- 📍 Direct links to workflow run for easy context

## Quick Start

```yaml
- name: Wait for approval
  uses: akefirad/manual-approval-action@main
```

## Inputs

| Input                   | Description                                | Required | Default               |
| ----------------------- | ------------------------------------------ | -------- | --------------------- |
| `github-token`          | GitHub token for API access                | No       | `${{ github.token }}` |
| `timeout-seconds`       | Time to wait for approval in seconds       | No       | `60`                  |
| `poll-interval-seconds` | How often to check for comments in seconds | No       | `3`                   |
| `approval-keywords`     | Keywords that trigger approval             | No       | `approved!`           |
| `rejections-keywords`   | Keywords that trigger rejection            | No       | (empty - close issue) |
| `fail-on-rejection`     | Fail the job if explicitly rejected        | No       | `true`                |
| `fail-on-timeout`       | Fail the job if timed out                  | No       | `true`                |
| `issue-title`           | Title for the approval issue               | No       | See below             |
| `issue-body`            | Body content for approval issue            | No       | See below             |

### Default Values

**`issue-title`**:

```markdown
Approval Request: {{ workflow-name }}/{{ job-id }}/{{ action-id }}
```

**`issue-body`**:

```markdown
**Manual approval required:** [`{{ workflow-id }}`/`{{ job-id }}`/`{{ action-id }}`]({{ run-url }})
✅ To approve, comment with `approved!` ❌ To reject, simply close the issue!

This request will timeout in {{ timeout-seconds }} seconds.
```

Note: If no rejection keywords are specified, users can reject by simply closing the issue.

## Outputs

| Output      | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| `status`    | Result of the approval process: `approved`, `rejected`, or `timed-out` |
| `approvers` | Comma-separated list of users who approved                             |
| `issue-url` | URL of the issue used for approval                                     |

## Usage Examples

### Basic Approval

```yaml
steps:
  - name: Deploy to staging
    run: terraform plan -out=tfplan

  - name: Wait for approval
    uses: akefirad/manual-approval-action@main

  - name: Apply changes
    run: terraform apply tfplan
```

### Basic Approval with Custom Keywords

```yaml
- name: Production deployment approval
  uses: akefirad/manual-approval-action@main
  with:
    approval-keywords: "deploy,approved!"
    rejections-keywords: "cancel,reject!"
```

### Fast Polling for Quick Response

```yaml
- name: Quick approval check
  uses: akefirad/manual-approval-action@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    poll-interval-seconds: 1
    timeout-seconds: 300
```

### Custom Approval Message with Template Variables

```yaml
- name: Database migration approval
  uses: akefirad/manual-approval-action@main
  with:
    timeout-seconds: 900
    issue-title: "⚠️ Database Migration Approval Required"
    issue-body: |
      ## Database Migration Details

      **Environment**: Production
      **Workflow**: {{ workflow-name }}
      **Migration**: Add user_preferences table
      **Estimated downtime**: 5 minutes

      Please review the migration script and respond with:
      - `approved!` to approve the migration
      - `reject!` to cancel

      ⏰ This request will timeout in {{ timeout-seconds }} seconds.
```

#### Available Template Variables

- `{{ timeout-seconds }}` - The configured timeout in seconds
- `{{ workflow-name }}` - The workflow name
- `{{ job-id }}` - The job ID
- `{{ action-id }}` - The action ID
- `{{ actor }}` - The user who triggered the workflow
- `{{ approval-keywords }}` - The configured approval keywords
- `{{ rejection-keywords }}` - The configured rejection keywords
- `{{ run-url }}` - The configured rejection keywords

You can also use GitHub context variables:

- `${{ github.repository }}` - The repository name (owner/repository)
- `${{ github.run_id }}` - The workflow run ID
- `${{ github.run_number }}` - The workflow run number
- `${{ github.actor }}` - The user who triggered the workflow
- `${{ github.sha }}` - The commit SHA
- And more
  [GitHub context variables](https://docs.github.com/en/actions/learn-github-actions/contexts#github-context)

### Advanced: Array Formatting in Templates

When using approval/rejection keywords in templates, you can format them as lists:

```yaml
- name: Formatted approval
  uses: akefirad/manual-approval-action@main
  with:
    approval-keywords: "approve,lgtm,ship it"
    issue-body: |
      Please review and approve by commenting with one of:
      <ul>{{ approval-keywords }}</ul>
```

This will render as:

```markdown
Please review and approve by commenting with one of:

- approve
- lgtm
- ship it
```

### Conditional Failure Handling

```yaml
- name: Optional approval
  uses: akefirad/manual-approval-action@main
  id: approval
  with:
    fail-on-timeout: false
    fail-on-rejection: true

- name: Handle approval result
  if: steps.approval.outputs.status == 'approved'
  run: echo "Deployment approved by ${{ steps.approval.outputs.approvers }}"

- name: Handle rejection
  if: steps.approval.outputs.status == 'rejected'
  run: echo "Deployment was rejected"

- name: Handle timeout
  if: steps.approval.outputs.status == 'timed-out'
  run: echo "Approval timed out"
```

### Explicit Rejection Mode (Implicit Approval)

By default, the action uses "explicit approval" mode where approval must be actively given and
timeouts are treated as failures. You can configure "explicit rejection" mode where the workflow
continues unless explicitly rejected:

```yaml
- name: Deploy unless explicitly rejected
  uses: akefirad/manual-approval-action@main
  id: approval
  with:
    fail-on-timeout: false # Don't fail on timeout (implicit approval)
    fail-on-rejection: true # Only fail on explicit rejection
    timeout-seconds: 300
    rejections-keywords: "stop,reject,cancel"
    issue-body: |
      ## Deployment Notification

      Deployment to production will proceed automatically in {{ timeout-seconds }} seconds.

      To **stop** the deployment, comment with one of: {{ rejection-keywords }}

      If no rejection is received, deployment will continue.

- name: Deploy application
  if: steps.approval.outputs.status != 'rejected'
  run: |
    echo "Deploying (status: ${{ steps.approval.outputs.status }})"
    # Deployment continues for both 'approved' and 'timed-out' statuses
```

In this mode:

- **Timeout**: Issue is closed as `completed` (workflow continues)
- **Rejection**: Issue is closed as `not_planned` (workflow fails)
- **Approval**: Issue is closed as `completed` (workflow continues)

This pattern is useful for:

- Notification-style deployments that proceed unless stopped
- Scheduled maintenance windows with opt-out capability
- Automated processes that only need intervention in exceptional cases

## How It Works

1. **Approval Process**:
   - Action creates a new issue with approval instructions
   - Issue includes a direct link to the workflow run for context
   - Continuously polls for new comments at the specified interval (default: every 3 seconds)
   - Monitors for approval and rejection keywords in comments (case-insensitive)
   - Validates that the approver has repository write access
   - Continues or fails based on response and configuration

2. **Rejection**:
   - Closing the issue triggers immediate rejection (even without keywords)
   - Any comment containing rejection keywords also triggers rejection
   - Workflow fails if `fail-on-rejection` is true

3. **Timeout**:
   - Action fails after specified timeout if `fail-on-timeout` is true
   - Otherwise, returns `timed-out` status

4. **Issue Resolution & Cleanup**:
   - **Approved**: Posts "✅ Approval Received" comment and closes issue as `completed`
   - **Rejected**: Posts "❌ Approval Rejected" comment and closes issue as:
     - `not_planned` if `fail-on-rejection` is true (workflow fails)
     - `completed` if `fail-on-rejection` is false (workflow continues)
   - **Timed Out**: Posts "❌ Approval Timed Out" comment and closes issue as:
     - `not_planned` if `fail-on-timeout` is true (workflow fails)
     - `completed` if `fail-on-timeout` is false (workflow continues)
   - The post-action cleanup ensures no orphaned issues remain
   - All actions leave a clear audit trail via comments before closing

## Performance Considerations

- **Polling Interval**: Lower `poll-interval-seconds` values provide faster response times but
  consume more GitHub API quota
- **Default Setting**: The default 3-second interval balances responsiveness with API usage
- **Recommendations**:
  - Use 5-10 seconds for standard workflows
  - Use 30+ seconds for long-running processes where immediate response isn't critical

## Security Considerations

- The action uses the provided GitHub token's permissions
- Issue creation and write permissions are required
- Only users with repository write access can approve or reject
- Comments from users without write access are ignored with debug logging
- Template variables are safely processed to prevent injection attacks
- GitHub context variables are whitelisted to prevent exposure of sensitive data
- Consider using environments and protection rules for additional security

## Architecture

The action is built with a clean, modular architecture:

- **Factory Pattern**: `ApprovalServiceFactory` creates approval requests with proper initialization
- **Service Layer**: Separated concerns for GitHub API, content generation, and approval logic
- **Template Engine**: Safe variable substitution with support for arrays and GitHub context
- **Robust Error Handling**: Graceful handling of API errors and edge cases

## Troubleshooting

### Common Issues

**Issue**: "Permission denied" or API errors

- **Solution**: Ensure the GitHub token has sufficient permissions (issues:write, repository:read)
- For organization repositories, check if issues are enabled

**Issue**: Comments not being detected

- **Solution**: Verify the keywords are spelled correctly and check polling interval
- Ensure the commenter has repository write access

**Issue**: Action timing out unexpectedly

- **Solution**: Check GitHub API rate limits and consider increasing poll interval
- Verify the timeout value is appropriate for your use case

**Issue**: Template variables not being replaced

- **Solution**: Use double curly braces `{{ variable }}` for action variables
- Use `${{ github.context }}` for GitHub context variables

### Debugging

Enable debug logging in your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

This will show detailed logs including:

- Template variable processing
- Comment evaluation
- Permission checks

## Testing

The action includes comprehensive test coverage with both unit and integration tests.

### Unit Tests

Unit tests cover all core functionality including approval logic, GitHub API interactions, template
processing, and permission validation. Run with:

```bash
npm test
```

### Integration Tests

The CI/CD pipeline includes live integration tests that verify the action works correctly with real
GitHub issues. These tests cover four key scenarios:

1. **Timeout Test**: Verifies that issues are closed as `not_planned` with a timeout comment when no
   response is received
2. **Approval Test**: Verifies that issues are closed as `completed` with an approval comment when
   approved
3. **Rejection Test**: Verifies that issues are closed as `not_planned` with a rejection comment
   when explicitly rejected
4. **Close Test**: Verifies that closing an issue without keywords treats it as rejection

Each integration test validates:

- Correct workflow outcome (success/failure)
- Proper issue state (`closed`)
- Correct resolution reason (`completed` or `not_planned`)
- Presence of appropriate status comment

### Running Tests Locally

```bash
# Run unit tests with coverage
npm test

# Run integration tests locally (requires act)
npm run test:int

# Run all checks (lint, format, tests)
npm run pre-push
```

## Development

```bash
# Install dependencies
npm install

# Build the action
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Run tests in watch mode
npm run test:watch
```

## Acknowledgments

This action is heavily inspired by
[trstringer/manual-approval](https://github.com/trstringer/manual-approval).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
