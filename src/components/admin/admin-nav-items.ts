import {
  BlocksIcon, BoxIcon, ChartNoAxesColumnIcon, FileSearchIcon, FlagIcon, FlaskConicalIcon, GlobeIcon,
  HistoryIcon, InboxIcon, LayoutDashboardIcon, LibraryBigIcon, ScrollTextIcon, SettingsIcon, ShieldAlertIcon, TagsIcon,
  UserStarIcon, UsersIcon, type LucideIcon,
} from "lucide-react"

export interface AdminNavItem {
  label: string
  Icon: LucideIcon
  /** Absent : module pas encore développé, affiché « Bientôt » et non cliquable. */
  href?: string
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Vue générale",
    items: [
      { label: "Tableau de bord", href: "/admin", Icon: LayoutDashboardIcon },
      { label: "Statistiques et impact", href: "/admin/stats", Icon: ChartNoAxesColumnIcon },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { label: "Contextes", href: "/admin/contexts", Icon: LibraryBigIcon },
      { label: "Versions et historique", href: "/admin/versions", Icon: HistoryIcon },
      { label: "Services", href: "/admin/services", Icon: BlocksIcon },
      { label: "Pays", href: "/admin/countries", Icon: GlobeIcon },
      { label: "Tags", href: "/admin/tags", Icon: TagsIcon },
    ],
  },
  {
    label: "Modération",
    items: [
      { label: "Contributions en attente", href: "/admin/moderation", Icon: InboxIcon },
      { label: "Signalements", href: "/admin/reports", Icon: FlagIcon },
      { label: "Sécurité", href: "/admin/security", Icon: ShieldAlertIcon },
    ],
  },
  {
    label: "Communauté",
    items: [
      { label: "Utilisateurs", href: "/admin/users", Icon: UsersIcon },
      { label: "Contributeurs", href: "/admin/contributors", Icon: UserStarIcon },
    ],
  },
  {
    label: "Qualité technique",
    items: [
      { label: "Preuves et tests", href: "/admin/proofs", Icon: FlaskConicalIcon },
      { label: "Sandboxes", href: "/admin/sandboxes", Icon: BoxIcon },
      { label: "Vérification de la documentation", href: "/admin/sources", Icon: FileSearchIcon },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Journal d'audit", href: "/admin/audit", Icon: ScrollTextIcon },
      { label: "Paramètres", href: "/admin/settings", Icon: SettingsIcon },
    ],
  },
]

/** `/admin` n'est actif que sur lui-même ; les autres entrées couvrent leurs sous-pages. */
export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)
}
