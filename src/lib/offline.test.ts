// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetOfflineForTests, offlineState, registerServiceWorker } from "./offline.ts";

afterEach(() => __resetOfflineForTests());

const container = (controller: object | null, fail = false) =>
  ({
    controller,
    register: vi.fn(async () => {
      if (fail) throw new Error("no");
      return {};
    }),
    ready: Promise.resolve({}),
  }) as unknown as ServiceWorkerContainer & { register: ReturnType<typeof vi.fn> };

describe("registerServiceWorker", () => {
  it("registra <base>sw.js con alcance en la base y avisa la primera vez que queda sin conexión", async () => {
    const sw = container(null);
    const onFirstReady = vi.fn();
    await registerServiceWorker({ base: "/labs/", container: sw, onFirstReady });
    expect(sw.register).toHaveBeenCalledWith("/labs/sw.js", { scope: "/labs/" });
    expect(offlineState()).toBe("ready");
    expect(onFirstReady).toHaveBeenCalledTimes(1);
  });

  it("si la página ya estaba controlada, no vuelve a avisar", async () => {
    const onFirstReady = vi.fn();
    await registerServiceWorker({ base: "/", container: container({}), onFirstReady });
    expect(offlineState()).toBe("ready");
    expect(onFirstReady).not.toHaveBeenCalled();
  });

  it("sin soporte o si el registro falla, la app sigue sin el aviso", async () => {
    const onFirstReady = vi.fn();
    await registerServiceWorker({ base: "/", container: container(null, true), onFirstReady });
    expect(offlineState()).toBe("unsupported");
    expect(onFirstReady).not.toHaveBeenCalled();
  });
});
