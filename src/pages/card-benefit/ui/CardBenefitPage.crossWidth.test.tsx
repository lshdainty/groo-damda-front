// 폭이 768 을 넘나들어도 열린 카드 조회 시트가 다시 붙지 않는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
//
// 종전엔 폰 · 768 이상 두 return 이 시트(`{sheet}`)를 서로 다른 자리에 두어, 폭이 바뀌면
// 시트가 내려갔다 다시 붙으며 상세를 처음부터 다시 불러왔다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  mobile: true,
  mounts: 0,
  unmounts: 0,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: st.mobile, onAddTx: () => {} }),
  useSearchParams: () => [new URLSearchParams(), () => {}],
}));
vi.mock("@/shared/ds/overlay", () => ({ useWideSurface: () => false }));
const card = { rowId: 7, name: "생활 혜택 카드" };
const page = {
  content: [card],
  meta: { totalElements: 1, totalPages: 1 },
};
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogs: () => ({
    data: page,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: async () => {},
  }),
  useInfiniteCardCatalogs: () => ({
    data: { pages: [page] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: async () => {},
    refetch: async () => {},
  }),
}));
vi.mock("./CardRow", () => ({
  CardRow: ({
    card,
    onClick,
  }: {
    card: { name: string };
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {card.name}
    </button>
  ),
}));
vi.mock("./CardFilterBar", () => ({ CardFilterBar: () => null }));
vi.mock("./CardDetailContent", () => ({
  CardDetailContent: () => null,
  DetailSkeleton: () => null,
}));
vi.mock("./CardBenefitDetailDialog", () => ({
  CardBenefitDetailDialog: ({ rowId }: { rowId: number }) => {
    useEffect(() => {
      st.mounts += 1;
      return () => {
        st.unmounts += 1;
      };
    }, []);
    return <div role="dialog" data-row={rowId} />;
  },
}));

const { CardBenefitPage } = await import("./CardBenefitPage");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  st.mobile = true;
  st.mounts = 0;
  st.unmounts = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (mobile: boolean) => {
  st.mobile = mobile;
  act(() => root.render(<CardBenefitPage />));
};

describe("폭이 바뀌어도 조회 시트가 그대로다 (I-wrap-b1 ε 9)", () => {
  it("390 → 844 → 390 — 시트는 한 번 열리고 다시 붙지 않는다", () => {
    render(true);
    const row = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === card.name,
    );
    if (!row) throw new Error("카드 줄을 찾지 못했다");
    act(() => row.click());
    expect(container.querySelector("[role=dialog]")).not.toBeNull();

    render(false);
    render(true);

    expect(
      container.querySelector("[role=dialog]")?.getAttribute("data-row"),
    ).toBe("7");
    expect(st.mounts).toBe(1);
    expect(st.unmounts).toBe(0);
  });
});
