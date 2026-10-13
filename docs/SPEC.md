# Product specification

Product goal (2026-10-13): replace legacy PDF Management MCP implementations with two independent public Minicon showcase products, `dokukiste-mcp-server` and `dokukiste-admin-mcp-server`, each in its own repository. Support the current DokuKiste API and retire the old implementations.

This product is the standard profile. It must install and run independently, expose useful first-class tools, and provide searchable access to every reviewed operation in its profile using current request schemas. Standard and admin operation sets must be disjoint. Preserve the current document, mail, finance/FLUSS, AI and administration capabilities according to backend authorization.

Use the current MCP SDK, API-key header authentication, live OpenAPI discovery, a documented release snapshot, bounded uploads/downloads, multipart/raw chunk support, structured errors, correct current document-detail routes and credential redaction. Validate inputs and product permissions before HTTP calls. Writes require opt-in and confirmation. Browser authentication, provider callbacks and infrastructure endpoints are outside the operator API.

Deliver MIT licensing, Minicon branding, English quickstart and German usage guidance, migration documentation, Docker packaging, behavioral tests, CI, dependency maintenance and reproducible GitHub releases. Remove bundled legacy implementations from DokuKiste and archive the old standalone repository with migration pointers after replacements are available. Never copy private Git history or customer configuration into public repositories.
