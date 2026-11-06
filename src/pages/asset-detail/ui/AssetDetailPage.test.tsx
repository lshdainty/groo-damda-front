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
  /** useUpdateAsset 에 넘긴 옵션 — 둘 다 silent 라야 서버 원문 토스트가 안 뜬다 */
  hookOpts: [] as unknown[],
  /** true 면 mutate 가 곧바로 실패한다 */
  fail: false,
  /** true 면 mutate 가 끝나지 않는다(요청 중) — onSettled 는 시험이 직접 부른다 */
  hang: false,
  settles: [] as Array<() => void>,
  snacks: [] as Array<Record<string, unknown>>,
  editProps: null as null | {
    onUpdate: (v: unknown) => void;
    saveFailed?: boolean;
  },
  failedOnce: false,
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
  useUpdateAsset: (opts?: unknown) => {
    st.hookOpts.push(opts);
    return {
      mutate: (
        v: unknown,
        o?: {
          onSuccess?: () => void;
          onError?: () => void;
          onSettled?: () => void;
        },
      ) => {
        st.updated.push(v);
        if (st.hang) {
          if (o?.onSettled) st.settles.push(o.onSettled);
          return;
        }
        if (st.fail) {
          st.failedOnce = true;
          o?.onError?.();
        } else o?.onSuccess?.();
        o?.onSettled?.();
      },
      reset: () => {
        st.failedOnce = false;
      },
      isPending: false,
      isError: st.failedOnce,
      error: st.failedOnce ? new Error("x") : null,
    };
  },
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
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: Record<string, unknown>) => st.snacks.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("@/widgets/asset-full/ui/AssetEditDialog", () => ({
  AssetEditDialog: (p: {
    onUpdate: (v: unknown) => void;
    saveFailed?: boolean;
  }) => {
    st.editProps = p;
    return <div data-testid="edit-form" />;
  },
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
  st.hookOpts = [];
  st.fail = false;
  st.hang = false;
  st.settles = [];
  st.snacks = [];
  st.editProps = null;
  st.failedOnce = false;
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

describe("저장 실패 알림 — 서버 글 토스트 없이 고정 글 (I-28-5 자산 A)", () => {
  beforeEach(() => {
    st.mobile = false;
  });

  it("요청은 둘 다 silent — 서버 원문 토스트가 안 뜬다", () => {
    render("/desk/asset/9");
    expect(st.hookOpts.length).toBeGreaterThan(0);
    for (const o of st.hookOpts) expect(o).toEqual({ silent: true });
  });

  it("숨김 토글이 실패하면 값은 그대로(되돌림) + critical 스낵바 한 문장, [다시 시도] 없음", () => {
    st.fail = true;
    render("/desk/asset/9");
    const toggle = byName("assetDetail.hideAmounts")!;
    click(toggle);
    expect(st.snacks).toEqual([
      { message: "assetDetail.hideFailed", tone: "critical" },
    ]);
    expect(st.snacks[0]).not.toHaveProperty("action");
    // 서버 값이 안 바뀌었으니 눌림은 그대로 꺼진 채
    expect(
      byName("assetDetail.hideAmounts")!.getAttribute("aria-pressed"),
    ).toBe("false");
    // 폼 Callout 으로 새지 않는다
    expect(document.body.querySelector('[data-testid="edit-form"]')).toBeNull();
  });

  it("숨김 토글이 성공하면 스낵바가 없다", () => {
    render("/desk/asset/9");
    click(byName("assetDetail.hideAmounts")!);
    expect(st.snacks).toHaveLength(0);
  });

  it("수정 폼 저장이 실패하면 폼은 열린 채 saveFailed — 스낵바는 없다", () => {
    st.fail = true;
    render("/desk/asset/9");
    click(byName("edit")!);
    act(() => st.editProps!.onUpdate({ assetName: "새 이름" }));
    expect(
      document.body.querySelector('[data-testid="edit-form"]'),
    ).not.toBeNull();
    expect(st.snacks).toHaveLength(0);
    // 다시 그려진 뒤의 props 에 saveFailed 가 실린다
    render("/desk/asset/9");
    click(byName("edit")!);
    expect(st.editProps!.saveFailed).toBe(true);
  });

  it("수정 저장은 같은 틱에 두 번 눌러도 요청 한 번 — 끝나면 다시 된다", () => {
    st.hang = true;
    render("/desk/asset/9");
    click(byName("edit")!);
    act(() => {
      st.editProps!.onUpdate({ assetName: "새 이름" });
      st.editProps!.onUpdate({ assetName: "새 이름" });
    });
    expect(st.updated).toHaveLength(1);
    act(() => st.settles.forEach((f) => f()));
    act(() => st.editProps!.onUpdate({ assetName: "새 이름" }));
    expect(st.updated).toHaveLength(2);
  });
});
