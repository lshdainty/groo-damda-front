import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 모듈 상태(고침을 걸어 둔 참)가 시험마다 새로 시작하게 매번 다시 불러온다
async function load() {
  vi.resetModules();
  return import("./chunk-reload");
}

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.useRealTimers());

describe("chunk-reload — 새 배포 뒤 옛 조각 404", () => {
  it("엔진마다 다른 조각 받기 실패 글을 알아본다", async () => {
    const { isChunkLoadError } = await load();
    expect(
      isChunkLoadError(new TypeError("Importing a module script failed.")),
    ).toBe(true); // Safari
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://x/assets/AssetPage-abc.js",
        ),
      ),
    ).toBe(true); // 크롬
    expect(
      isChunkLoadError(
        new TypeError("error loading dynamically imported module"),
      ),
    ).toBe(true); // 파이어폭스
    expect(
      isChunkLoadError(new Error("Unable to preload CSS for /assets/x.css")),
    ).toBe(true); // Vite CSS
    expect(
      isChunkLoadError(
        Object.assign(new Error("Loading chunk 12 failed."), {
          name: "ChunkLoadError",
        }),
      ),
    ).toBe(true); // 이름으로 알리는 도구(webpack 식)
    expect(
      isChunkLoadError(new TypeError("Cannot read properties of undefined")),
    ).toBe(false);
  });

  it("vite:preloadError 에 한 번만 새로 고친다 — 10초 안에 또 오면 고치지 않는다(무한 새로 고침 방지)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    const { installChunkReload, isChunkReloadPending } = await load();
    const reload = vi.fn();
    const off = installChunkReload(reload);

    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isChunkReloadPending()).toBe(true);
    // 오류를 삼키지 않는다 — 삼키면 import 가 undefined 로 풀려 엉뚱한 TypeError 가 된다
    expect(event.defaultPrevented).toBe(false);
    off();

    // 고친 뒤 새 문서 — 10초 안에 또 실패하면 고치지 않는다
    const second = await load();
    const off2 = second.installChunkReload(reload);
    vi.setSystemTime(1_000_000 + 5_000);
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(reload).toHaveBeenCalledTimes(1);
    off2();

    // 시간이 지나 다시 배포된 경우는 또 한 번 고친다
    const third = await load();
    const off3 = third.installChunkReload(reload);
    vi.setSystemTime(1_000_000 + 20_000);
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(reload).toHaveBeenCalledTimes(2);
    off3();
  });

  it("저장소를 못 쓰면 되풀이를 막을 수 없어 고치지 않는다", async () => {
    const { reloadOnceForStaleChunk } = await load();
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });
    const reload = vi.fn();
    expect(reloadOnceForStaleChunk(reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
