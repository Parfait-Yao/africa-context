import { categoryLabel, countryName } from "@/config/site"

export function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()
}

/** Texte indexé pour la recherche : insensible aux accents, inclut les noms de pays et la catégorie. */
export function buildSearchText(c: {
  title: string
  service: string
  description: string
  category: string
  countries: string[]
  tags: string[]
}) {
  return normalize(
    [c.title, c.service, c.description, c.category, categoryLabel(c.category), ...c.tags, ...c.countries, ...c.countries.map(countryName)].join(" ")
  )
}
