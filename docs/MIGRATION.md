# Migration to DokuKiste MCP

Replace `nikolausm/pdf-management-mcp-server`, the bundled `mcp-pdfmanagement`, and `mcp-pdfmanagement-admin` with the two standalone products:

- https://github.com/Minicon-eG/dokukiste-mcp-server
- https://github.com/Minicon-eG/dokukiste-admin-mcp-server

Remove old MCP-host entries and install the appropriate new product. Use the configured DokuKiste instance, not old `hero.local` or `llm.local` defaults. Rename `PDF_API_URL` / `PDFMANAGEMENT_BASE_URL` to `DOKUKISTE_BASE_URL`, and `PDF_API_KEY` / `PDFMANAGEMENT_API_KEY` to `DOKUKISTE_API_KEY`. Move timeout configuration to `DOKUKISTE_TIMEOUT_MS`.

Legacy `pdfmanagement_*` tool names are replaced by `dokukiste_*` or `dokukiste_admin_*`. Common tools are listed in the README. Discover additional operations and their current schemas using `find_operations`; the operation dispatcher supports the complete reviewed profile. Update saved prompts/workflows to these names and input envelopes.

API keys are sent in `X-API-Key`, not as bearer JWTs. The document detail route is `/api/documents/detail/{id}`. Downloads remain `/api/documents/{id}/download`. File uploads use base64 content or raw chunks, and downloads are returned to the MCP host; arbitrary filesystem paths are no longer accepted.

Enable writes only if your tasks need them. Each write requires `confirm: true`. Use separate least-privilege keys for standard and admin. Disabled features, absent scopes and document/tenant visibility restrictions remain enforced by DokuKiste.

The old standalone repository is retained as an archived migration pointer. Embedded implementations are removed from the private backend so releases and fixes have one public home per product.
