# Déploiement sur le VPS Systalink

## 1. Préparer le serveur (une fois)

```bash
# Ubuntu 22.04+ : Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
git clone <votre dépôt> /opt/africontext && cd /opt/africontext
cp .env.example .env && nano .env
```

Dans `.env` : `DOMAIN`, `NEXT_PUBLIC_APP_URL=https://<domaine>`, `POSTGRES_PASSWORD`, `DATABASE_URL` (même mot de passe), `AUTH_SECRET`, `CRON_SECRET`, éventuellement `AUTH_GITHUB_ID/SECRET` (callback `https://<domaine>/api/auth/callback/github`) et `AI_API_KEY`.

Le DNS du domaine doit pointer vers l'IP du VPS (enregistrement A) **avant** le premier démarrage : Caddy obtient alors le certificat HTTPS automatiquement.

## 2. Démarrer

```bash
docker compose --profile prod up -d --build
docker compose --profile prod ps          # db, sandbox, app, cron, caddy « running » ; migrate « exited (0) »
curl https://<domaine>/api/health          # {"status":"ok","database":"ok"}
```

Services : `db` (PostgreSQL 16), `migrate` (migrations + seed puis s'arrête), `app` (Next.js standalone), `sandbox`, `cron` (veille à 02:00 UTC), `caddy` (HTTPS, `/sandbox/*` exposé pour la démo).

## 3. Mettre à jour

```bash
./scripts/deploy.sh      # git pull, build, migrations, redémarrage, vérification
docker compose logs -f app
```

## 4. Sauvegardes

```bash
crontab -e
30 1 * * * cd /opt/africontext && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Restauration (testée : données identiques après restauration) : `./scripts/restore.sh backups/<fichier>.sql.gz`.

## 5. Recette depuis un autre réseau (4G)

- [ ] `https://<domaine>` s'ouvre, cadenas valide
- [ ] Recherche « paiement mobile » et « Sénégal »
- [ ] `npx africontext add wave-checkout-api --api https://<domaine>` dans un dossier vide
- [ ] Connexion admin, approbation d'un contexte en attente
- [ ] `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/check-sources`
