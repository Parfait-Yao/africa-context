# africontext-mcp

Serveur MCP qui donne à votre assistant (Cursor, Claude Code…) l'accès aux contextes vérifiés d'AfriContext.

Outils : `search_context(query, country?)`, `get_context(slug, format?)`.

```json
{ "mcpServers": { "africontext": { "command": "npx", "args": ["-y", "africontext-mcp"], "env": { "AFRICONTEXT_API": "https://africontext.dev" } } } }
```

Claude Code : `claude mcp add africontext -e AFRICONTEXT_API=https://africontext.dev -- npx -y africontext-mcp`

En local : `npm run build` puis `AFRICONTEXT_API=http://localhost:3000 node dist/index.js`.
