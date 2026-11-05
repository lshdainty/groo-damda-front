// 내보내기 화면 — ds 부품으로 옮긴 구조와 동작(I-05 40 ~ 47). 모양 값은 ds:check 가 잰다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  countsFail: false,
  download: null as null | (() => Promise<Blob>),
  preview: [] as unknown[],
  toastError: [] as { msg: string; opts: { action?: { label: string } } }[],
  toastSuccess: [] as string[],
}));

vi.mock("@/features/export/api/exportApi", () => {
  class ExportStalledError extends Error {}
  return {
    ExportStalledError,
    fetchExportCounts: () =>
      state.countsFail
        ? Promise.reject(new Error("x"))
        : Promise.resolve([
            { type: "expense", displayName: "거래", count: 123456 },
            { type: "asset", displayName: "자산", count: 3 },
          ]),
    fetchExportPreview: () => Promise.resolve(state.preview),
    downloadExport: () => state.download!(),
  };
});
vi.mock("@/features/import/api/importApi", () => ({
  analyzeImport: () => Promise.resolve(null),
  executeImport: () => Promise.resolve(null),
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: {
      message: string;
      tone?: string;
      action?: { label: string };
    }) => {
      if (o.tone === "critical")
        state.toastError.push({ msg: o.message, opts: o });
      else state.toastSuccess.push(o.message);
    },
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/lib/download", () => ({ downloadBlob: () => {} }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: object) => (o ? k + JSON.stringify(o) : k),
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { DataExportSection } = await import("./DataExportSection");
const { ExportStalledError } = await import("@/features/export/api/exportApi");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.countsFail = false;
  state.toastError = [];
  state.toastSuccess = [];
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(mobile: boolean) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DataExportSection mobile={mobile} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const btn = (needle: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(needle),
  )!;
const btnExact = (text: string) =>
  [...container.querySelectorAll('[data-slot="data-action-bar"] button')].find(
    (b) => (b.textContent ?? "").trim() === text,
  )!;
const groups = () => [
  ...container.querySelectorAll<HTMLElement>('[data-slot="select-box-group"]'),
];

describe("내보내기 · 가져오기 전환 (I-05 40)", () => {
  it("ds Tabs Line 두 칸이고 목록 이름이 있다", async () => {
    await render(false);
    const list = container.querySelector('[role="tablist"]')!;
    expect(list.getAttribute("aria-label")).toBe("section.tabsLabel");
    expect(list.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it("가져오기 칸을 눌러도 내보내기 칸은 지워지지 않는다(숨김만)", async () => {
    await render(false);
    await click(btn("import.tab"));
    expect(container.querySelectorAll('[role="tabpanel"]').length).toBe(2);
  });
});

describe("기간 · 형식 Select Box (I-05 41 · 43)", () => {
  it("기간은 하나 고르기 radiogroup 5개, 형식은 3개", async () => {
    await render(false);
    const [period, format] = groups();
    expect(period!.getAttribute("role")).toBe("radiogroup");
    expect(period!.querySelectorAll('[role="radio"]')).toHaveLength(5);
    expect(format!.querySelectorAll('[role="radio"]')).toHaveLength(3);
  });

  it("기간은 모든 폭 1열, 형식은 폰 1열 · 데스크톱 3열이다(Q5 5B · 사용자 결정 Q1-A)", async () => {
    await render(true);
    for (const g of groups().slice(0, 2)) {
      expect(g.className).toContain("grid-cols-1");
    }
    act(() => root.unmount());
    root = createRoot(container);
    await render(false);
    const [period, format] = groups();
    expect(period!.className).toContain("grid-cols-1");
    expect(period!.className).not.toContain("grid-cols-5");
    expect(format!.className).toContain("grid-cols-3");
  });

  it("'직접' 을 고르면 상자 아래로 기간 칸이 펼쳐진다", async () => {
    await render(false);
    const radios = groups()[0]!.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(radios[4]!.getAttribute("aria-checked")).toBe("false");
    await click(radios[4]!);
    expect(radios[4]!.getAttribute("aria-checked")).toBe("true");
    // 펼침은 고른 상자 안에 있고, 그 안에 기간 칸(Date Picker 기간)이 하나 있다
    const box = radios[4]!.closest('[data-slot="select-box"]')!;
    expect(box.textContent).toContain("section.customRangeLabel");
  });
});

describe("데이터 종류 (I-05 42)", () => {
  it("맨 위 부모 '모두' + 7종, 오른쪽에 체크, 줄 전체가 누르는 자리", async () => {
    await render(false);
    const checks = [
      ...container.querySelectorAll<HTMLElement>('[data-slot="list-mark"]'),
    ];
    expect(checks).toHaveLength(1 + 7);
    expect(checks[0]!.getAttribute("aria-checked")).toBe("mixed");
    // 체크는 줄의 뒤(list-suffix) 안에 있다
    expect(checks[0]!.closest('[data-slot="list-suffix"]')).not.toBeNull();
    expect(checks[0]!.closest("label,[data-list-action]")).not.toBeNull();
  });

  it("부모는 세 상태 — 일부면 mixed, 모두 켜면 true, 끄면 false", async () => {
    await render(false);
    const parent = () =>
      container.querySelector<HTMLElement>('[data-slot="list-mark"]')!;
    expect(parent().getAttribute("aria-checked")).toBe("mixed");
    await click(parent());
    expect(parent().getAttribute("aria-checked")).toBe("true");
    await click(parent());
    expect(parent().getAttribute("aria-checked")).toBe("false");
  });

  it("개수를 받으면 값 자리에 건수가, 못 받으면 오류 글 + 다시 시도가 보인다", async () => {
    await render(false);
    expect(container.textContent).toContain(
      'section.countGeon{"count":"123,456"}',
    );
    act(() => root.unmount());
    root = createRoot(container);
    state.countsFail = true;
    await render(false);
    expect(container.textContent).toContain("section.countsFailed");
    expect(container.textContent).toMatch(/common\.retry|다시 시도|Try again/);
  });
});

describe("민감 정보 가리기 · 버튼 (I-05 44 · 45)", () => {
  it("마스크는 Checkbox 이고 Switch 가 아니다", async () => {
    await render(false);
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(
      [...container.querySelectorAll('[role="checkbox"]')].some((c) =>
        c.closest("div")?.textContent?.includes("section.maskSensitive"),
      ),
    ).toBe(true);
  });

  it("[내보내기] 는 neutralSolid, [미리보기] 는 neutralWeak", async () => {
    await render(false);
    expect(btnExact("export").className).toContain("bg-bg-neutral-inverted");
    expect(btnExact("preview").className).toContain("bg-bg-neutral-weak");
  });

  it("폰은 바닥 고정 짝(ResponsivePair), 데스크톱은 오른쪽 정렬", async () => {
    await render(true);
    expect(
      container.querySelector(
        '[data-slot="data-action-bar"] [data-slot="responsive-pair"]',
      ),
    ).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await render(false);
    const bar = container.querySelector('[data-slot="data-action-bar"]')!;
    expect(bar.className).toContain("justify-end");
  });
});

describe("내보내기 결과 알림 (I-05 47)", () => {
  it("성공은 '내보냈어요' neutral 스낵바", async () => {
    state.download = () => Promise.resolve(new Blob(["x"]));
    await render(false);
    await click(btnExact("export"));
    expect(state.toastSuccess).toEqual(["section.exportDone"]);
  });

  it("받기가 멈추면 실패 띠에 '다시 시도' 동작이 붙는다", async () => {
    state.download = () => Promise.reject(new ExportStalledError());
    await render(false);
    await click(btnExact("export"));
    expect(state.toastError).toHaveLength(1);
    expect(state.toastError[0]!.msg).toBe("section.exportStalled");
    expect(state.toastError[0]!.opts.action?.label).toBeTruthy();
  });

  it("서버가 거절하면 서버 글이 아니라 고정 글 + 다시 시도", async () => {
    state.download = () =>
      Promise.reject({ response: { data: { message: "서버 원문 오류" } } });
    await render(false);
    await click(btnExact("export"));
    expect(state.toastError).toHaveLength(1);
    expect(state.toastError[0]!.msg).toBe("section.exportFailed");
    expect(state.toastError[0]!.opts.action?.label).toBeTruthy();
  });
});

describe("검수 반영 — 카드 안 바닥 · 폰 바 · 오류 들임 · 형식 컨트롤(I-05 42 · 43 · 45)", () => {
  it("데스크톱 체크와 버튼 줄은 마지막 카드 안 바닥 오른쪽이다(회색 바닥 위가 아니다)", async () => {
    await render(false);
    const bar = container.querySelector('[data-slot="data-action-bar"]')!;
    expect(bar.closest('[data-slot="card"]')).not.toBeNull();
    expect(bar.className).toContain("justify-end");
    const cards = [
      ...container
        .querySelector('[role="tabpanel"]')!
        .querySelectorAll('[data-slot="card"]'),
    ];
    expect(cards[cards.length - 1]!.contains(bar)).toBe(true);
  });

  it("폰 바는 sticky 로 자기 높이만큼 자리를 차지한다 — 고정 자리 비움 숫자가 없다", async () => {
    await render(true);
    const bar = container.querySelector('[data-slot="data-action-bar"]')!;
    expect(bar.className).toContain("sticky");
    expect(bar.className).not.toContain("fixed");
    expect(bar.closest('[data-slot="card"]')).toBeNull();
    expect(container.innerHTML).not.toContain(
      "spacing-x16)+var(--spacing-x12)",
    );
  });

  it("데스크톱 3열 형식 상자는 라디오 컨트롤이 없고, 폰 1열은 있다(select-box.md:47)", async () => {
    await render(false);
    const marks = (g: HTMLElement) =>
      g.querySelectorAll(
        '[data-slot="select-box-control"], [data-slot="radiomark"]',
      ).length;
    const desktopFormat = groups()[1]!;
    const desktopPeriod = groups()[0]!;
    expect(marks(desktopFormat)).toBeLessThan(marks(desktopPeriod));
    act(() => root.unmount());
    root = createRoot(container);
    await render(true);
    expect(marks(groups()[1]!)).toBe((marks(groups()[0]!) / 5) * 3);
  });

  it("건수 불러오기 실패 오류 글은 줄과 같은 왼쪽 24(px-global-gutter)다", async () => {
    state.countsFail = true;
    await render(false);
    const field = container.querySelector('[data-slot="field"][data-invalid]')!;
    expect(field.className).toContain("px-global-gutter");
  });
});

describe("표기 한 벌(사용자 결정 · date-picker.md:181)", () => {
  it("기간 구분은 물결표를 앞뒤에 붙여 쓴다 — ' — ' 가 아니다", async () => {
    await render(false);
    const text = groups()[0]!.textContent!;
    expect(text).toMatch(/\d~/);
    expect(text).not.toContain(" — ");
  });

  it("형식 이름은 'CSV (.csv)' 꼴이다", async () => {
    await render(false);
    expect(groups()[1]!.textContent).toContain("CSV (.csv)");
  });

  it("'직접' 기간 칸은 한 줄 값(말줄임) 그대로이고 달력 아이콘이 있다 — 줄바꿈으로 덮지 않는다", async () => {
    await render(false);
    const radios = groups()[0]!.querySelectorAll<HTMLElement>('[role="radio"]');
    await click(radios[4]!);
    const field = radios[4]!
      .closest('[data-slot="select-box"]')!
      .querySelector('[data-slot="input-button"]')!;
    expect(field.className).not.toContain("break-keep");
    expect(field.querySelector("svg")).not.toBeNull();
  });
});

describe("검수 재반영 — 폰 바닥 바 · 목록 카드 바닥 · 빈 미리보기(W2 · W3 · W4)", () => {
  it("폰 바닥 바는 pane 의 마지막 자식이다 — 미리보기가 떠도 바닥을 떠나지 않는다", async () => {
    await render(true);
    const pane =
      container.querySelector('[role="tabpanel"]')!.firstElementChild!;
    expect(pane.lastElementChild!.getAttribute("data-slot")).toBe(
      "data-action-bar",
    );
  });

  it("목록 카드의 바닥 아래 여백은 카드 몫 하나다(36 이 아니라 24)", async () => {
    await render(false);
    expect(container.innerHTML).not.toContain('pb-x6"');
  });
});

describe("미리보기 바닥 글의 셈(재검수 B2)", () => {
  it("N 은 고른 종류 수라 서버가 빈 종류의 표를 빼도 바뀌지 않고, 합계는 고른 종류 건수 합(빈 종류 0)이다", async () => {
    // 고른 종류 셋(거래 · 자산 · 예산) 중 서버가 표 하나만 돌려준다 — 둘은 비어 빠졌다
    state.preview = [
      {
        type: "expense",
        displayName: "거래 내역",
        totalCount: 123456,
        headers: ["날짜"],
        rows: [["2026-10-01"]],
      },
    ];
    await render(false);
    await click(btnExact("preview"));
    const text = container.textContent ?? "";
    expect(text).toContain(
      'section.previewFooter{"rows":"1","types":"3","total":"123,459"}',
    );
  });

  it("빈 표의 안내 아이콘은 FileText 다(앱과 같은 아이콘)", async () => {
    state.preview = [
      {
        type: "memo",
        displayName: "메모",
        totalCount: 0,
        headers: ["제목"],
        rows: [],
      },
    ];
    await render(false);
    await click(btnExact("preview"));
    const asset = container.querySelector(
      '[data-slot="result-section-asset"] svg',
    )!;
    expect(asset.getAttribute("class")).toContain("lucide-file-text");
  });
});
