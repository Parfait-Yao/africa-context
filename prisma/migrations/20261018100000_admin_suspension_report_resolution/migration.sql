-- Espace administrateur : suspension de compte et trace des décisions sur les signalements.
-- Colonnes nullables uniquement : aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedById" TEXT;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
