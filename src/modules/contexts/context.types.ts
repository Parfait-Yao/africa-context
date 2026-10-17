/**
 * Types du domaine "Context".
 * Ils reflètent le schéma Prisma (prisma/schema.prisma) : quand la base sera branchée,
 * le repository Prisma renverra exactement ces formes, et aucun composant ne changera.
 */

export const CONTEXT_TYPES = ["cursorrules", "claude_prompt", "mcp_server"] as const
export type ContextType = (typeof CONTEXT_TYPES)[number]

export const CONTEXT_STATUSES = ["pending", "approved", "rejected", "to_recheck"] as const
export type ContextStatus = (typeof CONTEXT_STATUSES)[number]

export const AI_TOOLS = ["cursor", "claude-code", "copilot", "windsurf"] as const
export type AiTool = (typeof AI_TOOLS)[number]

export const EXPORT_FORMATS = ["raw", "cursorrules", "claude", "agents"] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export interface ContextAuthor {
  id: string
  name: string
  githubUrl?: string
  reputationScore: number
}

export interface Proof {
  id: string
  prompt: string
  outputWithoutContext: string
  outputWithContext: string
  model: string
  sandboxResult?: "passed" | "failed"
  createdAt: string
}

export interface ContextVersion {
  id: string
  note: string
  createdAt: string
}

export interface ContextStats {
  views: number
  copies: number
  installs: number
  upvotes: number
  downvotes: number
}

export interface Context {
  id: string
  slug: string
  title: string
  description: string
  type: ContextType
  service: string
  category: string
  countries: string[]
  apiVersion: string
  sourceUrl: string
  testedWith: AiTool[]
  tags: string[]
  status: ContextStatus
  rejectionReason?: string
  lastVerifiedAt: string
  createdAt: string
  /** Corps Markdown conforme à l'AfriContext Spec (8 sections obligatoires). */
  content: string
  author: ContextAuthor
  stats: ContextStats
  proofs: Proof[]
  versions: ContextVersion[]
  hasSandbox: boolean
}

export interface ContextFilters {
  q?: string
  country?: string
  type?: ContextType
  category?: string
  tag?: string
  sort?: "popular" | "recent" | "verified"
  page?: number
  pageSize?: number
  /** Réservé au back-office : par défaut seul `approved` (et `to_recheck`) est public. */
  includeStatuses?: ContextStatus[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
