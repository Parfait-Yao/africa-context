import { describe, expect, it } from "vitest"
import { isPrivateAddress } from "@/lib/safe-fetch"

describe("Protection SSRF : isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
    "::1", "::", "fd00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:172.16.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "pas-une-ip",
  ])("refuse %s", (ip) => expect(isPrivateAddress(ip)).toBe(true))

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("accepte %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false)
  )
})
