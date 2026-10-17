# Sécurité AfriContext

## Mesures en place

| Risque (cahier des charges §9) | Mesure | Fichier |
|---|---|---|
| Clés d'API dans un contexte | Scan client + serveur (sk_live/test, Wave, FedaPay, Paystack, Flutterwave, Bearer et Basic en clair, AWS, GitHub, clés privées, affectations), soumission refusée, extrait masqué | `src/modules/spec/secret-scanner.ts` |
| Contexte dangereux | `pending` par défaut, publication par un admin, bloquée si Spec incomplète ou secret présent | `context.service.ts` |
| XSS par le Markdown | `react-markdown` sans HTML brut (`skipHtml`), liens `noopener noreferrer nofollow`, CSP | `components/contexts/markdown.tsx`, `next.config.ts` |
| URL MCP malveillante | Affichée, jamais exécutée ; avertissement « à vérifier avant d'installer » | fiche contexte |
| Contexte obsolète | Signalements, veille nocturne, statut `to_recheck` visible partout (fiche, CLI, MCP, export) | `source-watch.service.ts` |
| Vote multiple / spam | Contrainte unique en base, quotas par utilisateur et par IP | `votes.service.ts`, `lib/rate-limit.ts` |
| Comptes | bcrypt (12 tours), JWT httpOnly + secure en prod, 10 essais / 15 min par email, rôle admin revérifié en base | `auth.ts`, `session.ts` |
| Abus du brouillon IA | Connexion requise, 5 / h, page source filtrée (SSRF), secrets scannés, relecture humaine | `drafts.service.ts`, `lib/safe-fetch.ts` |
| SSRF (veille, brouillon) | http(s) seulement, IP privées/loopback refusées après résolution DNS, redirections revérifiées, délai 10 s, 1 Mo max | `lib/safe-fetch.ts` |
| Code exécuté par la sandbox | Processus séparé, mémoire/temps limités, réseau limité à la sandbox, sans processus enfants, clés factices | `sandbox/run.mjs`, `preload.mjs` |
| CLI qui écrase un fichier | Jamais sans confirmation ou `--force` ; blocs délimités mis à jour ; refus d'écrire hors du projet | `packages/cli/src/index.ts` |
| En-têtes HTTP | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS en prod, `X-Powered-By` retiré | `next.config.ts` |
| Tâche planifiée | Jeton `CRON_SECRET` comparé en temps constant | `api/cron/check-sources` |
| Dépendances | `npm audit --omit=dev` : 0 vulnérabilité (gray-matter remplacé par `yaml`) | `package.json` |

## Checklist avant production

- [ ] `AUTH_SECRET`, `CRON_SECRET`, `POSTGRES_PASSWORD` générés aléatoirement (32+ caractères)
- [ ] Comptes de démo supprimés ou mots de passe changés
- [ ] `ALLOW_PRIVATE_FETCH=false`
- [ ] `.env` absent du dépôt (`git status` propre)
- [ ] PostgreSQL non exposé publiquement (port lié à 127.0.0.1)
- [ ] HTTPS actif (`curl -I https://<domaine>` → `strict-transport-security`)
- [ ] Sauvegarde quotidienne active et une restauration testée
- [ ] `npm audit --omit=dev` sans vulnérabilité haute
- [ ] Contextes de démo revérifiés (voir `docs/CONTENT-VERIFICATION.md`)
