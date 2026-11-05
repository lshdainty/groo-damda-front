// 추가 · 수정 폼의 단계(I-17 5 ~ 9 · 17).
//
// 추가 = 1단계(종류 아홉 라디오 상자) → [다음] → 같은 표면의 2단계 → ← 로 1단계, 수정 = 2단계로 바로(← 없음 · 종류 칸).
// 단계가 바뀌어도 표면(시트 · 대화상자)은 하나다. 체크 줄 둘(스위치 0).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import {
  bodyText,
  buttons,
  click,
  fieldControl,
  installDomStubs,
  setInput,
} from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && Object.keys(o).length
        ? `${k}|${Object.entries(o)
            .map(([n, v]) => `${n}=${String(v)}`)
            .join(",")}`
        : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const mocked = vi.hoisted(() => ({ assets: [] as unknown[] }));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: mocked.assets }, isLoading: false }),
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

const { AssetEditDialog } = await import("./AssetEditDialog");

const asset = (assetType: Asset["assetType"], extra = {}): Asset => ({
  userRowId: 1,
  rowId: 3,
  assetName: "내 자산",
  assetType,
  balance: 1000,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: "신한",
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
  ...extra,
});

let container: HTMLDivElement;
let root: Root;
let created: Record<string, unknown> | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  created = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function open(item: Asset | null, wide = false) {
  installDomStubs({ wide });
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        onClose={() => {}}
        onCreate={(v) => {
          created = v as unknown as Record<string, unknown>;
        }}
        onUpdate={() => {}}
      />,
    ),
  );
}

const shownOf = (labelKey: string) => fieldControl(labelKey)?.textContent ?? "";
const titleOf = () =>
  document.querySelector(
    "[data-slot=bottom-sheet-title],[data-slot=dialog-title]",
  )?.textContent;
const surfaces = () =>
  document.querySelectorAll(
    "[data-slot=bottom-sheet-content],[data-slot=dialog-content]",
  ).length;
const radios = () => [
  ...document.body.querySelectorAll<HTMLElement>("[role=radio]"),
];
const backBtn = () =>
  document.querySelector<HTMLElement>(
    "[data-slot=bottom-sheet-back],[data-slot=dialog-back]",
  );
const nextBtn = () => buttons("next")[0]!;
const pick = (labelKey: string) =>
  click(
    document.querySelector<HTMLElement>(
      `label[for="${
        radios().find((r) =>
          r.closest("[data-slot=select-box]")?.textContent?.includes(labelKey),
        )!.id
      }"]`,
    ),
  );

describe("1단계 — 무엇을 추가할까요?", () => {
  it("종류 아홉이 한 라디오 묶음이고 묶음 제목 셋이 그 이름이다", () => {
    open(null);
    expect(titleOf()).toBe("editDialog.firstTitle");
    expect(radios().length).toBe(9);
    expect(document.querySelectorAll("[role=radiogroup]").length).toBe(1);
    const groups = [...document.body.querySelectorAll("[role=group]")];
    expect(groups.length).toBe(3);
    expect(
      groups.map((g) => g.getAttribute("aria-labelledby")).every(Boolean),
    ).toBe(true);
    // 처음에는 아무것도 고르지 않는다
    expect(
      radios().some((r) => r.getAttribute("data-state") === "checked"),
    ).toBe(false);
  });

  it("1280 미만 2열 · 이상 3열(상자 줄 칸 수 클래스)", () => {
    open(null);
    const grid = document.querySelector("[role=group] > .grid")!;
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
  });

  it("고르지 않고 [다음] — 오류 글, 단계는 그대로", () => {
    open(null);
    click(nextBtn());
    expect(bodyText()).toContain("editDialog.pickKindError");
    expect(titleOf()).toBe("editDialog.firstTitle");
  });

  it("상자를 고르는 것만으로는 안 넘어간다 — [다음] 으로 같은 표면의 2단계가 된다", () => {
    open(null);
    pick("assetType.creditcard");
    expect(titleOf()).toBe("editDialog.firstTitle");
    click(nextBtn());
    expect(titleOf()).toBe("editDialog.titleAddKind|kind=assetType.creditcard");
    expect(surfaces()).toBe(1);
    expect(backBtn()).not.toBeNull();
  });

  it("1280 이상은 대화상자 하나 — 같은 흐름", () => {
    open(null, true);
    expect(document.querySelector("[data-slot=dialog-content]")).not.toBeNull();
    pick("accountSub.overdraft");
    click(nextBtn());
    expect(surfaces()).toBe(1);
    expect(titleOf()).toBe("editDialog.titleAddKind|kind=accountSub.overdraft");
  });
});

