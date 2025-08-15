# Changelog

## [1.0.0](https://github.com/akefirad/manual-approval-action/commits/v1.0.0) - 2025-08-15

### Added

- Initial stable release of Manual Approval GitHub Action
- Secure approval through GitHub issues with automatic write permission validation
- Configurable timeout with automatic failure handling (default: 60 seconds)
- Fully customizable approval messages with template variable support
- Multiple approval/rejection keywords support
- Fast polling intervals for quick response times (default: 3 seconds)
- Direct links to workflow run for easy context
- Automatic status comments before closing issues for audit trail
- Proper GitHub issue resolution states (`completed` for approved, `not_planned` for
  rejected/timed-out)
- Comprehensive test suite with unit and integration tests
- Support for custom GitHub tokens for automated approvals
- Array formatting support in templates for keywords
- Post-action cleanup to ensure no orphaned issues remain

### Features

- **Approval Methods**:
  - Comment with approval keywords (default: `approved!`)
  - Comment with rejection keywords (customizable)
  - Close issue to reject (when no rejection keywords specified)
- **Issue Resolution**:
  - Approved requests: Posts "✅ Approval Received" comment and closes as `completed`
  - Rejected requests: Posts "❌ Approval Rejected" comment and closes as `not_planned`
  - Timed-out requests: Posts "❌ Approval Timed Out" comment and closes as `not_planned`

- **Template Variables**:
  - `{{ timeout-seconds }}` - The configured timeout
  - `{{ workflow-name }}` - The workflow name
  - `{{ job-id }}` - The job ID
  - `{{ action-id }}` - The action ID
  - `{{ actor }}` - The user who triggered the workflow
  - `{{ approval-keywords }}` - The configured approval keywords
  - `{{ rejection-keywords }}` - The configured rejection keywords
  - `{{ run-url }}` - Direct link to the workflow run
  - Plus all GitHub context variables (e.g., `${{ github.repository }}`)

### Security

- Only users with repository write access can approve or reject
- Comments from users without write access are ignored with debug logging
- Template variables are safely processed to prevent injection attacks
- GitHub context variables are whitelisted to prevent exposure of sensitive data

### Performance

- Default 3-second polling interval balances responsiveness with API usage
- Configurable polling intervals for different use cases
- Efficient API usage with batched operations where possible

### Testing

- Comprehensive unit test coverage for all core functionality
- Live integration tests covering timeout, approval, rejection, and close scenarios
- Each integration test validates workflow outcome, issue state, resolution reason, and comments

### Documentation

- Comprehensive readme with usage examples
- Detailed configuration options
- Troubleshooting guide
- Architecture overview
