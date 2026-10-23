// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { BACKUP_VERSION, backupFileName, buildBackup, IMPORT_ERROR, restoreBackup } from "./backup.ts";
import { __resetKvStoreForTests, setKv, snapshotKv } from "./kv-store.ts";

beforeEach(() => __resetKvStoreForTests());

describe("backup", () => {
  it("exports app, version, date, data and extras", () => {
    setKv("grade/01MIAR/ev1", 650);
    localStorage.setItem("ia-labs.logic-format", "VF");
    const b = buildBackup(new Date("2026-10-23T10:00:00Z"));
    expect(b).toEqual({
      app: "ia-labs-comunidad",
      version: BACKUP_VERSION,
      exportedAt: "2026-10-23T10:00:00.000Z",
      data: { "grade/01MIAR/ev1": 650 },
      extras: { "ia-labs.logic-format": "VF" },
    });
    expect(backupFileName(new Date("2026-10-23T10:00:00Z"))).toBe("ia-labs-datos-2026-10-23.json");
  });

  it("round-trips through JSON", () => {
    setKv("grade/01MIAR/ev1", 650);
    setKv("pref/theme", "dark");
    const text = JSON.stringify(buildBackup());
    __resetKvStoreForTests();
    const r = restoreBackup(text, "replace");
    expect(r.ok).toBe(true);
    expect(snapshotKv()).toEqual({ "grade/01MIAR/ev1": 650, "pref/theme": "dark" });
  });

  it.each([
    ["not json", "{"],
    ["another app", JSON.stringify({ app: "x", version: 1, exportedAt: "", data: {} })],
    ["missing version", JSON.stringify({ app: "ia-labs-comunidad", exportedAt: "", data: {} })],
    ["future version", JSON.stringify({ app: "ia-labs-comunidad", version: 99, exportedAt: "", data: {} })],
    ["unknown extra key", JSON.stringify({ app: "ia-labs-comunidad", version: 1, exportedAt: "", data: {}, extras: { evil: "x" } })],
    ["array data", JSON.stringify({ app: "ia-labs-comunidad", version: 1, exportedAt: "", data: [] })],
  ])("rejects %s", (_name, text) => {
    expect(restoreBackup(text, "merge")).toEqual({ ok: false, error: IMPORT_ERROR });
  });

  it("drops invalid entries and never writes unknown keys", () => {
    const text = JSON.stringify({
      app: "ia-labs-comunidad",
      version: 1,
      exportedAt: "2026-10-23T00:00:00Z",
      data: { "grade/01MIAR/ev1": 650, "__proto__/x": 1, "pref/theme": "<img src=x onerror=alert(1)>" },
    });
    const r = restoreBackup(text, "merge");
    expect(r.ok && r.report).toEqual({ imported: 1, skipped: ["__proto__/x", "pref/theme"] });
    expect(snapshotKv()).toEqual({ "grade/01MIAR/ev1": 650 });
  });
});