describe("2단계 ←", () => {
  it("쓴 값이 없으면 바로 1단계로 — 고른 종류는 그대로 골라진 채", () => {
    open(null);
    pick("accountSub.cash");
    click(nextBtn());
    click(backBtn());
    expect(titleOf()).toBe("editDialog.firstTitle");
    const checked = radios().find(
      (r) => r.getAttribute("data-state") === "checked",
    );
    expect(checked?.closest("[data-slot=select-box]")?.textContent).toContain(
      "accountSub.cash",
    );
  });

  it("쓴 값이 있으면 먼저 묻고, 나가기를 누르면 값을 버리고 돌아간다", async () => {
    open(null);
    pick("accountSub.checking");
    click(nextBtn());
    setInput(fieldControl("editDialog.nameLabel")!, "새 통장");
    click(backBtn());
    // 문구는 ds 기본 글(언어를 따른다) — 확인창이 떴는지는 그 안의 [나가기] 로 본다
    const leave = [
      ...document.body.querySelectorAll<HTMLElement>("button"),
    ].find((b) => ["나가기", "Leave"].includes(b.textContent?.trim() ?? ""));
    expect(leave).toBeDefined();
    expect(titleOf()).toContain("editDialog.titleAddKind");
    click(leave);
    expect(titleOf()).toBe("editDialog.firstTitle");
    click(nextBtn());
    expect(
      (fieldControl("editDialog.nameLabel") as HTMLInputElement).value,
    ).toBe("");
  });
});

describe("수정 — 2단계로 바로", () => {
  it("← 가 없고 제목은 '{종류} 수정'", () => {
    open(asset("BANK_ACCOUNT"));
    expect(backBtn()).toBeNull();
    expect(titleOf()).toBe("editDialog.titleEditKind|kind=accountSub.checking");
  });

  it("계좌 종류 칸은 Select 하나 — 여섯 중 고르면 그 종류의 칸으로 바뀐다", () => {
    open(asset("BANK_ACCOUNT"));
    const kind = fieldControl<HTMLButtonElement>("editDialog.kindLabel")!;
    expect(kind.getAttribute("role")).toBe("combobox");
    click(kind);
    expect(document.querySelectorAll("[data-slot=select-item]").length).toBe(6);
    click(
      [
        ...document.querySelectorAll<HTMLElement>("[data-slot=select-item]"),
      ].find((o) => o.textContent?.includes("accountSub.overdraft")),
    );
    expect(titleOf()).toBe(
      "editDialog.titleEditKind|kind=accountSub.overdraft",
    );
    // 마이너스 통장이 되면 약정 한도 칸이 생긴다
    expect(fieldControl("editDialog.overdraftLimitLabel")).not.toBeNull();
  });

  it("카드 종류 칸은 칩 둘 — 신용 → 체크로 바꿔도 칸이 바뀐다(결제일 칸이 사라진다)", () => {
    open(asset("CREDIT_CARD", { paymentDay: 14 }));
    const chips = document.querySelectorAll("[role=radiogroup] [role=radio]");
    expect(chips.length).toBe(2);
    expect(fieldControl("editDialog.paymentDay")).not.toBeNull();
    click(chips[1]);
    expect(fieldControl("editDialog.paymentDay")).toBeNull();
    expect(fieldControl("editDialog.linkedAccount")).not.toBeNull();
  });

  it("투자는 종류 칸을 그리지 않는다", () => {
    open(asset("INVESTMENT"));
    expect(fieldControl("editDialog.kindLabel")).toBeNull();
  });
});

