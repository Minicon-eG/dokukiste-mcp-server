# Changelog

## Unreleased

- Update the reviewed API contract and bundled snapshot to DokuKiste v13.90.0.
- Review 147 new operations against controller authorization: outgoing invoices, dunning, sales documents and templates, recurring invoices, ELSTER/EÜR, tax profiles, signatory, calendar subscriptions and reminder-to-invoice suggestions (`GET /api/PdfFiles/{id}/linked-documents/reminder-suggestions`).
- Exclude public token-based signing links for external recipients; drop the removed issue-bot routes.

## 1.0.0 — 2026-10-13

- Launch as a standalone public Minicon DokuKiste product under MIT.
- Current MCP SDK 2.3.1, live OpenAPI schemas and reviewed profile catalog.
- Correct document-detail routes and X-API-Key authentication.
- Separate standard/admin operations, read-only defaults and confirmed writes.
- Bounded binary/multipart transfers, behavioral tests, Docker, CI and release assets.
- Replace legacy PDF Management MCP implementations.
