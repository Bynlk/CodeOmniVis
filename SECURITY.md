# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in CodeOmniVis, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

Instead, please email the maintainers directly or use [GitHub's private vulnerability reporting](https://github.com/Bynlk/CodeOmniVis/security/advisories/new).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 1 week
- **Fix release**: depends on severity, typically within 2 weeks

## Security Considerations

CodeOmniVis runs locally and analyzes your source code. It does:

- Read files from your local project directory
- Parse TypeScript/JavaScript source code
- Parse Prisma schema files
- Start a local web server (default: localhost only)

It does NOT:

- Send your code to any external service
- Collect telemetry or analytics
- Modify your source files
- Require network access for analysis
