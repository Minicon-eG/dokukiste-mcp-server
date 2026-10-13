# Contributor and agent guide

This repository is a standalone public Minicon product. Never copy private backend code, credentials, client configuration or private Git history into it.

Use Node.js 22.12 or newer. Keep @types/node on the 22.x line to preserve the advertised runtime floor; TypeScript 7 requires explicit Node types in tsconfig. Run `npm run check`, `npm audit --omit=dev --audit-level=high` and `npm pack --dry-run` before committing. Tests must exercise protocol and HTTP behavior, not only mirror implementation.

Keep runtime modules focused and under 500 lines. The API boundary accepts JSON; validate every operation against the current OpenAPI schema before sending it. Keep credentials in server configuration, never tool inputs. Preserve same-origin requests and redirect rejection. Writes require both configuration opt-in and per-call confirmation. No automatic write retries.

`api/policy.json` is the reviewed standard/admin boundary. Unknown operations fail closed. Verify controller authorization before changing policy; UI account/login flows, provider callbacks and webhooks are intentionally excluded. Future API changes belong in reviewed contract updates, not arbitrary-path tools.

`src/` is intentionally mirrored in the companion repository so each product installs independently without an unpublished shared dependency. Apply runtime fixes and their behavioral tests to both products. The product profile, tool names, documentation and release lifecycle remain independent.

Public releases are GitHub Releases with built npm-compatible tarballs. Do not claim npm registry publication unless it has actually happened. A tag must match package and product versions. Keep stdout exclusively for MCP protocol traffic.
