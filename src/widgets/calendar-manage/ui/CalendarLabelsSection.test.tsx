// 라벨 화면 (I-09 09-3 · 44 ~ 49) — 줄은 누르는 줄(키보드로 닿는다), 데스크톱에만 줄 끝 삭제, 꺾쇠 없음, 실패는 다시 시도.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  q: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: undefined as unknown as () => void,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => () => {},
}));
vi.mock("@/features/event-label", () => {
  const idle = () => ({
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
  });
  return {
    useEventLabels: () => state.q,
    useCreateEventLabel: idle,
    useUpdateEventLabel: idle,
    useDeleteEventLabel: idle,
  };
});

const { CalendarLabelsSection } = await import("./CalendarLabelsSection");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.q = {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const labels = [
  {
    rowId: 1,
    labelName: "가족 행사·경조사 모임",
    color: "#3b82f6",
    usageCount: 2,
  },
];

describe("라벨 화면", () => {
  it("줄은 버튼이고 폰에는 줄 끝 삭제 단추가 없다", () => {
    state.q.data = labels;
    act(() => root.render(<CalendarLabelsSection mobile />));
    const row = container.querySelector("[data-slot=list-item] button");
    expect(row?.textContent).toContain("가족 행사·경조사 모임");
    expect(container.querySelectorAll("[data-slot=list-suffix]").length).toBe(
      0,
    );
  });

  it("데스크톱 줄 끝에는 삭제 단추 하나(꺾쇠 없음)", () => {
    state.q.data = labels;
    act(() => root.render(<CalendarLabelsSection mobile={false} />));
    const suffix = container.querySelector("[data-slot=list-suffix]");
    expect(suffix?.querySelectorAll("button").length).toBe(1);
    expect(suffix?.querySelectorAll("svg.lucide-chevron-right").length).toBe(0);
  });

  it("불러오기 실패는 빈 목록이 아니라 다시 시도를 보인다", () => {
    state.q.isError = true;
    act(() => root.render(<CalendarLabelsSection mobile />));
    expect(container.textContent).toContain("labelsSection.loadFailed");
    expect(container.textContent).not.toContain("noLabels");
  });
});
