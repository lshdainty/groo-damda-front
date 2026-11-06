// 앱 받기(I-12 36 ~ 42) — 실제 화면을 띄워 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const snackShow = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: snackShow, dismiss: () => {} }),
}));

const { DownloadPage } = await import("./DownloadPage");

const RELEASE = {
  version: "1.30.0",
  buildNumber: 2345,
  releasedAt: "2026-10-20T00:00:00Z",
  android: "groo-damda.apk",
  ios: "groo-damda.ipa",
};

let host: HTMLDivElement;
let root: Root;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const mount = async (version: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        version
          ? { ok: true, json: () => Promise.resolve(version) }
          : { ok: false, json: () => Promise.reject(new Error("404")) },
      ),
    ),
  );
  await act(async () => {
    root.render(<DownloadPage />);
  });
  await flush();
};

const buttonByText = (text: string) =>
  Array.from(host.querySelectorAll("a, button")).find((el) =>
    el.textContent?.includes(text),
  ) as HTMLElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  snackShow.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("DownloadPage — 바탕 · 머리 · 문서 제목 (36 · 37 · 42)", () => {
  it("흰 면 하나 — 카드 0, 바닥은 화면 높이를 채우는 bg-layer-default", async () => {
    await mount(RELEASE);
    const page = host.firstElementChild as HTMLElement;
    expect(page.className).toContain("bg-bg-layer-default");
    expect(page.className).toContain("min-h-dvh");
    expect(host.querySelector('[data-slot="card"]')).toBeNull();
    expect(host.querySelector("main")?.className).toContain("max-w-[32rem]");
  });

  it("h1 하나 · 구역 제목은 h2 둘 · 버전 줄은 aria-live", async () => {
    await mount(RELEASE);
    expect(host.querySelectorAll("h1")).toHaveLength(1);
    expect(host.querySelectorAll("h2")).toHaveLength(2);
    const live = host.querySelector("[aria-live]");
    expect(live?.textContent).toContain("1.30.0");
  });

  it("문서 제목을 이 화면이 둔다", async () => {
    await mount(RELEASE);
    expect(document.title).toBe("docTitle");
  });
});

describe("DownloadPage — 내려받기 버튼 (39 · 40)", () => {
  it("버전이 있으면 링크(a href download)", async () => {
    await mount(RELEASE);
    const apk = buttonByText("android.cta");
    expect(apk.tagName).toBe("A");
    expect(apk.getAttribute("href")).toBe("/download/groo-damda.apk");
    const ipa = buttonByText("ios.cta");
    expect(ipa.tagName).toBe("A");
    expect(ipa.getAttribute("href")).toBe("/download/groo-damda.ipa");
  });

  it("버전이 없으면(읽기 실패) 두 버튼은 링크가 아니라 막힌 button", async () => {
    await mount(null);
    for (const text of ["android.cta", "ios.cta"]) {
      const el = buttonByText(text) as HTMLButtonElement;
      expect(el.tagName).toBe("BUTTON");
      expect(el.disabled).toBe(true);
      expect(el.getAttribute("href")).toBeNull();
    }
    expect(host.querySelector("[aria-live]")?.textContent).toBe(
      "subtitleNoRelease",
    );
  });

  it("불러오는 중에도 막혀 있다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    await act(async () => {
      root.render(<DownloadPage />);
    });
    expect((buttonByText("android.cta") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((buttonByText("ios.cta") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("DownloadPage — iOS 주소 (40)", () => {
  it("주소 상자는 줄을 바꿔 다 보인다(가로 스크롤 없음)", async () => {
    await mount(RELEASE);
    const code = host.querySelector("code") as HTMLElement;
    expect(code.className).toContain("[overflow-wrap:anywhere]");
    expect(code.className).not.toContain("overflow-x");
    expect(code.className).not.toContain("whitespace-nowrap");
    expect(code.textContent).toBe(
      `${window.location.origin}/download/altstore.json`,
    );
  });

  it("[주소 복사] — 글은 늘 같고, 결과는 Snackbar 로", async () => {
    await mount(RELEASE);
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const btn = buttonByText("ios.copy");
    await act(async () => {
      btn.click();
    });
    await flush();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/download/altstore.json`,
    );
    expect(snackShow).toHaveBeenCalledTimes(1);
    expect(snackShow.mock.calls[0]?.[0]).toEqual({
      message: "ios.copiedToast",
    });
    expect(btn.textContent).toContain("ios.copy");
  });

  it("복사가 막히면 critical 알림 하나", async () => {
    await mount(RELEASE);
    Object.assign(navigator, {
      clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    });
    await act(async () => {
      buttonByText("ios.copy").click();
    });
    await flush();
    expect(snackShow).toHaveBeenCalledTimes(1);
    expect(snackShow.mock.calls[0]?.[0]).toEqual({
      message: "ios.copyFailed",
      tone: "critical",
    });
  });
});
