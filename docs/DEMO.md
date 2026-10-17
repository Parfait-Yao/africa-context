# Démo de 5 minutes (cahier des charges §10)

Préparation : site en ligne, sandbox lancée, un projet vierge ouvert dans Cursor ou Claude Code, onglet `/admin` connecté en admin dans un 2e navigateur.

| Temps | Action | Ce que voit le jury |
|---|---|---|
| 0:00 – 1:00 | Dans le projet vierge, demander : « Ajoute un paiement Wave de 5 000 FCFA ». Puis `npm run sandbox:test -- sandbox/examples/wave-without-context.ts --scenario wave` | L'IA invente `/v2/payments` ; la sandbox répond **401**, TEST ÉCHOUÉ |
| 1:00 – 2:00 | Sur AfriContext : rechercher « wave », ouvrir la fiche, onglet Preuve | Avant/après côte à côte, source officielle, version d'API, date de vérification |
| 2:00 – 3:15 | `npx africontext add wave-checkout-api`, relancer le même prompt, tester le code produit contre la sandbox | Fichier `.cursor/rules/…` créé ; **TEST RÉUSSI** (endpoint réel, signature du webhook vérifiée) |
| 3:15 – 4:15 | Publier un contexte : coller l'URL d'une doc (brouillon IA) ou importer un `.md` ; ajouter une fausse clé `sk_live_…` | Le scan bloque ; sans la clé → « en attente » ; l'admin relit et publie en direct |
| 4:15 – 5:00 | Schéma de déploiement (docs/ARCHITECTURE.md) puis compteurs d'impact de l'accueil | Docker Compose sur Systalink, copies / installations / heures gagnées |

## Plans de repli

- Vidéo enregistrée des temps 1 à 3.
- Code « avec contexte » déjà prêt : `sandbox/examples/wave-with-context.ts` (et Orange, FedaPay).
- Sandbox locale : `npm run sandbox` sur le portable si le serveur est injoignable.
- Sans IA : importer un fichier `.md` au lieu du brouillon assisté.
- Répéter le scénario 10 fois la veille (cahier §10).
