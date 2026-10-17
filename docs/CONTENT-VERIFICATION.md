# Vérification des contextes sur les documentations officielles

Passe du 17 octobre 2026. Chaque point a été comparé à la source (page officielle ou code du SDK officiel).

| Contexte | Source consultée | Résultat |
|---|---|---|
| Wave — API Checkout | docs.wave.com/checkout, docs.wave.com/webhook | ✅ Corrigé : **l'en-tête `Idempotency-Key` n'est pas documenté** (retiré), `success_url`/`error_url` en **https** obligatoires, signature `t=…,v1=…` = HMAC-SHA256(timestamp + corps brut), anti-rejeu 5 min, idempotence par `id` d'événement |
| FedaPay | docs.fedapay.com (référence transactions, token, webhooks) | ✅ Corrigé : `amount` entier, réponse 201 = objet transaction (lecture aussi sous `v1/transaction`), liste complète des événements, vérification via `Webhook.constructEvent` |
| Paystack | paystack.com/docs/api/transaction, /payments/webhooks | ✅ Conforme (montant en sous-unité, `x-paystack-signature` HMAC-SHA512, `charge.success`) |
| Flutterwave | developer.flutterwave.com (Standard, Webhooks) | ✅ Complété : `charge.completed`, devise par défaut NGN, `tx_ref` unique |
| CinetPay | docs.cinetpay.com (initialisation) | ✅ Complété : `channels` requis, `customer_*` pour la carte, code `"201"`, multiple de 5 |
| PayDunya | developers.paydunya.com/doc/FR/http_json | ✅ Conforme (3 en-têtes, URLs sandbox/prod, `response_code` 00, hash SHA-512 de la MasterKey) — laissé « à revérifier » pour la démo des signalements |
| MTN MoMo — Collection | code du SDK `momoapi-node` (la doc officielle est rendue en JavaScript) | ✅ Conforme (`/collection/token/`, `/collection/v1_0/requesttopay`, en-têtes, sandbox en EUR) |
| Africa's Talking — SMS | code du SDK officiel `africastalking-node.js` | ✅ Complété : succès = **201**, sandbox `api.sandbox.africastalking.com/version1/messaging`, en-tête `apiKey`, formulaire encodé |
| Orange SMS API | developer.orange.com/apis/sms/getting-started | ✅ Corrigé : pas de code d'erreur précis documenté pour un bundle épuisé (le « 403 » supposé a été retiré), `400 requestError` si `senderName` non approuvé |
| Orange Money Web Payment | developer.orange.com/apis/om-webpay | ⚠️ **Non vérifiable publiquement** : la référence est réservée aux marchands. Passé « à revérifier » ; à valider avec la documentation transmise par Orange |
| Moov Money, Hub2 | — | Soumissions incomplètes, volontairement « en attente » pour la démo de modération (à rejeter ou compléter) |

À refaire avant le 24 octobre, puis la veille (`/api/cron/check-sources`) prend le relais chaque nuit.
