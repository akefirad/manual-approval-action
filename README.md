# Manual Approval GitHub Action

A GitHub Action that pauses workflow execution and waits for manual approval before proceeding.
Perfect for scenarios requiring human review, such as:

- Terraform deployments (review plan before apply)
- Production releases
- Data migrations
- Any workflow requiring manual verification

## Features

- 🔐 Secure approval through GitHub issues with automatic write permission validation
- ⏱️ Configurable timeout with automatic failure handling
- 📝 Fully customizable approval messages with template variable support
- 🚦 Clear approval/rejection status reporting
- 🔄 Automatic issue cleanup after approval/rejection
- 🎯 Fast polling intervals for quick response times
- 🏷️ Support for multiple approval/rejection keywords
- 📍 Direct links to workflow run for easy context

## Quick Start

```yaml
- name: Wait for approval
  uses: radkesvat/manual-approval-action@v1
```

## Inputs

| Input                   | Description                                  | Required | Default               |
| ----------------------- | -------------------------------------------- | -------- | --------------------- |
| `github-token`          | GitHub token for API access                  | No       | `${{ github.token }}` |
| `timeout-seconds`       | Time to wait for approval in seconds         | No       | `60`                  |
| `poll-interval-seconds` | How often to check for comments in seconds   | No       | `3`                   |
| `approval-keywords`     | Keywords that trigger approval               | No       | `approved!`           |
| `rejections-keywords`   | Keywords that trigger rejection              | No       | (empty - close issue) |
| `fail-on-rejection`     | Fail the job if explicitly rejected          | No       | `true`                |
| `fail-on-timeout`       | Fail the job if timed out                    | No       | `true`                |
| `issue-title`           | Title for the approval issue                 | No       | See below             |
| `issue-body`            | Body content or file path for approval issue | No       | See below             |

### Default Values

**`issue-title`**:

```markdown
Approval Request: {workflow} - {job} - {action}
```

**`issue-body`**:

```markdown
**Manual approval required:** [`{workflow}`/`{job}`/`{action}`]({run_url}) ✅ To approve, comment
with `approved!` ❌ To reject, simply close the issue!

This request will timeout in {timeout} seconds.
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
    uses: radkesvat/manual-approval-action@v1
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      timeout-seconds: 600 # 10 minutes

  - name: Apply changes
    run: terraform apply tfplan
```

### Basic Approval with Custom Keywords

```yaml
- name: Production deployment approval
  uses: radkesvat/manual-approval-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    approval-keywords: "deploy,approved!"
    rejections-keywords: "cancel,reject!"
    timeout-seconds: 1800 # 30 minutes
```

### Fast Polling for Quick Response

```yaml
- name: Quick approval check
  uses: radkesvat/manual-approval-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    poll-interval-seconds: 1 # Check every second for faster response
    timeout-seconds: 300
```

### Custom Approval Message with Template Variables

```yaml
- name: Database migration approval
  uses: radkesvat/manual-approval-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    issue-title: "⚠️ Database Migration Approval Required"
    issue-body: |
      ## Database Migration Details

      **Environment**: Production
      **Workflow**: {{ workflow }}
      **Actor**: {{ actor }}
      **Migration**: Add user_preferences table
      **Estimated downtime**: 5 minutes

      Please review the migration script and respond with:
      - `approved!` to approve the migration
      - `reject!` to cancel

      ⏰ This request will timeout in {{ timeout-seconds }} seconds.
    timeout-seconds: 900
```

#### Available Template Variables

- `{{ timeout-seconds }}` - The configured timeout in seconds
- `{{ workflow }}` - The workflow name
- `{{ job-id }}` - The job ID
- `{{ action-id }}` - The action ID
- `{{ actor }}` - The user who triggered the workflow
- `{{ approval-keywords }}` - The configured approval keywords
- `{{ rejection-keywords }}` - The configured rejection keywords

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
  uses: radkesvat/manual-approval-action@v1
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
  uses: radkesvat/manual-approval-action@v1
  id: approval
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
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

4. **Cleanup**:
   - Issues are automatically closed after approval, rejection, or timeout
   - The post-action cleanup ensures no orphaned issues remain

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

## Advanced Usage

### Using with Matrix Builds

```yaml
strategy:
  matrix:
    environment: [staging, production]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Approval for ${{ matrix.environment }}
        uses: radkesvat/manual-approval-action@v1
        with:
          issue-title: "Deploy to ${{ matrix.environment }} approval"
          issue-body: |
            Requesting approval to deploy to **${{ matrix.environment }}**

            Workflow: {{ workflow }}
            Triggered by: {{ actor }}
```

### Integrating with Slack/Teams Notifications

```yaml
- name: Request approval
  id: approval
  uses: radkesvat/manual-approval-action@v1

- name: Send Slack notification
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -H 'Content-type: application/json' \
      -d '{"text":"Approval needed: ${{ steps.approval.outputs.issue-url }}"}'
```

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

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the action
npm run build

# Run linting
npm run lint

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
