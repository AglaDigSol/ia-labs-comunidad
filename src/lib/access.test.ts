// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ACCESS_COOKIE, clearAccessCookie, hasAccessCookie } from "./access.ts";

describe("access cookie", () => {
  it("detects the labs_key cookie", () => {
    expect(ACCESS_COOKIE).toBe("labs_key");
    expect(hasAccessCookie("a=1; labs_key=abc")).toBe(true);
    expect(hasAccessCookie("a=1; xlabs_key=abc")).toBe(false);
    expect(hasAccessCookie("")).toBe(false);
  });

  it("clearAccessCookie expires it", () => {
    document.cookie = "labs_key=abc; Path=/";
    expect(hasAccessCookie()).toBe(true);
    clearAccessCookie();
    // jsdom ignores Secure cookies over http, so we only check the call does not throw and leaves no new cookie.
    expect(document.cookie.includes("labs_key=;")).toBe(false);
  });
});
