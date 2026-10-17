# AfriContext

Plateforme collaborative de contextes IA **vérifiés** pour intégrer les services africains (Wave, Orange Money, FedaPay, MTN MoMo, CinetPay, API SMS…) du premier coup dans Cursor, Claude Code ou tout assistant compatible.

CADEV 2026 · Systalink Challenge · Équipe Impaact code

## Ce qui fonctionne

| Fonction | Où |
|---|---|
| Catalogue, recherche sans accents (service, pays, tag), filtres, fiches (F1, F2) | `/contexts`, `/contexts/[slug]` |
| Comptes email + GitHub, sessions, rôles (F3) | `/login`, `/register`, Auth.js |
| Soumission validée par la Spec, import `.md`, scan de secrets (F4, F6) | `/submit`, `POST /api/contexts` |
| Votes (un par personne), signalements (3 → « à revérifier ») (F5) | fiche d'un contexte |
| Modération : relecture, motif de rejet obligatoire, journal (F6) | `/admin` |
| Export brut et par outil (F7), panier de contextes (F13) | `/api/contexts/[slug]/raw`, `/api/contexts/bundle` |
| CLI `npx africontext add <slug>` (F8) | `packages/cli` |
| Preuves avant / après (F9) | onglet « Preuve », `npm run proof:capture` |
| Sandboxes Wave, Orange Money, FedaPay + exécution isolée du code généré (F10) | `sandbox/` |
| Brouillon assisté par IA depuis une URL de doc (F11) | `/submit` (si `AI_API_KEY`) |
| Veille d'obsolescence nocturne (F12) | `POST /api/cron/check-sources` |
| Serveur MCP `search_context` / `get_context` (F14) | `packages/mcp` |
| Réputation et classement (F15), compteurs d'impact (F16) | `/dashboard`, accueil |

## Démarrer en local (Windows, macOS, Linux)

Prérequis : Node.js 22, Docker Desktop (pour PostgreSQL).

```bash
npm install
cp .env.example .env            # PowerShell : Copy-Item .env.example .env  — puis renseigner AUTH_SECRET
docker compose up -d db sandbox # PostgreSQL + faux serveurs de paiement
npx prisma migrate deploy       # crée les tables
npm run db:seed                 # 12 contextes de démo + comptes
npm run dev                     # http://localhost:3000
```

Comptes de démonstration créés par le seed :

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | admin@africontext.dev | Admin-AfriContext-2026 |
| Développeur | dev@africontext.dev | Dev-AfriContext-2026 |

> Changez ces mots de passe (ou supprimez ces comptes) avant d'ouvrir le site au public.

Sans Docker : installez PostgreSQL 16, créez la base `africontext` et adaptez `DATABASE_URL`. La sandbox se lance aussi avec `npm run sandbox`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Développement / build / production |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Tests unitaires + intégration (Vitest ; intégration si `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Parcours navigateur desktop + mobile (Playwright) |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` | Prisma |
| `npm run sandbox` | Faux serveurs Wave / Orange Money / FedaPay (port 4010) |
| `npm run sandbox:test -- <fichier.ts> --scenario wave` | Teste du code généré contre la sandbox |
| `npm run proof:capture -- <slug> "<prompt>" --sandbox wave` | Capture une preuve avant / après |
| `npm run cli -- add wave-checkout-api --api http://localhost:3000` | CLI en local |
| `npm run mcp:build` | Construit le serveur MCP |

### Tests d'intégration

```bash
docker compose exec db psql -U africontext -c "CREATE DATABASE africontext_test"
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy   # PowerShell : $env:DATABASE_URL=$env:TEST_DATABASE_URL
npm test
npx playwright install chromium && npm run build && npm run test:e2e
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — couches, API, données, choix techniques
- [docs/SECURITY.md](docs/SECURITY.md) — mesures et checklist avant production
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS Systalink, HTTPS, sauvegardes
- [docs/DEMO.md](docs/DEMO.md) — déroulé du pitch de 5 minutes et plans de repli
- [docs/CONTENT-VERIFICATION.md](docs/CONTENT-VERIFICATION.md) — vérification des contextes sur les docs officielles
