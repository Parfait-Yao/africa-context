-- Partie 3 : journal d'audit, alertes de sécurité, échecs de validation, paramètres,
-- résultat détaillé de la veille documentaire et des preuves.
-- Uniquement des ajouts (tables, colonnes nullables) : aucune donnée existante n'est modifiée.

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('success', 'refused', 'error');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('secret', 'suspicious_url', 'malformed_content');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved', 'false_positive');

-- AlterTable
ALTER TABLE "Context" ADD COLUMN     "sourceCheckError" TEXT,
ADD COLUMN     "sourceCheckResult" TEXT;

-- AlterTable
ALTER TABLE "Proof" ADD COLUMN     "apiVersion" TEXT,
ADD COLUMN     "sandboxReport" JSONB;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'success',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "rule" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contextId" TEXT,
    "contextSlug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationFailure" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "slug" TEXT,
    "fields" TEXT[],
    "missingSections" INTEGER NOT NULL DEFAULT 0,
    "secretRules" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAlert_fingerprint_key" ON "SecurityAlert"("fingerprint");

-- CreateIndex
CREATE INDEX "SecurityAlert_status_severity_idx" ON "SecurityAlert"("status", "severity");

-- CreateIndex
CREATE INDEX "SecurityAlert_contextId_idx" ON "SecurityAlert"("contextId");

-- CreateIndex
CREATE INDEX "ValidationFailure_createdAt_idx" ON "ValidationFailure"("createdAt");

-- CreateIndex
CREATE INDEX "ValidationFailure_userId_createdAt_idx" ON "ValidationFailure"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Proof_createdAt_idx" ON "Proof"("createdAt");

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "Context"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFailure" ADD CONSTRAINT "ValidationFailure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Journal d'audit en ajout seul : toute modification ou suppression d'une entrée est refusée par la base,
-- quel que soit le code applicatif qui la tente.
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog est en ajout seul : % refusé', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

-- Reprise de l'historique : les décisions de modération déjà journalisées entrent dans le journal d'audit.
INSERT INTO "AuditLog" ("id", "actorId", "actorName", "action", "targetType", "targetId", "targetLabel", "outcome", "details", "createdAt")
SELECT
  'ml_' || m."id",
  m."adminId",
  u."name",
  'context.moderate',
  'context',
  c."slug",
  c."title",
  'success',
  jsonb_build_object('from', m."fromStatus"::text, 'to', m."toStatus"::text, 'reason', m."reason", 'backfilled', true),
  m."createdAt"
FROM "ModerationLog" m
JOIN "User" u ON u."id" = m."adminId"
JOIN "Context" c ON c."id" = m."contextId";