describe("체크 줄 둘", () => {
  it("스위치가 아니라 체크 — 합계에 포함 · 금액 가리기", () => {
    open(asset("BANK_ACCOUNT"));
    const boxes = document.querySelectorAll("[role=checkbox]");
    expect(boxes.length).toBe(2);
    expect(document.querySelectorAll("[role=switch]").length).toBe(0);
    expect(bodyText()).toContain("editDialog.hideAmount");
    expect(bodyText()).toContain("editDialog.includeInTotalDesc");
  });
});

describe("저장 본문은 종류가 정한다 — 1단계에서 고른 종류로 만든다", () => {
  it("마이너스 통장을 추가하면 BANK_ACCOUNT 에 음수 잔액", () => {
    open(null);
    pick("accountSub.overdraft");
    click(nextBtn());
    setInput(fieldControl("editDialog.nameLabel")!, "마통");
    setInput(fieldControl("editDialog.balanceLabelOverdraft")!, "300000");
    click(buttons("addAction")[0]);
    expect(created).toMatchObject({
      assetType: "BANK_ACCOUNT",
      balance: -300_000,
    });
  });
});

describe("[추가] · [저장] 은 늘 켜 둔다 — 누르면 칸마다 오류 (field.md)", () => {
  it("새 계좌: 별칭이 비면 눌러도 안 나가고 칸 아래 오류 + 그 칸에 초점", () => {
    open(null);
    pick("accountSub.checking");
    click(nextBtn());
    const add = buttons("addAction")[0]!;
    expect(add.hasAttribute("disabled")).toBe(false);
    click(add);
    expect(created).toBeNull();
    expect(bodyText()).toContain("editDialog.errName");
    expect(document.activeElement).toBe(fieldControl("editDialog.nameLabel"));
    // 쓰면 오류가 걷히고 나간다
    setInput(fieldControl("editDialog.nameLabel")!, "생활비");
    expect(bodyText()).not.toContain("editDialog.errName");
    click(buttons("addAction")[0]);
    expect(created).not.toBeNull();
  });

  it("새 신용카드: 카드 상품 · 결제일 오류가 함께 선다", () => {
    open(null);
    pick("assetType.creditcard");
    click(nextBtn());
    click(buttons("addAction")[0]);
    expect(created).toBeNull();
    expect(bodyText()).toContain("editDialog.errCard");
    expect(bodyText()).toContain("editDialog.errPaymentDay");
  });
});

describe("기관이 없는 자산을 고친다 — 빈 칸 그대로", () => {
  it("기관 칸이 비어 있고 저장해도 institution 키를 안 싣는다", () => {
    let update: Record<string, unknown> | null = null;
    installDomStubs();
    act(() =>
      root.render(
        <AssetEditDialog
          item={asset("CASH", { institution: null })}
          onClose={() => {}}
          onCreate={() => {}}
          onUpdate={(v) => {
            update = v as unknown as Record<string, unknown>;
          }}
        />,
      ),
    );
    const inst = fieldControl("editDialog.institutionBrand")!;
    expect(inst.parentElement?.textContent).toContain(
      "editDialog.institutionPlaceholder",
    );
    click(buttons("save")[0]);
    expect(update).not.toBeNull();
    expect(update!.institution).toBeUndefined();
  });
});

