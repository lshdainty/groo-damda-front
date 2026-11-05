// 자산 편집이 **보내는 것**을 고정한다 (QA #106 · #110 · D1).
//
// 규칙은 하나다 — 이 다이얼로그가 **가진 칸만** 싣는다.
// PUT 은 세 갈래이므로(`Patch`: 키 없음=유지 · null=지움 · 값=교체, QA #96)
// 칸이 있으면 지금 상태를 그대로(비었으면 `null`) 싣고, 칸이 없으면 키를 뺀다.
//
// - 통화: 이제 세 묶음 모두 **칸이 있다**(D1) → 싣는다. 종전엔 칸도 없이 `"KRW"` 를
//   실어 보내 외화 자산이 편집 한 번에 원화가 됐고 서버가 환산율까지 1 로 정규화해
//   총자산이 환산 없이 합쳐졌다(QA #106) — 그래서 키를 뺐었다. 칸이 생겼으므로 다시
//   싣되, **읽어 온 값으로 열어야** 그대로 저장했을 때 값이 안 바뀐다. 그 두 가지를
//   여기서 함께 잠근다(앱 desk-app #330 과 같은 판단).
// - 환율: 원화로 되돌리면 **명시적 `null`** 이다. 키를 빼면 서버가 옛 환율을 지켜
//   원화 잔액이 1380 배가 된다.
// - 기본 통화(D7): 설정 값은 **새 자산에만** 들어간다. 기존 자산은 제 통화로 연다 —
//   안 그러면 기본 통화를 바꾼 순간 원화 계좌가 전부 외화로 열리고, 그대로 저장만
//   해도 통화가 바뀐다.
// - 메모: 계좌·투자엔 칸이 **있다** → 비우면 `null` 을 싣는다(안 그러면 안 지워졌다).
//   카드엔 칸이 **없다**(입력이 `editingGroup !== "card"` 안에 있다) — 그래도 상태가
//   서버 값에서 출발하므로 그대로 되돌려 보낸다. 지어낸 값이 아니다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import type { AssetKind } from "../lib/asset-kind";
import {
  chooseSelect,
  fieldControl,
  installDomStubs,
  setInput,
} from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// 라벨 키를 그대로 흘려보낸다 — 여기서 보는 건 페이로드뿐이다.
vi.mock("react-i18next", () => ({
  // `i18n` 까지 흉내 낸다 — 다이얼로그가 금액을 통화 표기로 쓸 때 `i18n.language` 를
  // 본다. 빼 두면 그 경로가 닿는 순간 테스트가 아니라 목이 터진다.
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
// 설정의 기본 통화 — 실제 훅은 react-query 를 타므로 값만 흘려보낸다(D7).
const prefs = vi.hoisted(() => ({ defaultCurrency: "KRW" }));
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: prefs.defaultCurrency,
    ready: true,
    ensure: async () => true,
  }),
}));

const { AssetEditDialog } = await import("./AssetEditDialog");

const baseAsset = {
  userRowId: 1,
  cashBalance: 0,
  holdingBalance: 0,
  color: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
} as const;

/** 웹에서 USD 로 만든 해외 증권계좌 — 이 화면엔 통화 칸이 없다. */
const usdInvest: Asset = {
  ...baseAsset,
  rowId: 12,
  assetName: "IBKR",
  assetType: "INVESTMENT",
  balance: 5_000,
  currency: "USD",
  exchangeRate: 1_380,
  institution: "키움증권",
  memo: "해외 배당 계좌",
};

/** USD 로 만든 해외 입출금 계좌. */
const usdAccount: Asset = {
  ...baseAsset,
  rowId: 8,
  assetName: "Chase Checking",
  assetType: "BANK_ACCOUNT",
  balance: 3_000,
  currency: "USD",
  exchangeRate: 1_380,
  institution: "신한",
  memo: "출장비 계좌",
};

/** 원화 입출금 계좌 — 환율 칸이 안 뜨는 쪽. */
const krwAccount: Asset = {
  ...baseAsset,
  rowId: 9,
  assetName: "신한 주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_200_000,
  currency: "KRW",
  // 서버는 원화 자산에도 환산율 1 을 준다(`Asset.normalizeRate`).
  exchangeRate: 1,
  institution: "신한",
  memo: null,
};

