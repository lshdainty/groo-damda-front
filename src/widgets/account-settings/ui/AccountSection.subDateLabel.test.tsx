// 설정 화면의 구독 줄도 **결제일이 아니라 종료일**로 말한다 — #384 의 나머지 절반.
//
// 서버는 해지에서 `autoRenew=false` 만 적고 만료일을 앞당기지 않는다(desk-back #332).
// 그래서 해지한 사람도 남은 기간 동안 Pro 로 서는데, 구독 배너(SubscriptionDialog)는
// 이미 그날을 종료일로 말하게 고쳤고(#384) 설정 화면만 '다음 결제 {{date}} · Pro 이용 중'
// 으로 남아 있었다 — **같은 날짜를 두 화면이 다르게 부른다.**
//
// 여기서 잠그는 건 셋이다:
// ① 자동갱신이 꺼졌으면 종료일 키로 말한다 ② 켜져 있으면 종전 '다음 결제' 그대로다
// ③ 값이 안 왔으면(undefined) 종전 동작이다 — `=== false` 로 좁힌 이유가 이것이다.
//
// t() 는 키와 날짜를 그대로 흘려보내므로 이 파일은 **CSV 행이 사라져도 안 깨진다** —
// 행의 존재는 tests/subscription-date-copy.test.ts 가 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, p?: { date?: string }) => (p?.date ? `${k}:${p.date}` : k),
    i18n: { language: "ko" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { SubscriptionRow } = await import("./AccountSection");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** `nextBill` 은 SettingsPage 가 이미 로컬 날짜로 옮겨 넘기는 값이다(그 계산은 그대로 쓴다). */
function render(over: {
  isPro?: boolean;
  nextBill?: string | null;
  autoRenew?: boolean;
}) {
  act(() =>
    root.render(
      <SubscriptionRow
        isPro={over.isPro ?? true}
        nextBill={over.nextBill === undefined ? "2026-10-11" : over.nextBill}
        autoRenew={over.autoRenew}
        onClick={() => {}}
        mobile={false}
      />,
    ),
  );
  return container.textContent ?? "";
}

describe("설정 화면 구독 줄의 날짜 라벨", () => {
  it("자동갱신이 꺼졌으면 종료일로 말한다 — '다음 결제'가 아니다", () => {
    const text = render({ autoRenew: false });

    expect(text).toContain("account.sub.proActiveUntil:2026-10-11");
    expect(text).not.toContain("account.sub.proActiveBill");
  });

  it("자동갱신이 켜져 있으면 종전 '다음 결제' 문구 그대로다", () => {
    const text = render({ autoRenew: true });

    expect(text).toContain("account.sub.proActiveBill:2026-10-11");
    expect(text).not.toContain("account.sub.proActiveUntil");
  });

  it("구독 조회가 아직 안 왔으면 종전 동작이다", () => {
    const text = render({ autoRenew: undefined });

    expect(text).toContain("account.sub.proActiveBill:2026-10-11");
    expect(text).not.toContain("account.sub.proActiveUntil");
  });

  it("만료일이 없으면 날짜 없이 그냥 'Pro 이용 중' 이다 — 안 터진다", () => {
    const text = render({ autoRenew: false, nextBill: null });

    expect(text).toContain("account.sub.proActive");
    expect(text).not.toContain("account.sub.proActiveUntil");
    expect(text).not.toContain("account.sub.proActiveBill");
  });

  it("Pro 가 아니면 종전대로 권유 문구가 선다", () => {
    const text = render({ isPro: false, autoRenew: false });

    expect(text).toContain("account.sub.proPromo");
    expect(text).not.toContain("account.sub.proActiveUntil");
  });
});
