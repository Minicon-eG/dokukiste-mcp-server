# DokuKiste MCP Server

[![CI](https://github.com/Minicon-eG/dokukiste-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/Minicon-eG/dokukiste-mcp-server/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A522.12-green.svg)](https://nodejs.org)

**An open Minicon product for [DokuKiste](https://dokukiste.de).** Work with documents, companies, mail, banking and FLUSS planning from any MCP-compatible assistant.

Current-instance OpenAPI schemas, correct API-key authentication, useful named tools and a searchable operation catalog. This release covers **729 reviewed operations** in the standard profile, including compatible API route aliases. See [API coverage](docs/API-COVERAGE.md).

The companion [dokukiste-admin-mcp-server](https://github.com/Minicon-eG/dokukiste-admin-mcp-server) covers the other profile. Both products are standalone and MIT licensed. The DokuKiste backend is not included in this license.

## Quick start

Requires Node.js 22.12+ and a DokuKiste API key created in your instance's API-key management. Give the key only the scopes and features your tasks require.

```sh
git clone https://github.com/Minicon-eG/dokukiste-mcp-server.git
cd dokukiste-mcp-server
npm ci
npm run build
export DOKUKISTE_BASE_URL=https://your-instance.dokukiste.de
export DOKUKISTE_API_KEY=your-api-key
npm start
```

The process speaks MCP over **stdio**; it does not open a web port. Configure the values in your MCP host's environment. `.env.example` documents them; `.env` files are not loaded automatically.

### Run a built release

GitHub Releases contain a built, npm-compatible tarball:

```sh
npx --yes --package=https://github.com/Minicon-eG/dokukiste-mcp-server/releases/download/v1.0.0/dokukiste-mcp-server-1.0.0.tgz dokukiste-mcp-server
```

This uses a GitHub release asset. It does not require or claim npm registry publication.

### Claude Desktop / Cursor / compatible hosts

```json
{
  "mcpServers": {
    "dokukiste-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/dokukiste-mcp-server/dist/index.js"],
      "env": {
        "DOKUKISTE_BASE_URL": "https://your-instance.dokukiste.de",
        "DOKUKISTE_API_KEY": "your-api-key"
      }
    }
  }
}
```

For Codex and other hosts, use the same command, arguments and environment in the host's MCP configuration format. Keep real keys out of committed configuration files.

## Tools

Start with `dokukiste_capabilities`. Use `dokukiste_find_operations` to search by domain, task or route; it returns exact operation IDs, descriptions and JSON input schemas. Then call `dokukiste_call_operation` with that ID and its matching `arguments` object. Search results are paginated (`offset`, `limit`), so the host need not load hundreds of tool definitions into every conversation.

Common tasks also have directly named tools:

| Tool | Current API operation |
|---|---|
| `dokukiste_search_documents` | `POST /api/documents/search` |
| `dokukiste_get_document` | `GET /api/documents/detail/{id}` |
| `dokukiste_download_document` | `GET /api/documents/{id}/download` |
| `dokukiste_upload_document` | `POST /api/documents/upload` |
| `dokukiste_list_documents` | `GET /api/documents` |
| `dokukiste_list_companies` | `GET /api/Companies` |
| `dokukiste_get_company` | `GET /api/Companies/{id}` |
| `dokukiste_list_mail_accounts` | `GET /api/mail/accounts` |
| `dokukiste_list_messages` | `GET /api/mail/accounts/{id}/messages` |
| `dokukiste_get_message` | `GET /api/mail/accounts/{id}/messages/{uid}` |
| `dokukiste_get_forecast` | `GET /api/planning/forecast` |
| `dokukiste_list_tags` | `GET /api/tags` |
| `dokukiste_get_version` | `GET /api/Version` |

Inputs follow the API schema: `path` for route parameters, `query` for query parameters, `body` for JSON/form/binary input. For example:

```json
{"operationId":"GET /api/documents/detail/{id}","arguments":{"path":{"id":"your-identifier"}}}
```

### Writes and uploads

Read-only mode is the default. Set `DOKUKISTE_ALLOW_WRITES=true` to expose reviewed writes; each write also requires `confirm: true`. The backend checks the key's permissions. Mutating calls are never automatically retried. Read-only POST searches remain available in read-only mode.

Binary inputs use `{"filename":"document.pdf","mimeType":"application/pdf","dataBase64":"..."}` inside the operation's body/form field. Files never come from arbitrary local filesystem paths. Raw upload chunks use the same object as `body`. Binary downloads return an embedded MCP resource with MIME type and base64 content. The default request/response limit is 16 MiB; use chunked uploads for larger files and adjust `DOKUKISTE_MAX_BYTES` when your host supports larger MCP messages.

### Configuration

| Variable | Meaning | Default |
|---|---|---|
| `DOKUKISTE_BASE_URL` | Your DokuKiste instance, without `/api` | Required |
| `DOKUKISTE_API_KEY` | Sent as `X-API-Key` | Required |
| `DOKUKISTE_ALLOW_WRITES` | Expose write operations | `false` |
| `DOKUKISTE_SCHEMA_MODE` | `live` or explicit `snapshot` | `live` |
| `DOKUKISTE_TIMEOUT_MS` | HTTP deadline | `30000` |
| `DOKUKISTE_MAX_BYTES` | Per-call payload limit | `16777216` |
| `DOKUKISTE_ALLOW_HTTP` | Allow a trusted non-loopback HTTP instance | `false` |

Live mode fetches `/swagger/v1/swagger.json` and uses the instance's current request schemas. A discovery failure stops startup with an error; it never silently falls back to an obsolete API. Snapshot mode explicitly uses the bundled 13.80.0 contract. HTTPS is required except for loopback or an explicit trusted HTTP configuration. Redirects are rejected so credentials stay on the configured instance.

## Docker

```sh
docker build -t dokukiste-mcp-server .
docker run --rm -i \
  -e DOKUKISTE_BASE_URL -e DOKUKISTE_API_KEY \
  dokukiste-mcp-server
```

The image runs as an unprivileged user. Keep `-i` for stdio; do not allocate a TTY or publish a port.

## Deutsch

DokuKiste MCP Server ist ein eigenständiges Open-Source-Produkt der Minicon eG. Verbinde deine DokuKiste-Instanz, prüfe die verfügbaren Funktionen mit `dokukiste_capabilities` und suche weitere Aktionen mit `dokukiste_find_operations`. Die Eingaben werden gegen die aktuelle API geprüft. Schreibzugriffe werden ausdrücklich aktiviert und pro Aufruf bestätigt. [Migration der bisherigen Server](docs/MIGRATION.md).

## Development and releases

```sh
npm ci
npm run check
npm audit --omit=dev --audit-level=high
npm pack --dry-run
```

CI exercises Node 22.12 and 24, the actual MCP protocol, HTTP authentication, input validation, product boundaries, uploads/downloads and packaging. The weekly contract workflow detects API drift. Releases require a `v<package-version>` tag, passing tests and a dependency audit; the release workflow attaches the built tarball.

See [contributing](CONTRIBUTING.md), [security](SECURITY.md), [changelog](CHANGELOG.md) and [license](LICENSE).
