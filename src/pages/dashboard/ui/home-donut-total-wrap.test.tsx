// 홈 카테고리 도넛 아래 합계 줄 — 큰 글자에서 금액이 숫자 중간(쉼표 뒤)에서 끊기지 않는다(QA 2026-11-20, 412 · 300%
// "Monthly / Expense" · "₩29, / 430"). Typography v114 "띄어쓰기에서 먼저 넘긴다" — 라벨 옆에 금액이 들지 않으면 금액 낱말을
// 통째로 아래 줄로 넘기고, 쉼표 뒤 꺾기(<wbr>)는 금액 하나가 줄보다 길 때만 먹게 한다.
// jsdom 은 레이아웃이 없어 줄 구조(flex 줄바꿈 · 금액 칸이 눌리지 않음)를 클래스로 본다 — 실제 폭은 크로미움으로 쟀다
// (300% 금액 214.6 < 줄 364 → 한 줄, 라벨 300.5 + 12 + 214.6 > 364 → 아래 줄).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { CategoryBody } = await import("./home-parts");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const slice = (id: number, amount: number) =>
  ({
    id,
    name: `분류 ${id}`,
    amount,
    color: "red",
    fill: "var(--color-chart-red)",
  }) as never;

describe("홈 도넛 합계 줄 — 금액 낱말은 통째로 아래 줄로", () => {
  it("줄은 flex 줄바꿈 · 라벨 최소 8rem · 금액 칸은 눌리지 않고(min-w-0 없음) 아래 줄 오른쪽 끝 · 줄보다 길 때만 쉼표 뒤", () => {
    // QA 데이터 — 교통 10,030 · 문화여가 7,000 · 쇼핑 5,800 · 생활 4,600 · 카페간식 2,000 = 29,430
    act(() =>
      root.render(
        <CategoryBody
          center={false}
          size={120}
          month={11}
          slices={[
            slice(1, 10_030),
            slice(2, 7_000),
            slice(3, 5_800),
            slice(4, 4_600),
            slice(5, 2_000),
          ]}
        />,
      ),
    );
    const row = container.querySelector("[data-slot=home-donut-total]")!;
    expect(row).not.toBeNull();
    const cls = row.className.split(/\s+/);
    expect(cls).toContain("flex-wrap");
    expect(cls).not.toContain("justify-between");
    const [label, amount] = Array.from(row.children) as HTMLElement[];
    expect(label!.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["min-w-[8rem]", "flex-1"]),
    );
    expect(amount!.getAttribute("data-slot")).toBe("donut-total-amount");
    const a = amount!.className.split(/\s+/);
    expect(a).toEqual(expect.arrayContaining(["ms-auto", "max-w-full"]));
    // 금액 칸이 줄어들 수 있으면 라벨 옆에 남은 채 쉼표 뒤에서 꺾인다 — QA 결함의 원인
    expect(a).not.toContain("min-w-0");
    expect(amount!.textContent).toBe("29,430원");
    // 줄보다 긴 금액을 위한 쉼표 뒤 자리는 그대로 — 세 자리 묶음 사이에만
    expect(amount!.innerHTML).toBe("29,<wbr>430원");
  });
});