/** USD 로 만든 해외 신용카드 — 카드 묶음엔 메모 칸도 없다. */
const usdCard: Asset = {
  ...baseAsset,
  rowId: 7,
  assetName: "Chase Sapphire",
  assetType: "CREDIT_CARD",
  balance: -1_200,
  currency: "USD",
  exchangeRate: 1_380,
  institution: "신한카드",
  memo: "계좌 화면에서 적어 둔 메모",
  creditLimit: 5_000_000,
  paymentDay: 14,
};

// 한 케이스에서 다이얼로그를 두 번 띄우는 일이 있어(생성 두 묶음) 마운트를 매번 새로 판다 —
// 같은 root 에 다시 render 하면 앞 다이얼로그의 상태·포털이 남는다.
const mounted: { container: HTMLDivElement; root: Root }[] = [];

function unmountAll() {
  for (const m of mounted.splice(0)) {
    act(() => m.root.unmount());
    m.container.remove();
  }
}

function mount() {
  // 앞 다이얼로그는 먼저 걷는다 — 모달이 겹쳐 있으면 뒤 것을 못 찾는다.
  unmountAll();
  // 모달이 닫히면 그 뒤 POINTER_BLOCK_MS 동안 클릭이 삼켜진다(오클릭 방어) — 푼다.
  __resetPointerBlockForTest();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  return root;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  prefs.defaultCurrency = "KRW";
  installDomStubs();
});

afterEach(unmountAll);

type Payload = Record<string, unknown>;

/** 다이얼로그를 띄우고 저장을 눌러, 그때 나간 본문을 돌려준다. */
function submit(
  item: Asset | null,
  kind?: AssetKind,
  before?: () => void,
): { create: Payload | null; update: Payload | null } {
  let create: Payload | null = null;
  let update: Payload | null = null;
  const root = mount();
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        kind={kind}
        onClose={() => {}}
        onCreate={(v) => {
          create = v as unknown as Payload;
        }}
        onUpdate={(v) => {
          update = v as unknown as Payload;
        }}
      />,
    ),
  );
  before?.();
  // 저장 라벨은 신규/수정이 다르다(추가 · 저장) — 둘 다 받는다.
  const save = [...document.body.querySelectorAll("button")].find((b) =>
    ["save", "addAction"].includes(b.textContent?.trim() ?? ""),
  );
  if (!save) {
    const seen = [...document.body.querySelectorAll("button")]
      .map((b) => b.textContent?.trim())
      .join(" · ");
    throw new Error(`저장 버튼을 찾지 못했다 — 보인 버튼: ${seen}`);
  }
  act(() => save.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  return { create, update };
}

const memoInput = () => fieldControl("editDialog.memo");
const nameInput = () => fieldControl("editDialog.nameLabel")!;

/** 화면에 그려진 통화 select 가 보여 주는 값(`$ USD` 꼴). */
const currencyTriggerText = () =>
  fieldControl("form.currency")?.textContent?.trim() ?? null;

const fxInput = () => fieldControl("form.exchangeRate");

/** 통화 select 를 실제로 연다. */
const pickCurrency = (optionText: string) =>
  chooseSelect("form.currency", optionText);

