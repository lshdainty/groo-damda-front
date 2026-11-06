// 계좌·카드 폼 저장 실패(I-28-5 자산 A) — 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글), 값은 남김, 이중 제출 가드.
//
// 잠그는 것: ① 요청은 silent ② 실패해도 폼은 열린 채 saveFailed ③ 같은 틱 두 번 눌러도 요청 한 번(끝나면 다시 됨)
// ④ 닫으면 실패 상태를 비운다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 저장 · 실패 알림이 useSnackbar 를 쓴다 — 앱 맨 위(src/app/index.tsx)처럼 공급자로 감싼다
import { SnackbarProvider } from "@/shared/ds/snackbar";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  createOpts: [] as unknown[],
  updateOpts: [] as unknown[],
  createCalls: 0,
  updateCalls: 0,
  settles: [] as Array<() => void>,
  resets: 0,
  failed: false,
  dialog: null as null | {
    item: { rowId: number } | null;
    saveFailed?: boolean;
    onCreate: (v: unknown) => void;
    onUpdate: (v: unknown) => void;
    onClose: () => void;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/asset")>()),
  useInvestValuation: () => new Map(),
  useInvestValuationState: () => ({
    map: new Map(),
    priceFailed: false,
    retryPrices: () => {},
  }),
  useAssets: () => ({
    data: {
      assets: [
        {
          rowId: 7,
          assetName: "주거래",
          assetType: "BANK_ACCOUNT",
          balance: 1000,
          isIncludedInTotal: "Y",
        } as unknown as Asset,
      ],
    },
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateAsset: (o?: unknown) => {
    st.createOpts.push(o);
    return {
      mutate: (_v: unknown, c?: { onSettled?: () => void }) => {
        st.createCalls++;
        if (c?.onSettled) st.settles.push(c.onSettled);
      },
      reset: () => {
        st.resets++;
        st.failed = false;
      },
      isPending: false,
      isError: st.failed,
      error: st.failed ? new Error("x") : null,
    };
  },
  useUpdateAsset: (o?: unknown) => {
    st.updateOpts.push(o);
    return {
      mutate: (_v: unknown, c?: { onSettled?: () => void }) => {
        st.updateCalls++;
        if (c?.onSettled) st.settles.push(c.onSettled);
      },
      reset: () => {},
      isPending: false,
      isError: false,
      error: null,
    };
  },
  useDeleteAsset: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("./AssetEditDialog", () => ({
  AssetEditDialog: (p: NonNullable<typeof st.dialog>) => {
    st.dialog = p;
    return <div data-testid="asset-dialog" />;
  },
}));
const { AccountManager } = await import("./AccountManager");

let container: HTMLDivElement;
let root: Root;
const draw = (addRequest = 0) =>
  act(() =>
    root.render(
      <SnackbarProvider>
        <MemoryRouter>
          <AccountManager mobile={false} addRequest={addRequest} />
        </MemoryRouter>
      </SnackbarProvider>,
    ),
  );

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(st, {
    createOpts: [],
    updateOpts: [],
    createCalls: 0,
    updateCalls: 0,
    settles: [],
    resets: 0,
    failed: false,
    dialog: null,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  draw();
  draw(1); // 바깥 "추가" — 추가 폼이 열린다
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("계좌·카드 폼 저장 실패", () => {
  it("추가 · 수정 요청은 silent — 서버 원문 토스트가 안 뜬다", () => {
    expect(st.createOpts.length).toBeGreaterThan(0);
    for (const o of [...st.createOpts, ...st.updateOpts])
      expect(o).toEqual({ silent: true });
  });

  it("같은 틱에 두 번 눌러도 요청은 한 번 — 끝나면(성공 · 실패) 다시 된다", () => {
    act(() => {
      st.dialog!.onCreate({ assetName: "a" });
      st.dialog!.onCreate({ assetName: "a" });
    });
    expect(st.createCalls).toBe(1);
    act(() => st.settles.forEach((f) => f()));
    act(() => st.dialog!.onCreate({ assetName: "a" }));
    expect(st.createCalls).toBe(2);
  });

  it("실패해도 폼은 열린 채 — saveFailed 가 실리고, 닫으면 비운다", () => {
    act(() => st.dialog!.onCreate({ assetName: "a" }));
    st.failed = true;
    draw(1);
    expect(
      document.body.querySelector('[data-testid="asset-dialog"]'),
    ).not.toBeNull();
    expect(st.dialog!.saveFailed).toBe(true);
    const before = st.resets;
    act(() => st.dialog!.onClose());
    expect(st.resets).toBeGreaterThan(before);
    expect(
      document.body.querySelector('[data-testid="asset-dialog"]'),
    ).toBeNull();
  });
});
