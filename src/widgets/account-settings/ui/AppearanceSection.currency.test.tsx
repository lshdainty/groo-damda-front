// 표시 설정의 **기본 통화**를 어디에 저장하는가 (QA #124 · D7).
//
// 종전엔 브라우저 `localStorage`(`pd-currency`)에만 넣었다. 계정이 아니라 브라우저에
// 붙은 값이라 폰과 PC 가 각자 다른 값을 들었고, 정작 **이 값을 읽는 곳이 하나도
// 없어서** 고르면 저장된 것처럼만 보였다. 지역 설정과 같은 자리(`/me/preferences`)로
// 옮긴다 — 계정에 딸린 값이다(desk-back #328).
//
// 여기서 잠그는 것 셋:
//   1) 고르면 **서버로 나간다**(그 키 하나만 — PATCH 는 안 보낸 칸을 안 고친다).
//   2) **localStorage 를 안 쓴다.** 남겨 두면 두 저장소가 갈려 어느 쪽이 참인지 모른다.
//   3) 서버 값이 오기 전에는 **원화로 그리지 않는다**(I-14 21) — 값 글을 비우고 줄을 막는다.
//      실패를 원화로 보이게 하면 서버에 다른 통화가 저장돼 있어도 모르고 지나간다.
//
// 줄은 값 줄이고 고르기 표면은 누르면 열린다(1280 미만은 시트) — 먼저 줄 뒤 칸을 눌러 연다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  prefs: undefined as Record<string, unknown> | undefined,
  patched: [] as Record<string, unknown>[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko", changeLanguage: () => {} },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ui/theme-context", () => ({
  useTheme: () => ({ theme: "system", setTheme: () => {} }),
}));
vi.mock("@/features/user", () => ({
  useUserPreferences: () => ({
    data: state.prefs,
    isError: state.prefs === undefined,
    isLoading: false,
    refetch: () => {},
    isRefetching: false,
  }),
  useUpdateUserPreferences: () => ({
    mutate: (data: Record<string, unknown>, _opts?: unknown) => {
      state.patched.push(data);
    },
    isPending: false,
  }),
}));

const { AppearanceSection } = await import("./AppearanceSection");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList;
  }
  state.prefs = { timezone: "Asia/Seoul", defaultCurrency: "KRW" };
  state.patched = [];
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  act(() => root.render(<AppearanceSection mobile={false} />));
}

/** 통화 줄 뒤 칸(이름 = 줄 제목)을 눌러 고르기 표면을 연다 */
function openCurrency() {
  const trigger = [
    ...document.body.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.getAttribute("aria-label") === "currency.label");
  if (!trigger) throw new Error("통화 칸을 찾지 못했다");
  act(() => trigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  return trigger;
}

/**
 * 통화 라디오만 — 테마 타일도 `role="radio"` 라서 통째로 긁으면 그쪽이 먼저 걸린다.
 * 라벨이 `currency.<코드>`(목이 키를 그대로 흘린다)라 그걸로 가른다.
 */
const currencyRadios = () =>
  [...document.body.querySelectorAll("[role='radio']")].filter((el) =>
    (el.textContent ?? "").includes("currency."),
  );

function pickCurrency(code: string) {
  const item = currencyRadios().find((el) =>
    (el.textContent ?? "").includes(code),
  );
  if (!item) throw new Error(`통화 항목을 찾지 못했다: ${code}`);
  act(() => item.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

const checkedCurrency = () =>
  currencyRadios()
    .find((el) => el.getAttribute("aria-checked") === "true")
    ?.textContent?.trim() ?? null;

describe("기본 통화는 서버에 저장한다 (QA #124)", () => {
  it("고르면 그 키 하나만 PATCH 로 나간다", () => {
    render();
    openCurrency();
    pickCurrency("USD");

    expect(state.patched).toEqual([{ defaultCurrency: "USD" }]);
  });

  it("localStorage 를 안 쓴다 — 두 저장소가 갈리면 어느 쪽이 참인지 모른다", () => {
    render();
    openCurrency();
    pickCurrency("JPY");

    expect(localStorage.getItem("pd-currency")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("이미 그 값이면 아무것도 안 보낸다", () => {
    state.prefs = { timezone: "Asia/Seoul", defaultCurrency: "KRW" };
    render();
    openCurrency();
    pickCurrency("KRW");

    expect(state.patched).toEqual([]);
  });

  it("서버 값을 그린다 — 로컬이 아니라 계정이 참이다", () => {
    state.prefs = { timezone: "Asia/Seoul", defaultCurrency: "EUR" };
    render();
    const trigger = openCurrency();

    expect(trigger.textContent).toContain("EUR");
    expect(checkedCurrency()).toContain("EUR");
  });

  it("값이 아직 안 왔으면 원화로 그리지 않는다 — 값 글이 비고 칸이 막힌다", () => {
    state.prefs = undefined;
    render();
    const trigger = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.getAttribute("aria-label") === "currency.label")!;

    expect(trigger.disabled).toBe(true);
    expect(trigger.textContent).not.toContain("KRW");
    expect(trigger.textContent).not.toContain("currency.KRW");
  });

  it("받기에 실패한 상태에서는 지역 · 통화 줄이 [다시 시도]로 바뀌어 저장 요청이 나갈 길이 없다 — 기본값이 서버 값을 덮지 않는다", () => {
    state.prefs = undefined;
    render();

    const labels = [...document.body.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels.filter((l) => l === "common.retry")).toHaveLength(2);
    expect(
      [...document.body.querySelectorAll("button")].some(
        (b) => b.getAttribute("aria-label") === "currency.label",
      ),
    ).toBe(false);
    expect(state.patched).toEqual([]);
  });

  it("지역 고르기만 끝 흐림을 켜고 통화 고르기는 켜지 않는다", () => {
    render();
    const open = (label: string) => {
      const t = [
        ...document.body.querySelectorAll<HTMLButtonElement>("button"),
      ].find((b) => b.getAttribute("aria-label") === label)!;
      act(() => t.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    };
    open("currency.label");
    expect(document.body.querySelector("[data-scroll-fog]")).toBeNull();
    // 통화 시트를 닫고(Esc) 지역을 연다
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    open("region.label");
    expect(
      document.body.querySelector("[data-scroll-fog=overlayBody]"),
    ).not.toBeNull();
  });
});
