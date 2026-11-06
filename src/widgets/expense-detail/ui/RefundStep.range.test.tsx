// 환불일 범위 (I-21 I 46 · D16) — 환불일은 거래한 날부터 오늘까지만 고른다. 달력(Date Picker)에 그 두 날이 min · max 로 간다.
// 시험은 작성만 한다(UI 이관이 끝날 때까지 돌리지 않는다 — 10-30 사용자).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import { dayKey } from "@/shared/ds/date-picker";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const seen = vi.hoisted(() => ({
  props: null as null | { min?: Date; max?: Date },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  // 환불 확인 본문은 <Trans> 로 굵은 금액을 끼운다 — 여기서는 키만 그린다
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/date-picker", async (orig) => {
  const real = await orig<typeof import("@/shared/ds/date-picker")>();
  return {
    ...real,
    DatePicker: (p: { min?: Date; max?: Date }) => {
      seen.props = { min: p.min, max: p.max };
      return <div data-testid="picker" />;
    },
  };
});

const { RefundStep } = await import("./RefundStep");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  seen.props = null;
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("환불일은 거래한 날 ~ 오늘만 고른다", () => {
  it("달력의 min 은 거래한 날, max 는 오늘이다 — 그 밖의 날은 누를 수 없다", () => {
    act(() =>
      root.render(
        <RefundStep
          amount={3000}
          kind="expense"
          txDay="2026-09-05"
          today="2026-09-20"
          value="2026-09-20"
          onChange={() => {}}
          closedSpan={null}
          assetName="현대카드"
          cardNoPaymentAccount={false}
        />,
      ),
    );
    act(() => {
      document
        .querySelector<HTMLElement>("[data-testid=refund-date-row]")!
        .click();
    });
    expect(seen.props).not.toBeNull();
    expect(dayKey(seen.props!.min!)).toBe("2026-09-05");
    expect(dayKey(seen.props!.max!)).toBe("2026-09-20");
  });
});
