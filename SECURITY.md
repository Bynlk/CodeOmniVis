# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in CodeOmniVis, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

Use [GitHub's private vulnerability reporting](https://github.com/Bynlk/CodeOmniVis/security/advisories/new) so reports and follow-up stay private.

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

### Local analysis boundary

CodeOmniVis is local-first. The analyzer, `sql.js` graph database, browser workbench, CLI/REST surfaces, and stdio MCP server run on your machine. Core analysis does not require a hosted CodeOmniVis service.

The current source surface includes TypeScript/JavaScript parsers for Next.js, React, tRPC, Express, NestJS, TSRPC, Prisma, TypeORM, and Drizzle; experimental Kotlin parsing covers Spring, Ktor, Room, and Exposed. Static test intelligence recognizes Vitest, Jest, Playwright, Cypress, JUnit 4/5, and Kotest sources.

During analysis CodeOmniVis may:

- Read supported source, schema, configuration, and test files under the selected project root
- Parse source into a local architecture snapshot
- Start a web server that binds to loopback by default

Core analysis does not:

- Upload source code to a CodeOmniVis service
- Collect telemetry or analytics
- Modify project source files

### Optional AI egress

The `/api/ai/chat` and `/api/ai/explain` routes make no upstream request unless you explicitly provide an OpenAI-compatible configuration in the request or set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` on the server. When you use these routes, the messages and selected context in that request are sent to the provider you configured and become subject to that provider's data policy.

AI destinations are restricted by protocol, literal-address, DNS, redirect, peer-address, timeout, response-size, rate, and concurrency checks. Local model providers remain supported on loopback. MCP architecture queries do not use these optional AI routes.

### Network exposure

Keep the default loopback binding whenever possible. A non-loopback bind requires authentication for REST, AI, and WebSocket surfaces except health, and WebSocket connections also enforce origin checks. Treat any configured AI key and remote-access token as secrets; never include them in issues, logs, fixtures, or screenshots.