describe("통화 — 칸이 생겼으니 싣는다, 대신 읽어 온 값으로 연다 (D1)", () => {
  it("투자 수정: 지금 통화·환율이 그대로 나간다", () => {
    const { update } = submit(usdInvest);
    expect(update).not.toBeNull();
    expect(update!.currency).toBe("USD");
    expect(update!.exchangeRate).toBe(1_380);
    // 반대편: 이 화면이 가진 다른 칸도 그대로 나간다.
    expect(update!.assetName).toBe("IBKR");
  });

  it("계좌 수정: 지금 통화·환율이 그대로 나간다", () => {
    const { update } = submit(usdAccount);
    expect(update!.currency).toBe("USD");
    expect(update!.exchangeRate).toBe(1_380);
  });

  it("카드 수정: 지금 통화·환율이 그대로 나간다", () => {
    const { update } = submit(usdCard);
    expect(update!.currency).toBe("USD");
    expect(update!.exchangeRate).toBe(1_380);
  });

  it("세 묶음 다 서버 값으로 열린다 — 안 채우면 저장만으로 원화가 된다", () => {
    for (const item of [usdInvest, usdAccount, usdCard]) {
      submit(item, undefined, () => {
        expect(currencyTriggerText()).toBe("$ USD");
        expect(fxInput()?.value).toBe("1380");
      });
    }
  });

  it("원화 자산은 환율 칸이 아예 안 보인다", () => {
    submit(krwAccount, undefined, () => {
      expect(currencyTriggerText()).toBe("₩ KRW");
      expect(fxInput()).toBeNull();
    });
  });

  it("환율을 고치면 고친 값이 나간다", () => {
    const { update } = submit(usdAccount, undefined, () => {
      setInput(fxInput()!, "1425.5");
    });
    expect(update!.exchangeRate).toBe(1_425.5);
  });

  it("환율에 쉼표를 찍어도 읽는다 — 금액 칸을 보고 온 손이 그렇게 친다", () => {
    // `Number("1,425")` 는 NaN 이다. 조용히 null 로 빠지면 서버가 환산율 1 로 잡아
    // 외화 잔액이 원화로 그대로 더해진다 — 화면엔 아무 표시도 안 난다.
    const { update } = submit(usdAccount, undefined, () => {
      setInput(fxInput()!, "1,425");
    });
    expect(update!.exchangeRate).toBe(1_425);
  });

  it("원화 자산 수정에도 통화가 실린다 — 서버가 지금 값을 그대로 받는다", () => {
    const { update } = submit(krwAccount);
    expect(update!.currency).toBe("KRW");
    expect(update!.exchangeRate).toBeNull();
  });

  it("생성도 싣는다 — 고른 칸이 있으니 지어낸 값이 아니다", () => {
    const nameIt = () => setInput(nameInput(), "새 자산");
    const invest = submit(null, "투자", nameIt);
    expect(invest.create).not.toBeNull();
    expect(invest.create!.currency).toBe("KRW");
    const account = submit(null, "입출금", nameIt);
    expect(account.create).not.toBeNull();
    expect(account.create!.currency).toBe("KRW");
  });
});

describe("기본 통화 — 새 자산만 설정 값으로 연다 (D7 · QA #124)", () => {
  const nameIt = () => setInput(nameInput(), "새 자산");

  // 카드 생성은 카탈로그를 고르는 단계가 앞에 있어 이 헬퍼로는 저장까지 못 간다
  // (위 "생성도 싣는다" 도 같은 이유로 계좌·투자만 본다). 통화 칸은 세 묶음이 한 벌을
  // 공유하므로 여기서 갈릴 자리가 없다.
  it("새 자산은 설정의 기본 통화로 열린다", () => {
    prefs.defaultCurrency = "USD";
    for (const kind of ["입출금", "투자"] as const) {
      const { create } = submit(null, kind, nameIt);
      expect(create, kind).not.toBeNull();
      expect(create!.currency, kind).toBe("USD");
    }
  });

  it("기본 통화가 늦게 와도 첫 렌더의 원화에 안 잠긴다", () => {
    // `/me/preferences` 는 설정 화면을 안 들른 세션에서 이 폼보다 늦게 온다.
    // `useState` 초기값으로 굳히면 그 뒤에 값이 와도 KRW 그대로다.
    prefs.defaultCurrency = "KRW";
    const root = mount();
    const render = () =>
      act(() =>
        root.render(
          <AssetEditDialog
            item={null}
            kind="입출금"
            onClose={() => {}}
            onCreate={() => {}}
            onUpdate={() => {}}
          />,
        ),
      );
    render();
    prefs.defaultCurrency = "USD";
    render();

    // 환율 칸은 통화가 원화가 아닐 때만 뜬다 — 그게 보이면 값이 따라온 것이다.
    expect(currencyTriggerText()).toBe("$ USD");
    expect(fxInput()).not.toBeNull();
  });

  it("기존 자산은 설정이 뭐든 제 통화로 연다 — 저장해도 안 바뀐다", () => {
    prefs.defaultCurrency = "USD";
    const { update } = submit(krwAccount);
    expect(update!.currency).toBe("KRW");
    // 원화니까 환율은 명시적 null 로 지운다(키를 빼면 옛 환율이 남는다).
    expect(update!.exchangeRate).toBeNull();
  });

  it("고른 값이 설정보다 우선한다 — 설정이 늦게 와도 고른 값을 안 덮는다", () => {
    prefs.defaultCurrency = "KRW";
    const root = mount();
    const render = () =>
      act(() =>
        root.render(
          <AssetEditDialog
            item={null}
            kind="입출금"
            onClose={() => {}}
            onCreate={() => {}}
            onUpdate={() => {}}
          />,
        ),
      );
    render();
    pickCurrency("¥ JPY");
    // 여기서 설정 값이 도착한다. 고른 값이 있으면 그게 이긴다.
    prefs.defaultCurrency = "USD";
    render();

    expect(currencyTriggerText()).toBe("¥ JPY");
  });
});

