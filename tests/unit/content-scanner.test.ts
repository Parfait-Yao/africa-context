import { describe, expect, it } from "vitest"
import { redactUrl, scanHiddenCharacters, scanUrls } from "@/modules/security/content-scanner"
import { redactSecrets } from "@/modules/spec/secret-scanner"

const rules = (text: string) => scanUrls(text).map((f) => f.rule)

describe("scanUrls", () => {
  it("ignore les liens HTTPS ordinaires et les hôtes d'exemple ou locaux", () => {
    expect(scanUrls("Doc : https://docs.wave.com/checkout et https://developer.orange.com/apis/om-webpay.")).toEqual([])
    expect(scanUrls("Sandbox : http://localhost:4010/wave et http://api.example.com:8080/v1")).toEqual([])
  })

  it("repère http, IP, port inhabituel, punycode, raccourcisseur", () => {
    expect(rules("http://payments.acme.io/v1")).toEqual(["url-insecure"])
    expect(rules("https://203.0.113.9/pay")).toContain("url-ip-host")
    expect(rules("https://api.acme.io:8443/x")).toContain("url-port")
    expect(rules("https://xn--wve-hoa.com/login")).toContain("url-punycode")
    expect(rules("Voir https://bit.ly/3abc")).toContain("url-shortener")
  })

  it("repère identifiants et jetons dans l'URL, sans les afficher", () => {
    const [cred] = scanUrls("https://admin:Sup3rS3cret@api.acme.io/v1")
    expect(cred.rule).toBe("url-credentials")
    expect(cred.excerpt).not.toContain("Sup3rS3cret")
    expect(cred.excerpt).not.toContain("admin")

    const findings = scanUrls("https://api.acme.io/cb?token=abcd1234efgh5678&page=2")
    expect(findings.map((f) => f.rule)).toContain("url-token-param")
    expect(findings[0].excerpt).not.toContain("abcd1234efgh5678")
    expect(findings[0].excerpt).toContain("page=2")
    // Un placeholder n'est pas un jeton
    expect(rules("https://api.acme.io/cb?token=${TOKEN_VALUE_HERE}")).toEqual([])
  })

  it("repère les schémas exécutables et donne le numéro de ligne", () => {
    const [f] = scanUrls("ligne 1\n[clic](javascript:alert(1))")
    expect(f).toMatchObject({ rule: "url-dangerous-scheme", severity: "high", line: 2 })
  })

  it("redactUrl tronque et masque", () => {
    expect(redactUrl("https://u:p@x.io/a?api_key=zzzzzzzzzz")).toBe("https://••••@x.io/a?api_key=••••")
    expect(redactUrl(`https://x.io/${"a".repeat(200)}`).length).toBeLessThanOrEqual(90)
  })
})

describe("scanHiddenCharacters", () => {
  it("repère les caractères bidirectionnels (Trojan Source) et de largeur nulle", () => {
    expect(scanHiddenCharacters("const ok = true")).toEqual([])
    const bidi = scanHiddenCharacters("if (isAdmin‮) {")
    expect(bidi[0]).toMatchObject({ rule: "hidden-bidi", severity: "high", line: 1 })
    expect(bidi[0].excerpt).not.toMatch(/‮/)
    expect(scanHiddenCharacters("a\nb​c")[0]).toMatchObject({ rule: "hidden-zero-width", line: 2 })
  })
})

describe("redactSecrets", () => {
  it("masque chaque secret dans un texte libre et laisse le reste intact", () => {
    const text = "Clé révoquée : sk_live_ABCDEFGH12345678 (note de l'admin)"
    const out = redactSecrets(text)
    expect(out).not.toContain("ABCDEFGH12345678")
    expect(out).toContain("sk_liv…••••")
    expect(out).toContain("(note de l'admin)")
    expect(redactSecrets("Rien de sensible ici.")).toBe("Rien de sensible ici.")
  })
})
