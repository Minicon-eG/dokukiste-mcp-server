# Changelog

## 1.0.1

- Update fast-uri to 3.1.9 to address URI parsing and normalization vulnerabilities.
- Update MCP server and development client to 2.4.0; preserve existing tool contracts, read-only defaults and confirmed writes.
- No configuration migration is required. Live API contract drift remains tracked separately; unreviewed operations stay excluded.

## 1.0.0 — 2026-10-13

- Launch as a standalone public Minicon DokuKiste product under MIT.
- Current MCP SDK 2.3.1, live OpenAPI schemas and reviewed profile catalog.
- Correct document-detail routes and X-API-Key authentication.
- Separate standard/admin operations, read-only defaults and confirmed writes.
- Bounded binary/multipart transfers, behavioral tests, Docker, CI and release assets.
- Replace legacy PDF Management MCP implementations.