describe("메모 — 칸이 있으면 비운 상태로, 없으면 키째 (QA #110)", () => {
  it("투자: 메모를 비우면 null 이 나간다", () => {
    const { update } = submit(usdInvest, undefined, () => {
      const el = memoInput();
      expect(el?.value).toBe("해외 배당 계좌");
      setInput(el!, "");
    });
    expect(update!.memo).toBeNull();
  });

  it("계좌: 메모를 비우면 null 이 나간다", () => {
    const { update } = submit(usdAccount, undefined, () => {
      setInput(memoInput()!, "");
    });
    expect(update!.memo).toBeNull();
  });

  it("계좌: 적어 둔 메모는 그대로 나간다", () => {
    const { update } = submit(usdAccount, undefined, () => {
      setInput(memoInput()!, "출장비 계좌 2");
    });
    expect(update!.memo).toBe("출장비 계좌 2");
  });

  it("카드: 메모 칸은 없지만, 남이 적어 둔 값은 그대로 되돌아 나간다", () => {
    // 이 묶음엔 메모 입력이 없다(입력은 `editingGroup !== "card"` 안에 있다).
    // 그래도 키를 싣는다 — 상태가 서버 값에서 출발하므로 되돌려 보내면 아무것도
    // 안 바뀌고, 이 칸을 무조건 대입하는 옛 서버에서도 값이 안 지워진다.
    const { update } = submit(usdCard);
    expect(memoInput()).toBeNull();
    expect(update!.memo).toBe("계좌 화면에서 적어 둔 메모");
  });
});

/**
 * 자산별 금액 숨김 — 폼이 그 값을 <b>싣고, 잃지 않는지</b>.
 *
 * <p>서버 PUT 은 "키가 없으면 유지" 라, 폼이 이 칸을 빼먹으면 겉으론 아무 일도 안 나고
 * 그대로 유지된다. 그러나 <b>스위치를 껐는데 안 꺼지는</b> 쪽은 조용히 실패한다 —
 * 사용자는 껐다고 믿고 화면은 계속 가려져 있다.
 */
describe("자산별 금액 숨김 — 폼 payload", () => {
  // 신규 생성은 여기서 안 본다 — 필수 칸이 비어 저장이 안 눌린다(이 파일의 다른
  // 테스트도 전부 기존 자산으로 연다). 새 자산의 기본값 'N' 은 서버 `createAsset` 과
  // 폼 초기값 둘 다가 쥐고 있다.

  it("수정: 가려 둔 자산은 그 값이 그대로 실린다 — 이름만 고쳐도 안 풀린다", () => {
    const hidden: Asset = { ...usdAccount, isAmountHidden: "Y" };
    const { update } = submit(hidden);
    expect(update!.isAmountHidden).toBe("Y");
  });

  it("수정: 안 가려 둔 자산은 N 으로 나간다", () => {
    const { update } = submit(usdAccount);
    expect(update!.isAmountHidden).toBe("N");
  });
});
