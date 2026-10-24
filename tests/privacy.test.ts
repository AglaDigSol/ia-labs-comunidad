// Guardia de privacidad sobre todo el árbol del repositorio (no solo lo que ya está en git): correos,
// IDs y enlaces de Drive/Docs, tokens en URL, direcciones IP, rutas internas y redes privadas. Los
// nombres de personas reales y lugares concretos se comprueban por hash, para no publicarlos aquí.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);
const SELF = "tests/privacy.test.ts";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(relative(ROOT, p));
  }
  return out;
}

const files = walk(ROOT).filter((f) => f !== SELF && f !== "HANDOFF.md");
const text = (f: string) => {
  const buf = readFileSync(join(ROOT, f));
  return buf.subarray(0, 8000).includes(0) ? null : buf.toString("utf8");
};

const PATTERNS: Array<[string, RegExp]> = [
  ["email", /[A-Za-z0-9._%+-]+@(?!example\.invalid\b)[A-Za-z0-9-]+\.[A-Za-z]{2,}/],
  ["drive/docs link", /(?:drive|docs)\.google\.com\//],
  ["drive-style id", /[?&/](?:id|d|folders)[=/][A-Za-z0-9_-]{25,}/],
  ["token in url", /[?&](?:token|key|auth|sig|signature|access_token)=[A-Za-z0-9._~-]{12,}/i],
  ["tailnet", /tailnet|tailscale|\bts\.net\b/i],
  ["internal path", /\/home\/user|\/volume\d|\/Users\/[a-z]/],
  ["nas", /\bNAS\b/],
  ["ics feed path", /events\/ics|webcal:\/\//i],
];
const IP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IP_OK = new Set(["127.0.0.1", "0.0.0.0"]);

// sha256(palabra en minúsculas), primeros 16 hex: nombres de personas, lugares y alias privados.
const BANNED = new Set([
  "71eaea56f7f31be1", "8cccd8ebe021ef69", "eaf5afd527678644", "cf7735df1a37340c", "7f318ef39fe8d0f1",
  "18d73b091ae88f2b", "7904791f9bb496a3", "eb7881f52429c025", "6654977d57dddd3c", "66f1989bc293299a",
  "696539435c420490", "1f9e499a052241e7", "ce29c26322abc211", "d56b635b0b3f3fe4", "4457ec50cb1724cb",
  "2a404ace21e4e5e3", "57085dfeb45674cc", "cf07fb5645018c02", "d9bd3f285966c994", "f0f055164d56820c",
  "9334deb529a1444c", "9896ab9d029ebd90", "919e680ee460849a", "1bbcf6a3446b54b8", "01a011adf0d76184",
  "022a36dfadf09ba4",
]);
const hash = (w: string) => createHash("sha256").update(w).digest("hex").slice(0, 16);

describe("privacidad", () => {
  it("hay ficheros que revisar", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("sin correos, enlaces de Drive, tokens, redes privadas ni rutas internas", () => {
    const hits: string[] = [];
    for (const f of files) {
      const t = text(f);
      if (t === null) continue;
      for (const [name, re] of PATTERNS) if (re.test(t)) hits.push(`${f}: ${name}`);
      if (!f.endsWith("package-lock.json")) {
        for (const ip of t.match(IP) ?? []) if (!IP_OK.has(ip)) hits.push(`${f}: ip ${ip}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("sin nombres de personas reales ni lugares privados", () => {
    const hits: string[] = [];
    for (const f of files) {
      const t = text(f);
      if (t === null || f.endsWith("package-lock.json")) continue;
      for (const w of t.normalize("NFC").toLowerCase().split(/[^\p{L}\p{N}-]+/u)) {
        if (w && BANNED.has(hash(w))) hits.push(`${f}: ${hash(w)}`);
        for (const part of w.split("-")) if (part && part !== w && BANNED.has(hash(part))) hits.push(`${f}: ${hash(part)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it(".gitignore protege datos locales y la carpeta private/", () => {
    const gi = readFileSync(join(ROOT, ".gitignore"), "utf8").split(/\r?\n/).map((l) => l.trim());
    for (const entry of ["node_modules/", "dist/", ".env", "private/", "data/", "HANDOFF.md"]) expect(gi).toContain(entry);
  });
});
