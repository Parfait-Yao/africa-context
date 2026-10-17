import "dotenv/config"

// Les tests d'intégration utilisent une base dédiée, jamais la base de développement :
// TEST_DATABASE_URL doit être définie (sinon ils sont ignorés) et différente de DATABASE_URL.
if (process.env.TEST_DATABASE_URL) {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL doit pointer vers une autre base que DATABASE_URL (les tests vident les tables).")
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
