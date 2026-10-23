import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATTERNS: Array<[string, RegExp]> = [
  ["drive link", /drive\.google\.com\/(file\/d|drive\/folders)\/[A-Za-z0-9_-]{20,}/],
  ["docs link", /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/[A-Za-z0-9_-]{20,}/],
  ["notebook id", /notebook\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/],
  ["ics feed path", /events\/ics/i],
  ["token in url", /[?&](token|key|auth)=[A-Za-z0-9._-]{16,}/],
  ["personal email", /[A-Za-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo)\.com/],
];

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

function isText(buf: Buffer): boolean {
  return !buf.subarray(0, 8000).includes(0);
}

describe("privacy gate over git-tracked files", () => {
  it("no secrets or personal data in tracked files", () => {
    const hits: string[] = [];
    for (const file of tracked) {
      if (file.startsWith(".claude/")) continue;
      if (file === "tests/privacy.test.ts") continue;
      let buf: Buffer;
      try {
        buf = readFileSync(file);
      } catch {
        continue; // deleted in working tree
      }
      if (!isText(buf)) continue;
      const text = buf.toString("utf8");
      for (const [name, re] of PATTERNS) if (re.test(text)) hits.push(`${file}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it("gitignore protects private data", () => {
    const gi = readFileSync(".gitignore", "utf8").split(/\r?\n/).map((l) => l.trim());
    for (const entry of ["private/", "data/", ".env", "*.sqlite"]) expect(gi).toContain(entry);
  });

  it("no tracked path under private/ or data/", () => {
    const bad = tracked.filter((f) => f.startsWith("private/") || f.startsWith("data/"));
    expect(bad).toEqual([]);
  });
});
