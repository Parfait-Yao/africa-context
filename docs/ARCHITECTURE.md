# Architecture AfriContext

Une application **Next.js 16** (App Router, Cache Components) sert l'interface, l'API REST et l'authentification. PostgreSQL via **Prisma 7** (adaptateur `pg`). À côté : une **sandbox** de faux serveurs de paiement, une **CLI** et un **serveur MCP** qui consomment l'API publique.

```
Navigateur ─┐                         ┌──────────────── app (Next.js) ─────────────────┐
CLI ────────┼── HTTPS (Caddy) ──────▶ │ pages (site, auth, dashboard, admin)          │
MCP / IDE ──┘                         │ /api/*  ── requireUser / requireAdmin / quotas │
                                      │        ▼                                       │
cron (02:00) ── /api/cron/check-sources│  modules/* (services métier, Zod)             │──▶ PostgreSQL
                                      │        ▼                                       │
                                      │  repository Prisma                             │
                                      └────────────────────────────────────────────────┘
sandbox (conteneur isolé) : /wave /orange /fedapay  ◀── sandbox/run.mjs exécute le code généré
```

## Couches

| Couche | Dossier | Règle |
|---|---|---|
| Pages | `src/app/(site)`, `(auth)`, `dashboard`, `admin` | Server Components. Coque statique, données lues à la requête dans un `<Suspense>` après `connection()`. N'appellent que les services. |
| Composants | `src/components/{ui,layout,contexts,submit,admin}` | `ui/` = primitives shadcn (Radix). `"use client"` seulement pour l'interaction. |
| API | `src/app/api/**/route.ts` | Contrôle d'accès, quotas, validation Zod, puis service. Réponses `{ data }` / `{ error }`. |
| Services | `src/modules/*` | Règles métier : statuts, transitions de modération, votes, signalements, réputation, événements, veille, brouillons. |
| Données | `src/modules/contexts/context.repository.ts`, `src/lib/db.ts` | Prisma. Compteurs agrégés par `groupBy` (pas de N+1). |
| Spec & sécurité | `src/modules/spec` | Modules purs partagés client/serveur : schéma Zod, 8 sections, scanner de secrets, lecture `.md`. |
| Auth | `src/auth.ts`, `src/proxy.ts`, `src/modules/auth/session.ts` | Auth.js v5 (JWT httpOnly), GitHub + email/bcrypt. Proxy = 1re barrière ; chaque route revérifie. |

## Règles métier

| Règle | Où |
|---|---|
| Toute soumission démarre `pending` ; seuls `approved` et `to_recheck` sont publics | `context.repository.ts` (`PUBLIC_STATUSES`) |
| Transitions : pending → approved/rejected · approved → to_recheck · to_recheck → approved/rejected | `MODERATION_TRANSITIONS` |
| Rejet = motif obligatoire, visible par l'auteur ; journal de chaque décision | `contextService.moderate`, table `ModerationLog` |
| Publication refusée si une section manque ou si un secret est présent | `contextService.moderate` |
| Correction par l'auteur = nouvelle version, retour en `pending` | `contextService.resubmit` |
| Un vote par utilisateur et par contexte, pas de vote sur son propre contexte | contrainte `@@unique([userId, contextId])`, `votesService` |
| Un signalement ouvert par personne ; 3 ouverts → `to_recheck` | `reportsService` |
| Vue comptée une fois par visiteur et par jour, robots ignorés ; installation = appel CLI | `eventsService`, `/raw` |
| Réputation = 10 × contextes publiés + 2 × votes positifs − votes négatifs | `usersService.recomputeReputation` |
| Veille : empreinte SHA-256 du texte de la source ; changement ou 3 échecs → `to_recheck` | `source-watch.service.ts` |

## API

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/health` | public (vérifie aussi la base) |
| GET | `/api/stats` | public |
| GET | `/api/contexts?q&country&type&category&tag&sort&page&pageSize` | public |
| POST | `/api/contexts` (JSON Spec ou `{ markdown }`) | connecté, 10/min |
| GET | `/api/contexts/:slug` | public ; auteur/admin pour les non publiés |
| PUT | `/api/contexts/:slug` | auteur ou admin |
| GET | `/api/contexts/:slug/raw?format=raw\|cursorrules\|claude\|agents` | public (ETag) |
| GET | `/api/contexts/bundle?slugs=a,b&format=` | public |
| POST | `/api/contexts/:slug/events` `{ kind }` | public, 30/min |
| GET/POST | `/api/contexts/:slug/votes` `{ value: 1\|-1\|0 }` | connecté (POST), 30/min |
| POST | `/api/contexts/:slug/reports` | connecté, 10/min |
| POST | `/api/spec/validate`, `/api/spec/parse` | public |
| POST | `/api/drafts` `{ url }` | connecté, 5/h, si `AI_API_KEY` |
| PATCH | `/api/admin/contexts/:slug` `{ status, reason? }` | admin |
| POST | `/api/admin/contexts/:slug/proofs` | admin |
| PATCH | `/api/admin/reports/:id` `{ action }` | admin |
| POST | `/api/auth/register` | public, 5/10 min |
| POST | `/api/cron/check-sources` | `Authorization: Bearer $CRON_SECRET` |

## Données

`prisma/schema.prisma` : User, Context, ContextVersion, Tag, ContextTag, Vote, Proof, Mock, Report, Event, ModerationLog, Account, Session. Migrations dans `prisma/migrations` (générées par le moteur Prisma). `prisma/seed.ts` est idempotent.

## Next.js 16 : points d'attention

- `cacheComponents` : toute lecture de base se fait dans un composant sous `<Suspense>` qui appelle `await connection()` → le build n'a pas besoin de la base (indispensable pour Docker).
- Ne pas mettre `await connection()` dans un `try/catch` (le signal de rendu de Next serait avalé).
- `usePathname` / `useSearchParams` : petits composants client sous `<Suspense>`.
- Next garde les pages visitées montées mais masquées (`<Activity>`) : dans les tests, cibler `#contenu`.
- Optimisation possible : `"use cache"` + `cacheTag("contexts")` sur les lectures publiques, `revalidateTag("contexts", { expire: 0 })` après modération.

## Sandbox (F10)

`sandbox/server.mjs` imite Wave (`/v1/checkout/sessions`, webhook `Wave-Signature`), Orange Money (OAuth + `/webpayment`) et FedaPay (`/v1/transactions` + `/token`) avec la validation des vraies API. `sandbox/run.mjs` exécute un fichier de code généré dans un **processus séparé** : 128 Mo, 15 s, environnement vidé (clés factices), `fetch` redirigé vers la sandbox et bloqué ailleurs, `child_process` neutralisé. En production, la sandbox tourne dans son propre conteneur (lecture seule, 256 Mo, 0,5 CPU). Pour exécuter du code non relu, ajouter un conteneur jetable par exécution (`docker run --network none`).
