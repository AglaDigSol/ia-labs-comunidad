// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetKvStoreForTests,
  clearKv,
  deleteKv,
  importKv,
  lastPersistFailed,
  readKvPrefix,
  setKv,
  setStorageAdapter,
  snapshotKv,
  STORAGE_KEY,
  useKv,
  useKvPrefix,
} from "./kv-store.ts";
import { LocalStorageAdapter, MemoryAdapter } from "./storage-adapter.ts";

beforeEach(() => {
  setStorageAdapter(new LocalStorageAdapter(STORAGE_KEY));
  __resetKvStoreForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("kv-store", () => {
  it("setKv / deleteKv update hooks and persist to localStorage", () => {
    const { result } = renderHook(() => useKv<string>("pref/theme", "system"));
    expect(result.current).toBe("system");
    act(() => setKv("pref/theme", "dark"));
    expect(result.current).toBe("dark");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ "pref/theme": "dark" });
    act(() => deleteKv("pref/theme"));
    expect(result.current).toBe("system");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({});
  });

  it("useKvPrefix and readKvPrefix return sorted entries of a prefix", () => {
    const { result } = renderHook(() => useKvPrefix<number>("grade/01MIAR/"));
    act(() => {
      setKv("grade/01MIAR/ev2", 700);
      setKv("grade/01MIAR/ev1", 650);
      setKv("grade/02MIAR/foro", 900);
    });
    const want = [
      { key: "grade/01MIAR/ev1", value: 650 },
      { key: "grade/01MIAR/ev2", value: 700 },
    ];
    expect(result.current).toEqual(want);
    expect(readKvPrefix("grade/01MIAR/")).toEqual(want);
  });

  it("keeps working in memory when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    setKv("pref/theme", "light");
    expect(readKvPrefix("pref/")).toEqual([{ key: "pref/theme", value: "light" }]);
    expect(lastPersistFailed()).toBe(true);
  });

  it("works with another adapter (StorageAdapter interface)", () => {
    const mem = new MemoryAdapter();
    setStorageAdapter(mem);
    setKv("pref/mhThreshold", 930);
    expect(mem.load()).toEqual({ "pref/mhThreshold": 930 });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores only valid entries from the adapter", () => {
    const mem = new MemoryAdapter();
    mem.save({ "pref/theme": "dark", "pref/unknown": 1, "grade/01MIAR/ev1": 5000, "grade/01MIAR/ev2": 800 });
    setStorageAdapter(mem);
    expect(snapshotKv()).toEqual({ "grade/01MIAR/ev2": 800, "pref/theme": "dark" });
  });

  it("importKv validates every entry; merge keeps, replace clears", () => {
    setKv("pref/theme", "dark");
    const r = importKv({ "grade/01MIAR/ev1": 650, "grade/XX/ev1": 1, "srs/sym-negacion": { bad: true } }, "merge");
    expect(r).toEqual({ imported: 1, skipped: ["grade/XX/ev1", "srs/sym-negacion"] });
    expect(snapshotKv()).toEqual({ "grade/01MIAR/ev1": 650, "pref/theme": "dark" });
    importKv({ "pref/mhThreshold": 950 }, "replace");
    expect(snapshotKv()).toEqual({ "pref/mhThreshold": 950 });
  });

  it("another tab's change reloads the cache", () => {
    const { result } = renderHook(() => useKv<string>("pref/theme", "system"));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ "pref/theme": "light" }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    expect(result.current).toBe("light");
  });

  it("clearKv removes everything", () => {
    setKv("pref/theme", "dark");
    clearKv();
    expect(snapshotKv()).toEqual({});
  });
});
