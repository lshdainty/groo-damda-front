// 금액 숨김을 **푸는** 저장은 본인 확인을 기다린다 (QA 22차 #2).
//
// 모바일(웹 드로어·앱)은 상세에 토글이 없어 이 폼이 유일한 해제 경로다. 여기에 확인이
// 없으면 "풀 때는 비밀번호" 규칙은 데스크탑 상세 footer 하나에만 걸린 장식이 된다 —
// 폰에서 스위치를 끄고 저장만 누르면 그냥 풀렸다.
//
// 확인창 **속**은 여기서 안 본다(비밀번호 검증은 그 컴포넌트의 테스트다). 여기서 잠그는
// 건 하나다 — 확인이 끝나기 전에는 저장 본문이 **나가지 않는다.**
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import { installDomStubs } from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
}));
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogs: () => ({ data: undefined, isFetching: false }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSearch: () => ({ data: [], isFetching: false }),
  useStockSymbolName: () => ({ data: undefined }),
}));
vi.mock("@/features/stock/model/useLivePrices", () => ({
  useLivePrices: () => ({
    quoteOf: () => undefined,
    unitKrw: () => null,
    prevUnitKrw: () => null,
    currencyOf: () => undefined,
  }),
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({ data: undefined }),
}));
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: "KRW",
    ready: true,
    ensure: async () => true,
  }),
}));

// 본인 확인 본문은 껍데기로 바꾼다 — 비밀번호 입력·검증은 이 테스트의 주장이 아니다(그 부품의 테스트다).
// 껍데기의 `submit` 은 확인이 끝난 것으로 친다.
vi.mock("@/widgets/account-settings/ui/HideAmountsUnlockBody", () => ({
  HideAmountsUnlockFields: () => <div data-unlock="open" />,
}));
vi.mock("@/widgets/account-settings/ui/use-hide-amounts-unlock", () => ({
  useHideAmountsUnlock: ({ onVerified }: { onVerified: () => void }) => ({
    password: "x",
    setPassword: () => {},
    error: null,
    clearError: () => {},
    pending: false,
    canSubmit: true,
    submit: onVerified,
  }),
}));

const { AssetEditDialog } = await import("./AssetEditDialog");

const account: Asset = {
  userRowId: 1,
  rowId: 9,
  assetName: "신한 주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_200_000,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  institution: "신한",
  memo: null,
  color: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "Y",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

let container: HTMLDivElement;
let root: Root;

type Payload = Record<string, unknown>;
let update: Payload | null;

function open(item: Asset, wide = false) {
  update = null;
  installDomStubs({ wide });
  __resetPointerBlockForTest();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        onClose={() => {}}
        onCreate={() => {}}
        onUpdate={(v) => {
          update = v as unknown as Payload;
        }}
      />,
    ),
  );
}

/** Button 더블클릭 가드(600ms)를 지나간다 — 가드는 클릭 다음 매크로태스크에 풀린다. */
const flushClickGuard = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const click = (el: Element | null | undefined) => {
  if (!el) throw new Error("누를 것을 찾지 못했다");
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};

const hideSwitch = () =>
  document.body.querySelector("#asset-edit-hide-amount") as HTMLElement | null;
const saveButton = () =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "save",
  );
const unlockOpen = () => !!document.body.querySelector('[data-unlock="open"]');
// 인증 단계의 바닥 [금액 보기](확인됨) · 머리 ←(뒤로 — 저장하지 않고 2단계로)
const unlockBtn = (act: "verify" | "cancel") =>
  act === "verify"
    ? [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "hideAmounts.viewAmounts",
      )
    : document.body.querySelector("[data-slot=bottom-sheet-back]");

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installDomStubs();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("금액 숨김 해제 — 폼 저장의 본인 확인", () => {
  it("스위치를 끄고 저장하면 확인창이 뜨고 본문은 안 나간다", () => {
    open(account);
    click(hideSwitch());
    click(saveButton());
    expect(unlockOpen()).toBe(true);
    expect(update).toBeNull();
  });

  it("확인을 취소하면 저장도 안 된다 — 서버 값은 숨김 그대로", () => {
    open(account);
    click(hideSwitch());
    click(saveButton());
    click(unlockBtn("cancel"));
    expect(unlockOpen()).toBe(false);
    expect(update).toBeNull();
  });

  it("확인이 끝나면 N 으로 저장된다", () => {
    open(account);
    click(hideSwitch());
    click(saveButton());
    click(unlockBtn("verify"));
    expect(update).not.toBeNull();
    expect(update!.isAmountHidden).toBe("N");
  });

  it("켜는 쪽은 확인 없이 저장된다", () => {
    open({ ...account, isAmountHidden: "N" });
    click(hideSwitch());
    click(saveButton());
    expect(unlockOpen()).toBe(false);
    expect(update!.isAmountHidden).toBe("Y");
  });

  it("숨김을 건드리지 않은 저장은 확인을 묻지 않는다", () => {
    open(account);
    click(saveButton());
    expect(unlockOpen()).toBe(false);
    expect(update!.isAmountHidden).toBe("Y");
  });

  // 확인을 한 번 받았다고 그 뒤로 계속 열려 있으면 안 된다 — 다시 켜고 다시 끄면
  // 또 물어야 한다.
  it("다시 켜고 또 끄면 확인을 다시 묻는다", async () => {
    open(account);
    click(hideSwitch());
    click(saveButton());
    click(unlockBtn("verify"));
    update = null;
    click(hideSwitch()); // 다시 Y
    click(hideSwitch()); // 또 N
    // 저장 버튼은 같은 fiber 라 Button 의 더블클릭 가드(600ms)가 두 번째 클릭을
    // 버린다 — 가드는 다음 매크로태스크에 스스로 풀린다(WithdrawDialog.test 와 같다).
    await flushClickGuard();
    click(saveButton());
    expect(unlockOpen()).toBe(true);
    expect(update).toBeNull();
  });
});

describe("1280 이상 — 인증 단계도 같은 대화상자", () => {
  it("[취소] 가 있고 누르면 저장하지 않고 2단계로 돌아간다(머리 ← 와 같다)", () => {
    open(account, true);
    click(hideSwitch());
    click(saveButton());
    expect(unlockOpen()).toBe(true);
    expect(document.querySelectorAll("[data-slot=dialog-content]").length).toBe(
      1,
    );
    const cancel = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "hideAmounts.cancel",
    );
    expect(cancel).toBeDefined();
    expect(document.querySelector("[data-slot=dialog-back]")).not.toBeNull();
    click(cancel);
    expect(unlockOpen()).toBe(false);
    expect(update).toBeNull();
    expect(saveButton()).toBeDefined();
  });
});