describe("결제 출금계좌 없음", () => {
  it("'없음' 을 고르면 paymentAssetRowId 가 null 로 나간다(서버는 명시적 null 을 지움으로 받는다)", () => {
    let update: Record<string, unknown> | null = null;
    mocked.assets = [asset("BANK_ACCOUNT", { rowId: 7, assetName: "주거래" })];
    installDomStubs();
    act(() =>
      root.render(
        <AssetEditDialog
          item={asset("CREDIT_CARD", { paymentDay: 14, paymentAssetRowId: 7 })}
          onClose={() => {}}
          onCreate={() => {}}
          onUpdate={(v) => {
            update = v as unknown as Record<string, unknown>;
          }}
        />,
      ),
    );
    click(fieldControl("editDialog.paymentAccount"));
    const none = [
      ...document.querySelectorAll<HTMLElement>("[data-slot=select-item]"),
    ].find((o) => o.textContent?.includes("editDialog.noPaymentAccount"));
    expect(none).toBeDefined();
    click(none);
    click(buttons("save")[0]);
    expect(update).toHaveProperty("paymentAssetRowId", null);
    // 고른 뒤 칸에 그 글이 보인다 — 자리 글로 돌아가지 않는다(select.md)
    expect(shownOf("editDialog.paymentAccount")).toContain(
      "editDialog.noPaymentAccount",
    );
    expect(shownOf("editDialog.paymentAccount")).not.toContain(
      "editDialog.selectPaymentAccount",
    );
  });
});

describe("저장된 카드의 결제 출금계좌가 null 이면 처음부터 '없음'", () => {
  it("수정은 '없음', 새로 추가는 자리 글", () => {
    installDomStubs();
    mocked.assets = [];
    act(() =>
      root.render(
        <AssetEditDialog
          item={asset("CHECK_CARD", { paymentAssetRowId: null })}
          onClose={() => {}}
          onCreate={() => {}}
          onUpdate={() => {}}
        />,
      ),
    );
    expect(shownOf("editDialog.linkedAccount")).toContain(
      "editDialog.noLinkedAccount",
    );
    act(() => root.unmount());
    root = createRoot(container);
    open(null);
    pick("assetType.checkcard");
    click(nextBtn());
    expect(shownOf("editDialog.linkedAccount")).not.toContain(
      "editDialog.noLinkedAccount",
    );
  });
});

describe("별칭은 수정에서도 필수 — 자동 이름 없음", () => {
  it("비우고 [저장] 하면 안 나가고 오류, 이름을 쓰면 나간다", () => {
    let update: Record<string, unknown> | null = null;
    installDomStubs();
    act(() =>
      root.render(
        <AssetEditDialog
          item={asset("BANK_ACCOUNT")}
          onClose={() => {}}
          onCreate={() => {}}
          onUpdate={(v) => {
            update = v as unknown as Record<string, unknown>;
          }}
        />,
      ),
    );
    setInput(fieldControl("editDialog.nameLabel")!, "");
    click(buttons("save")[0]);
    expect(update).toBeNull();
    expect(bodyText()).toContain("editDialog.errName");
    setInput(fieldControl("editDialog.nameLabel")!, "바꾼 이름");
    click(buttons("save")[0]);
    expect((update as Record<string, unknown> | null)?.assetName).toBe(
      "바꾼 이름",
    );
  });
});

describe("처음 초점 — 새 폼은 첫 칸, 수정 폼은 표면(폰에서 키보드가 가리지 않게)", () => {
  it("새 계좌: 2단계로 들어가면 이름 칸에 초점", () => {
    open(null);
    pick("accountSub.checking");
    click(nextBtn());
    expect(document.activeElement).toBe(fieldControl("editDialog.nameLabel"));
  });

  it("수정: 열어도 글 입력 칸에 초점이 가지 않는다(표면이 받는다)", () => {
    open(asset("BANK_ACCOUNT"));
    const active = document.activeElement as HTMLElement | null;
    expect(active?.tagName).not.toBe("INPUT");
    expect(active?.tagName).not.toBe("TEXTAREA");
    expect(
      document
        .querySelector(
          "[data-slot=bottom-sheet-content],[data-slot=dialog-content]",
        )
        ?.contains(active),
    ).toBe(true);
  });
});
