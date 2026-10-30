// 이체 상세 (I-21 21-1 C 15 ~ 18) — 거래 상세와 한 벌: 제목 "이체 상세" · 보내는 / 받는 계좌 Logo Tile 줄 · 값 줄 · "더 하기" 반복 설정 · [삭제][수정].
// 실제 상세를 띄운다(ds 시트까지). `t` 는 키를 그대로 돌려주므로 줄 · 버튼은 키로 집는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetTransfer } from "@/entities/asset";
import { click, hasButton, lastButton, setupDetailDom } from "./test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const api = vi.hoisted(() => ({
  assets: [] as unknown[],
  deleteCalls: [] as { id: number; silent?: boolean }[],
  deleteFail: false,
  snacks: [] as {
    message: string;
    tone?: string;
    action?: { label: string; onClick: () => void };
  }[],
  confirms: [] as { title: string; message: unknown; danger?: boolean }[],
  recurringSeed: null as unknown,
  /** 끼운 수정 폼이 값 하나를 치는 단계에 있다 */
  embedInSub: false,
  begun: null as unknown,
  parts: null as
    | null
    | (Record<string, unknown> & {
        onBack: () => void;
        inSub: boolean;
        onDone: () => void;
      }),
  addTx: null as null | {
    editTransfer?: AssetTransfer;
    onTransferSaved?: (t: AssetTransfer) => void;
    onBack?: () => void;
    embed?: (parts: Record<string, unknown>) => React.ReactNode;
    onClose: () => void;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: (typeof api.snacks)[number]) => api.snacks.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/ui/groo/dialogs", () => ({
  ConfirmDialog: (p: {
    title: string;
    message: unknown;
    danger?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }) => {
    api.confirms.push({
      title: p.title,
      message: p.message,
      danger: p.danger,
    });
    return (
      <div role="alertdialog" data-testid="confirm">
        <h2>{p.title}</h2>
        <button data-testid="confirm-cancel" onClick={p.onCancel} />
        <button data-testid="confirm-ok" onClick={p.onConfirm} />
      </div>
    );
  },
}));
vi.mock("@/widgets/add-tx", () => ({
  // 수정 폼은 상세가 한 번 들고(useTxForm) 같은 시트 안 한 단계로 끼운다(7a) — 호스트가 넘기는 인자와 조각만 본다
  useTxForm: (p: NonNullable<typeof api.addTx>) => {
    api.addTx = p;
    return {
      main: "2",
      sub: null,
      beginEdit: (seed: unknown) => {
        api.begun = seed;
      },
    };
  },
  useTxSheetParts: (
    _f: unknown,
    o: { onBack?: () => void; onClose: () => void },
  ) => {
    api.parts = {
      title: "addTx.editTitle",
      body: <div data-testid="add-tx-sheet" />,
      footer: () => null,
      dirty: false,
      onBack: () => o.onBack?.(),
      inSub: api.embedInSub,
      onDone: () => {},
      overlays: null,
      bodyRef: { current: null },
    };
    return { embedParts: api.parts, overlays: null };
  },
}));
vi.mock("@/features/recurring-transaction/ui/RecurringAddDialog", () => ({
  RecurringAddDialog: (p: { transferSeed: unknown }) => {
    api.recurringSeed = p.transferSeed;
    return <div data-testid="recurring-add" />;
  },
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: api.assets }, isLoading: false }),
  useDeleteTransfer: () => ({
    mutate: (
      vars: { id: number; silent?: boolean },
      opts?: { onSuccess?: () => void; onError?: () => void },
    ) => {
      api.deleteCalls.push(vars);
      if (api.deleteFail) opts?.onError?.();
      else opts?.onSuccess?.();
    },
    isPending: false,
  }),
}));

const { TransferDetailDialog } = await import("./TransferDetailDialog");
const { i18n: appI18n } = await import("@/shared/i18n/config");

