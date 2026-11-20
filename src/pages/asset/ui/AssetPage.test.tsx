// 자산 화면의 금액은 **줄이지 않고 원까지** 쓴다(I-05 58 · 60 — 도넛 합계 · 저축 목표 금액).
//
// 예전엔 도넛 중앙과 저축목표 목표액이 축약(`천만` · `1만` · `0만` · ASCII 하이픈)을 직접 계산해 QA 가 닫은 항목이 이 화면에선 살아 있었다.
// 지금은 두 자리 모두 원까지 쓰므로, 줄임 글이 다시 들어오면 이 파일이 깨진다. 축(눈금)의 줄임은 차트 부품(formatAxisWon)이 맡는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { i18n } from "@/shared/i18n/config";
import type { Asset } from "@/entities/asset";
import type { SavingGoal } from "@/entities/savingGoal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// 라벨 키는 그대로 흘려보낸다 — 여기서 보는 건 금액 문자열뿐이다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// 동적 아이콘만 세운다 — 비동기 로드라 act 경고를 남기고, 금액과는 무관하다.
// 도넛은 진짜를 그린다: 중앙 라벨이 children 으로 들어가므로 흉내내면 자리가 어긋난다.
vi.mock("lucide-react/dynamic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lucide-react/dynamic")>()),
  DynamicIcon: () => <span />,
}));

const { AssetCompositionCard, SavingGoalItem } = await import("./asset-parts");

let container: HTMLDivElement;
let root: Root;
const origLang = i18n.language;

beforeAll(async () => {
  await i18n.changeLanguage("ko");
});
afterAll(async () => {
  await i18n.changeLanguage(origLang);
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const base: Asset = {
  rowId: 1,
  userRowId: 1,
  assetName: "주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_000_000,
  cashBalance: 1_000_000,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: null,
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

/** 도넛 이름 · 표에 든 자산 합계 — 조각의 합이고 순자산이 아니다 */
function renderComposition(balance: number, extra: Partial<Asset>[] = []) {
  act(() =>
    root.render(
      <AssetCompositionCard
        accounts={[
          { ...base, balance },
          ...extra.map((e) => ({ ...base, ...e })),
        ]}
        investments={[]}
        cards={[]}
        loans={[]}
      />,
    ),
  );
  return (
    container.querySelector("[data-slot=chart]")?.getAttribute("aria-label") ??
    ""
  );
}

const goalOf = (targetAmount: number): SavingGoal => ({
  rowId: 1,
  userRowId: 1,
  title: "여행",
  description: null,
  targetAmount,
  currentAmount: 0,
  currency: "KRW",
  deadlineDate: null,
  icon: null,
  color: null,
  linkedAssetRowId: null,
  sortOrder: 0,
  isAchieved: "N",
  achievedAt: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
});

function renderGoal(targetAmount: number): string {
  act(() => root.render(<SavingGoalItem goal={goalOf(targetAmount)} />));
  return container.textContent ?? "";
}

describe("자산 구성 도넛 합계", () => {
  it("줄이지 않고 원까지 쓴다 — `천만` · `만` 을 만들지 않는다", () => {
    const out = renderComposition(51_750_000);
    expect(out).toContain("51,750,000원");
    expect(out).not.toMatch(/천만|만 /);
  });

  it("1.2억이 아니라 120,000,000원이다", () => {
    const out = renderComposition(120_000_000);
    expect(out).toContain("120,000,000원");
    expect(out).not.toContain("억");
  });

  it("작은 금액도 그대로 — 4,900 이 `0만` 으로 사라지지 않는다", () => {
    const out = renderComposition(4_900);
    expect(out).toContain("4,900원");
    expect(out).not.toContain("0만");
  });

  it("합계 줄 — 라벨 옆에 들지 않으면 금액 낱말을 통째로 아래 줄로(쉼표 뒤 꺾기는 줄보다 길 때만, Typography v114)", () => {
    // 큰 글자 — 가운데 합계가 구멍에 들지 않아 도넛 옆 합계 줄로 옮겨진 경우(재는 글 폭을 크게)
    globalThis.ResizeObserver = class {
      constructor(private cb: (entries: unknown[]) => void) {}
      observe() {
        this.cb([]);
      }
      unobserve() {}
      disconnect() {}
    } as never;
    const rect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 1000 } as DOMRect);
    renderComposition(29_430);
    rect.mockRestore();
    const total = container.querySelector("[data-slot=asset-donut-total]")!;
    expect(total).not.toBeNull();
    expect(total.className.split(/\s+/)).toContain("flex-wrap");
    const [label, amount] = Array.from(total.children) as HTMLElement[];
    expect(label!.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["min-w-[8rem]", "flex-1"]),
    );
    const a = amount!.className.split(/\s+/);
    expect(a).toEqual(expect.arrayContaining(["ms-auto", "max-w-full"]));
    expect(a).not.toContain("min-w-0");
    expect(amount!.innerHTML).toBe("29,<wbr>430원");
  });

  it("조각이 하나도 없으면 도넛 대신 빈 안내를 그린다", () => {
    act(() =>
      root.render(
        <AssetCompositionCard
          accounts={[]}
          investments={[]}
          cards={[]}
          loans={[]}
        />,
      ),
    );
    expect(container.querySelector("[data-slot=chart]")).toBeNull();
  });

  it("총액 제외 자산은 합계에서 뺀다", () => {
    const out = renderComposition(1_000_000, [
      { rowId: 2, balance: 9_000_000, isIncludedInTotal: "N" },
    ]);
    expect(out).toContain("1,000,000원");
  });

  it("외화 자산은 원화로 환산해 더한다(USD 1,000 × 1,385)", () => {
    const out = renderComposition(0, [
      { rowId: 2, balance: 1_000, currency: "USD", exchangeRate: 1385 },
    ]);
    expect(out).toContain("1,385,000원");
  });
});

describe("저축목표 목표액", () => {
  it("11,881 도 원까지 — `1만` 으로 깎지 않는다", () => {
    const out = renderGoal(11_881);
    expect(out).toContain("11,881원");
    expect(out).not.toMatch(/만/);
  });

  it("1만 미만이 사라지지 않는다 — 4,900 이 `0만` 이었다", () => {
    const out = renderGoal(4_900);
    expect(out).toContain("4,900원");
    expect(out).not.toContain("0만");
  });

  it("1억도 `1억` 이 아니라 100,000,000원이다", () => {
    const out = renderGoal(100_000_000);
    expect(out).toContain("100,000,000원");
    expect(out).not.toContain("1억");
  });

  it("긴 값 — 1,234,567,890원 / 9,999,999,999원", () => {
    act(() =>
      root.render(
        <SavingGoalItem
          goal={{ ...goalOf(9_999_999_999), currentAmount: 1_234_567_890 }}
        />,
      ),
    );
    expect(container.textContent).toContain(
      "1,234,567,890원 / 9,999,999,999원",
    );
  });
});
