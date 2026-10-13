# Security

Report vulnerabilities privately through the repository’s GitHub security advisory channel. Do not open a public issue containing credentials or customer data.

Only version 1.x is supported. Keep dependencies current. API keys stay on the configured instance; redirects are rejected. Read-only defaults, exact reviewed routes, request-schema validation and explicit write confirmation are enforced by the runtime. Backend permissions remain authoritative. HTTP is allowed only for loopback or a trusted explicit configuration. The server does not execute local commands or read/write arbitrary files.