const transfer = (over: Partial<AssetTransfer> = {}): AssetTransfer => ({
  rowId: 7,
  userRowId: 1,
  fromAssetRowId: 1,
  fromAssetName: "월급 통장",
  toAssetRowId: 2,
  toAssetName: "저축 통장",
  amount: 300000,
  fee: 0,
  interestAmount: 0,
  principalAmount: 300000,
  description: null,
  autoSource: null,
  transferDate: "2026-09-05T10:30:00",
  createAt: "2026-09-05T10:30:00",
  ...over,
});

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupDetailDom(false);
  api.assets = [
    { rowId: 1, assetName: "월급 통장", institution: "한빛은행" },
    { rowId: 2, assetName: "저축 통장", institution: null },
  ];
  api.deleteCalls = [];
  api.deleteFail = false;
  api.snacks = [];
  api.confirms = [];
  api.recurringSeed = null;
  api.addTx = null;
  api.embedInSub = false;
  api.begun = null;
  api.parts = null;
  onClose.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 200));
});

function render(t: AssetTransfer = transfer()) {
  act(() =>
    root.render(
      <TransferDetailDialog transfer={t} mobile={false} onClose={onClose} />,
    ),
  );
}

const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]")!;
const title = () =>
  sheet().querySelector("[data-slot=bottom-sheet-title]")!.textContent;
const kv = () =>
  document.body.querySelector("[data-slot=tx-detail-kv]")?.textContent ?? "";
const accounts = () =>
  document.body.querySelector("[data-slot=transfer-detail-accounts]")!;
const footerButtons = () => [
  ...sheet().querySelectorAll("[data-slot=bottom-sheet-footer] button"),
];

describe("C 15 · 16 — 거래 상세와 한 벌", () => {
  it('제목은 "이체 상세" — 머리에 이름 · 금액 · 날짜가 있고 값 줄에는 금액 · 날짜 줄이 없다', () => {
    render();
    expect(title()).toBe("transferDetailTitle");
    const head = document.querySelector("[data-slot=tx-detail-head]")!;
    expect(head.textContent).toContain("addTx.transfer");
    expect(head.textContent).toContain("300,000원");
    expect(kv()).not.toContain("form.amount");
    expect(kv()).not.toContain("form.date");
  });

  it('이름은 "보내는 계좌 · 받는 계좌" 한 벌 — 옛 "출금 · 입금 계좌" 가 아니다', () => {
    render();
    expect(accounts().textContent).toContain("transferFromLabel");
    expect(accounts().textContent).toContain("transferToLabel");
    expect(document.body.textContent).not.toContain("addTx.fromAccount");
    expect(document.body.textContent).not.toContain("addTx.depositAccount");
  });

  it("계좌 줄은 Logo Tile — 기관이 있으면 기관 이름, 없으면 자산 이름 첫 글자", () => {
    render();
    const tiles = accounts().querySelectorAll("[data-slot=logo-tile]");
    expect(tiles).toHaveLength(2);
    expect(
      tiles[0]!.getAttribute("aria-label") ?? tiles[0]!.textContent,
    ).toBeTruthy();
    // 누르지 않는 보기 줄
    expect(accounts().querySelectorAll("button")).toHaveLength(0);
  });

  it("지운 자산이라 못 찾으면 이름의 첫 글자만 — 줄은 그대로 그린다", () => {
    api.assets = [];
    render();
    expect(accounts().textContent).toContain("월급 통장");
    expect(accounts().querySelectorAll("[data-slot=logo-tile]")).toHaveLength(
      2,
    );
  });

  it("수수료가 있으면 수수료 · 출금 합계(금액 + 수수료)가 있다", () => {
    render(transfer({ fee: 1500 }));
    expect(kv()).toContain("transferFeePrefix");
    expect(kv()).toContain("1,500원");
    expect(kv()).toContain("transferWithdrawn");
    expect(kv()).toContain("301,500원");
  });

  it("수수료가 없으면 두 줄이 없다", () => {
    render();
    expect(kv()).not.toContain("transferFeePrefix");
    expect(kv()).not.toContain("transferWithdrawn");
  });

  it("대출 상환 이자 — 이자 · 원금 줄", () => {
    render(
      transfer({
        amount: 900000,
        interestAmount: 120000,
        principalAmount: 780000,
      }),
    );
    expect(kv()).toContain("addTx.interest");
    expect(kv()).toContain("120,000원");
    expect(kv()).toContain("transferPrincipal");
    expect(kv()).toContain("780,000원");
  });

  it("메모가 없으면 줄이 없고 있으면 값으로 그린다", () => {
    render();
    expect(kv()).not.toContain("memo");
    render(transfer({ description: "월 저축" }));
    expect(kv()).toContain("월 저축");
  });
});

