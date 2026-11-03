// 자산 상세 페이지 틀(I-17 34 ~ 43 · 52) — 없는 id · 폰 상단 바 · 데스크톱 "‹ {부모}" · 금액 가리기 Toggle · 지우기
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  mobile: true,
  assets: [] as unknown[],
  updated: [] as unknown[],
  deleted: [] as number[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.name ? `${k}:${String(o.name)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: { assets: st.assets },
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
  useUpdateAsset: () => ({
    mutate: (v: unknown) => st.updated.push(v),
    isPending: false,
  }),
  useDeleteAsset: () => ({
    mutate: (id: number, o?: { onSuccess?: () => void }) => {
      st.deleted.push(id);
      o?.onSuccess?.();
    },
    isPending: false,
  }),
  holdingsOf: () => [],
}));
// 본문 · 폼 · 본인 확인 표면은 이 시험의 주장이 아니다 — 껍데기로 바꾼다
vi.mock("@/widgets/asset-full", () => ({
  AssetDetailView: () => <div data-testid="detail-view" />,
  AssetLogo48: () => <span />,
  useAssetDescription: () => "설명",
}));
vi.mock("@/widgets/asset-full/ui/AssetEditDialog", () => ({
  AssetEditDialog: () => <div data-testid="edit-form" />,
}));
vi.mock("@/widgets/account-settings/ui/HideAmountsUnlockSurface", () => ({
  HideAmountsUnlockSurface: ({ open }: { open: boolean }) =>
    open ? <div data-testid="unlock" /> : null,
}));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ mobile: st.mobile }),
}));

const { AssetDetailPage } = await import("./AssetDetailPage");

const asset = {
  rowId: 9,
  assetName: "신한 주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_000,
  isAmountHidden: "N",
} as unknown as Asset;

let container: HTMLDivElement;
let root: Root;
const seenRef = { current: "" };

function Spy() {
  const loc = useLocation();
  useEffect(() => {
    seenRef.current = `${loc.pathname}${loc.search}`;
  });
  return null;
}

function render(path: string, state?: unknown) {
  act(() =>
    root.render(
      <MemoryRouter
        key={`${path}${JSON.stringify(state)}`}
        initialEntries={[{ pathname: path, state }]}
      >
        <Spy />
        <Routes>
          <Route path="/desk/asset/:assetId" element={<AssetDetailPage />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const byName = (name: string) =>
  [...document.body.querySelectorAll("button, a")].find(
    (b) =>
      b.getAttribute("aria-label") === name ||
      (b.textContent ?? "").trim() === name,
  );

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  st.mobile = true;
  st.assets = [asset];
  st.updated = [];
  st.deleted = [];
  seenRef.current = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("자산 상세 페이지 — 없는 id (I-17 38)", () => {
  it("없는 자산 · 숫자가 아닌 id 는 결과 화면 + [자산으로] 다", () => {
    render("/desk/asset/999");
    expect(document.body.textContent).toContain("assetDetail.notFoundTitle");
    expect(
      document.body.querySelector('[data-testid="detail-view"]'),
    ).toBeNull();
    click(byName("assetDetail.toAssets")!);
    expect(seenRef.current).toBe("/desk/asset");

    render("/desk/asset/abc");
    expect(document.body.textContent).toContain("assetDetail.notFoundTitle");
  });
});

describe("폰 상단 바 (I-17 41)", () => {
  it("오른쪽은 아이콘 버튼 둘 — 이름 '수정'(edit) · '{이름} 더보기' — 글 버튼이 없다", () => {
    render("/desk/asset/9");
    expect(byName("edit")).toBeDefined();
    expect(byName("assetDetail.moreOf:신한 주거래")).toBeDefined();
    expect(document.body.querySelector("h1")?.textContent).toBe(
      "assetDetail.titleAccount",
    );
    // 금액 가리기 단추는 폰에 없다(수정 폼이 유일한 해제 길)
    expect(byName("assetDetail.hideAmounts")).toBeUndefined();
  });

  it("[수정] 은 주소를 옮기지 않고 폼을 연다", () => {
    render("/desk/asset/9");
    click(byName("edit")!);
    expect(
      document.body.querySelector('[data-testid="edit-form"]'),
    ).not.toBeNull();
    expect(seenRef.current).toBe("/desk/asset/9");
  });
});

describe("데스크톱 · 태블릿 (I-17 42 · 43 · 52)", () => {
  beforeEach(() => {
    st.mobile = false;
  });

  it("'‹ 자산' — 주소로 바로 열었거나 자산 화면에서 왔으면 /desk/asset", () => {
    render("/desk/asset/9");
    const link = document.body.querySelector("a");
    expect(link?.textContent).toContain("asset");
    expect(link?.getAttribute("href")).toBe("/desk/asset");
  });

  it("'‹ 계좌·카드 관리' — state.from 이 accounts 이면 관리 화면", () => {
    render("/desk/asset/9", { from: "accounts" });
    const link = document.body.querySelector("a");
    expect(link?.textContent).toContain("manager.title");
    expect(link?.getAttribute("href")).toBe("/desk/settings?section=accounts");
  });

  it("제목 줄 h1 = 자산 이름 · 동작은 Toggle · [수정] · ⋯ 셋", () => {
    render("/desk/asset/9");
    expect(document.body.querySelector("h1")?.textContent).toBe("신한 주거래");
    expect(byName("assetDetail.hideAmounts")).toBeDefined();
    expect(byName("edit")).toBeDefined();
    expect(byName("assetDetail.moreOf:신한 주거래")).toBeDefined();
  });

  it("가리지 않은 자산 — Toggle 을 켜면 바로 가린다(본인 확인 없음)", () => {
    render("/desk/asset/9");
    const toggle = byName("assetDetail.hideAmounts")!;
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    click(toggle);
    expect(st.updated).toHaveLength(1);
    expect(
      (st.updated[0] as { data: { isAmountHidden: string } }).data
        .isAmountHidden,
    ).toBe("Y");
    expect(document.body.querySelector('[data-testid="unlock"]')).toBeNull();
  });

  it("가린 자산 — Toggle 이 눌린 상태고, 끄면 본인 확인 표면이 열리며 저장은 확인 뒤다", () => {
    st.assets = [{ ...asset, isAmountHidden: "Y" }];
    render("/desk/asset/9");
    const toggle = byName("assetDetail.hideAmounts")!;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    click(toggle);
    expect(
      document.body.querySelector('[data-testid="unlock"]'),
    ).not.toBeNull();
    expect(st.updated).toHaveLength(0);
  });
});
