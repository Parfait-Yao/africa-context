# africontext (CLI)

Une commande, à la racine de votre projet, installe tout ce dont votre agent IA a besoin pour intégrer un service :

```bash
npx africontext add orange-money-webpay --env cursor
```

- **Règles de l'agent** : endpoints, authentification, webhooks, pièges et exemple vérifiés, complétés par les consignes propres
  à votre framework (Next.js, Nuxt, SvelteKit, Remix, NestJS, Express, Fastify, Vite, Node.js, Python — détecté automatiquement).
- **Variables d'environnement** : ajoutées vides dans `.env.example` et dans votre fichier local (`.env.local` pour Next.js / Vite, sinon `.env`).
- **Sécurité** : ce fichier est ajouté au `.gitignore`. Aucune valeur secrète n'est jamais écrite.

Il ne reste qu'à renseigner vos clés et à demander à l'agent : « Intègre Orange Money — Web Payment dans mon projet ».

| `--env` | Fichiers écrits |
|---|---|
| `cursor` | `.cursor/rules/<slug>.mdc` (toujours appliquée) |
| `claude` | bloc dans `CLAUDE.md` |
| `windsurf` | `.windsurf/rules/<slug>.md` + `africontext/<slug>.md` |
| `copilot` | `.github/instructions/<slug>.instructions.md` |
| `agents` | bloc dans `AGENTS.md` (Codex, Gemini CLI, Jules, Aider…) |

Sans `--env`, l'outil est détecté (dossier `.cursor`, `CLAUDE.md`…) ou demandé. Autres commandes :

```bash
npx africontext add orange-money-webpay --dry-run   # aperçu, rien n'est écrit
npx africontext search "orange money"
npx africontext list
```

Relancer `add` met les règles à jour. Un fichier qui n'a pas été créé par AfriContext n'est jamais remplacé sans confirmation (`--force` pour forcer).
L'ancienne option `--format cursorrules|claude|agents` reste acceptée.

En local, pointer la CLI sur le serveur de dev : `--api http://localhost:3000` ou `AFRICONTEXT_API=http://localhost:3000`.

Publication npm : `npm run build` puis `npm publish` depuis ce dossier.