describe("C 15 — 바닥 · 자동 이체", () => {
  it("바닥은 왼쪽 [삭제] · 오른쪽 [수정]", () => {
    render();
    expect(footerButtons().map((b) => b.textContent)).toEqual([
      "delete",
      "edit",
    ]);
  });

  it("자동 이체는 바닥이 없고 왜 못 고치는지 Callout 이 말한다 — 반복 설정 줄도 없다", () => {
    render(transfer({ autoSource: "CARD_PAYMENT" }));
    expect(footerButtons()).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "transferAutoSource.CARD_PAYMENT",
    );
    expect(document.querySelector("[data-testid=more-recurring]")).toBeNull();
  });
});

describe("C 17 · 18 — 반복 설정은 '더 하기' 줄 하나", () => {
  it("값 글 없이 줄 하나 — 누르면 이체 값으로 반복 폼을 연다(시작일 = 이체한 날)", () => {
    render(transfer({ fee: 1500, description: "월 저축" }));
    const row = document.querySelector<HTMLButtonElement>(
      "[data-testid=more-recurring]",
    )!;
    expect(row.closest("li")!.textContent).toBe("txDetail.recurring");
    click(row);
    expect(
      document.querySelector("[data-testid=recurring-add]"),
    ).not.toBeNull();
    expect(api.recurringSeed).toMatchObject({
      fromAssetRowId: 1,
      toAssetRowId: 2,
      amount: 300000,
      fee: 1500,
      description: "월 저축",
      startDate: "2026-09-05",
    });
  });
});

describe("J 49 — 이체 삭제 확인 · 실패는 호출처가 알린다", () => {
  it("critical 확인창 — 요청은 silent 로 나가고 성공하면 닫힌다", () => {
    render();
    click(lastButton("delete"));
    expect(api.confirms.slice(-1)[0]).toMatchObject({
      title: "transferDeleteTitle",
      danger: true,
    });
    click(document.querySelector("[data-testid=confirm-ok]")!);
    expect(api.deleteCalls).toEqual([{ id: 7, silent: true }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("취소하면 아무것도 안 나간다", () => {
    render();
    click(lastButton("delete"));
    click(document.querySelector("[data-testid=confirm-cancel]")!);
    expect(api.deleteCalls).toHaveLength(0);
    expect(document.querySelector("[data-testid=confirm]")).toBeNull();
  });

  it("실패는 확인창을 닫고 고정 글 스낵바 + 다시 시도", () => {
    api.deleteFail = true;
    render();
    click(lastButton("delete"));
    click(document.querySelector("[data-testid=confirm-ok]")!);
    expect(document.querySelector("[data-testid=confirm]")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(api.snacks[0]).toMatchObject({
      message: "transferDeleteFailed",
      tone: "critical",
    });
    api.deleteFail = false;
    act(() => api.snacks[0]!.action!.onClick());
    expect(api.deleteCalls).toHaveLength(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("7a — [수정] 은 상세 위에서 수정 폼을 열고 저장하면 상세로 돌아와 응답 값을 보인다", () => {
  it("[수정] → 수정 폼 · 저장 응답으로 상세가 다시 그려진다", () => {
    render();
    click(lastButton("edit"));
    expect(api.addTx!.editTransfer!.rowId).toBe(7);
    expect(hasButton("edit")).toBe(false);
    act(() => {
      api.addTx!.onTransferSaved!(transfer({ amount: 999000 }));
      api.addTx!.onClose();
    });
    expect(document.querySelector("[data-testid=add-tx-sheet]")).toBeNull();
    expect(
      document.querySelector("[data-slot=tx-detail-head]")!.textContent,
    ).toContain("999,000원");
  });

  it("저장 없이 닫으면 옛 값 그대로", () => {
    render();
    click(lastButton("edit"));
    act(() => api.addTx!.onClose());
    expect(
      document.querySelector("[data-slot=tx-detail-head]")!.textContent,
    ).toContain("300,000원");
  });
});
