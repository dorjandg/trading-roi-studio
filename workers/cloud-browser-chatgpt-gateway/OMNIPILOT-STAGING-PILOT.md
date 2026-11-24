# OmniPilot OAuth staging pilot — safe development only
The OAuth gateway source was recovered from feature/cloud-browser-agent-phase1.
Existing read-only tools still require mcp:read. The optional new
omnipilot_managed_demo tool is listed only when the staging flag
OMNIPILOT_MANAGED_PILOT_ENABLED is exactly "true" and execution additionally
requires the independently consented mcp:demo.interact OAuth scope.

The backend accepts only bounded actions on https://demo.playwright.dev/todomvc/.
The same flag must be separately enabled on the backend. Neither source
import nor GitHub CI deploys, registers an MCP connection, grants credentials,
touches production/Finance, or changes any existing OAuth consent.

A live staging release still requires security review, end-to-end OAuth
and audience validation, a protected remote MCP connection, and controlled
website-action acceptance. No arbitrary-website or authenticated actions are
enabled by these changes.
