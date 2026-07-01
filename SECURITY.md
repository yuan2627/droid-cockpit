# Security Policy

## Supported Versions

Droid Cockpit is currently preparing its first public release. Security fixes are applied to the latest `main` branch and tagged releases after `v1.0.0`.

## Reporting a Vulnerability

Please open a private security advisory on GitHub if available, or contact the repository owner from the GitHub profile. Do not publish working exploit details before a fix is available.

When reporting, include:

- Droid Cockpit version
- Windows version
- Whether the issue requires a malicious local file, malicious renderer content, or remote network access
- Clear reproduction steps
- Any sensitive data involved, with secrets redacted

## Security Boundaries

Droid Cockpit manages local Factory Droid configuration. It is not a sandbox for arbitrary local tools, MCP servers, shell commands, or Droid itself. Treat MCP server configuration, custom model endpoints, imported backups, and local skills as trusted local configuration.

The app should not:

- Read or publish secrets without explicit user action
- Write user configuration during startup
- Follow symlinks or junctions outside the expected Factory config directories for destructive operations
- Send `${ENV_VAR}` references to remote endpoints during connection tests
- Start helper commands with visible Windows console windows
