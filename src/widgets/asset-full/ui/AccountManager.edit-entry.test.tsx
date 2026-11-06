// 자산 하나의 수정 폼으로 **바로** 가는 주소(D9, 2026-09-21 사용자 확정).
//
// 결제가 끝난 회차의 카드 거래를 환불·삭제·고쳐 쓰면 통장은 그대로라 사용자가 결제계좌
// 잔액을 고친다. 그 길이 "자산 → 상세 → 수정 → 관리 목록 → 연필 → 잔액" 으로 길었다.
// 토스트의 [잔액 고치기] 와 자산 상세의 [수정] 이 `?edit=<rowId>` 로 이 화면에 와서 그
// 자산의 폼을 연다. (QA 12차엔 "편집은 설정 목록에서만" 으로 이 주소를 걷었는데, D9 가
// 그 결정을 대체했다. 폼은 여전히 이 화면 하나에만 있다 — 여는 주소가 하나 늘었을 뿐이다.)
//
// 잠그는 것: ① 그 자산의 폼이 열린다 ② 탭이 없어 묶음 넷이 한 목록에 있다(I-17 25) ③ 쓰고 나면 주소에서
// 지운다(남으면 섹션을 다녀올 때마다 다시 열린다) ④ 목록이 늦게 와도 연다 ⑤ 없는 자산이면 목록만
// ⑥ 줄을 누르면 상세가 열리고 상세의 [수정] 이 폼을 연다(줄에 연필 · ⋮ 는 없다 — 10-25).
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 저장 · 실패 알림이 useSnackbar 를 쓴다 — 앱 맨 위(src/app/index.tsx)처럼 공급자로 감싼다
import { SnackbarProvider } from "@/shared/ds/snackbar";
import { editAssetPath, type Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  assets: [] as unknown[],
  isLoading: false,
  /** 열린 편집 폼이 무엇을 받았는지. */
  opened: null as { rowId: number | null } | null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/asset")>()),
  // 라이브 평가는 이 시험 밖 — 빈 맵(연결 없음)
  useInvestValuation: () => new Map(),
  useAssets: () => ({
    data: { assets: state.assets },
    isLoading: state.isLoading,
    isError: false,
    refetch: () => {},
  }),
  useCreateAsset: () => ({ mutate: () => {}, isPending: false }),
  useUpdateAsset: () => ({ mutate: () => {}, isPending: false }),
  useDeleteAsset: () => ({ mutate: () => {}, isPending: false }),
}));
// 편집 폼 자체는 자기 쿼리를 여럿 건다 — 여기선 "어느 자산으로 열렸는가" 만 본다(종류는 폼이 자산에서 잰다 — I-17 8).
vi.mock("./AssetEditDialog", () => ({
  AssetEditDialog: (p: { item: { rowId: number } | null }) => {
    state.opened = { rowId: p.item?.rowId ?? null };
    return null;
  },
}));
const { AccountManager } = await import("./AccountManager");

const assetOf = (rowId: number, assetType: string, assetName: string) =>
  ({
    rowId,
    assetName,
    assetType,
    balance: 1000,
    institution: null,
    color: null,
    memo: null,
    isIncludedInTotal: "Y",
    createAt: "2026-01-01T00:00:00",
    modifyAt: "2026-01-01T00:00:00",
  }) as unknown as Asset;

let container: HTMLDivElement;
let root: Root;
let seen: string | null = null;

/** 주소가 실제로 어떻게 남았는지 읽어 둔다. */
function Spy() {
  const loc = useLocation();
  // 렌더 중에 바깥 변수를 건드리지 않는다 — effect 로 옮긴다(`act` 가 flush 한다).
  useEffect(() => {
    seen = `${loc.pathname}${loc.search}`;
  });
  return null;
}

let entry = "/desk/settings?section=accounts";

/** 같은 자리에 같은 타입을 그린다 — 언마운트 없이 다시 그리는 것과 같다.
 *  (`MemoryRouter` 는 `initialEntries` 를 마운트할 때 한 번만 읽는다.) */
const tree = () => (
  <SnackbarProvider>
    <MemoryRouter initialEntries={[entry]}>
      <Spy />
      <AccountManager mobile={false} />
    </MemoryRouter>
  </SnackbarProvider>
);

function render(url: string) {
  entry = url;
  act(() => root.render(tree()));
}

function rerender() {
  act(() => root.render(tree()));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.assets = [
    assetOf(7, "BANK_ACCOUNT", "주거래"),
    assetOf(9, "CREDIT_CARD", "신용카드"),
  ];
  state.isLoading = false;
  state.opened = null;
  seen = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("자산 수정 폼 바로 가기(D9)", () => {
  it("[잔액 고치기]·자산 상세가 만든 주소로 들어오면 그 자산의 폼이 열린다", () => {
    render(editAssetPath(7));
    expect(state.opened).toEqual({ rowId: 7 });
  });

  it("탭이 없다 — 어느 자산의 폼이 열려도 뒤에는 묶음 넷이 한 목록으로 있다", () => {
    render(editAssetPath(9));
    expect(state.opened).toEqual({ rowId: 9 });
    const list = document.body.textContent ?? "";
    expect(list).toContain("신용카드");
    expect(list).toContain("주거래");
    expect(document.body.querySelector('[role="tab"]')).toBeNull();
  });

  it("쓰고 나면 주소에서 지운다 — 남으면 섹션을 다녀올 때마다 다시 열린다", () => {
    render(editAssetPath(7));
    expect(seen).toBe("/desk/settings?section=accounts");
  });

  it("목록이 아직 안 왔으면 기다렸다가 연다 — 주소는 그 사이에 이미 지워진다", () => {
    // 받아 두지 않으면 여기서 사라진다: 주소를 터는 건 목록을 기다려 주지 않기 때문이다.
    state.isLoading = true;
    render(editAssetPath(7));
    expect(state.opened).toBeNull();
    expect(seen).toBe("/desk/settings?section=accounts");

    // 같은 자리에 다시 그린다 = 언마운트 없이 목록만 도착한 상황.
    state.isLoading = false;
    rerender();
    expect(state.opened).toEqual({ rowId: 7 });
  });

  it("없는 자산(지웠거나 남의 것)이면 목록만 보여 준다 — 빈 폼을 열지 않는다", () => {
    render(editAssetPath(404));
    expect(state.opened).toBeNull();
    expect(document.body.textContent ?? "").toContain("주거래");
  });

  it("줄을 누르면 상세 페이지 주소로 간다 — 시트 · 대화상자를 띄우지 않는다(I-17 36)", () => {
    render("/desk/settings?section=accounts");
    expect(state.opened).toBeNull();
    const rowBtn = [
      ...document.body.querySelectorAll<HTMLButtonElement>(
        "[data-list-action]",
      ),
    ].find((b) => b.textContent?.includes("주거래"));
    expect(rowBtn).toBeDefined();
    act(() =>
      rowBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(seen).toBe("/desk/asset/7");
    expect(state.opened).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
