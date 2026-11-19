// 가져오기 완료 화면은 "건너뜀 20 · 실패 2" 숫자만 보여 줬다 — 서버는 어느 행이 왜
// 실패했는지 이미 내려주는데 화면이 안 읽었다(QA #61). 매핑 단계는 새 카테고리가
// 몇 개 생길지 말해 주지 않아 오타가 그대로 카테고리가 됐다(QA #59).
// 가져오기는 거래를 수백 건 만들면서 쿼리를 하나도 안 비웠다(QA #144).
// 여기서 고정하는 건 그 두 화면이 서버 응답을 실제로 그린다는 것, 모르는 사유 코드가
// 사용자 눈에 영문으로 새지 않는다는 것, 그리고 가져오기가 만든 데이터를 읽는 화면들의
// 캐시가 실제로 비워진다는 것이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ImportAnalyzeResult,
  ImportExecuteResult,
} from "@/features/import/api/importApi";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const analysis: ImportAnalyzeResult = {
  fileName: "qa.csv",
  totalRows: 30,
  validRows: 30,
  duplicateCount: 20,
  blockedParents: [],
  columns: [
    { index: 0, name: "날짜" },
    { index: 1, name: "금액" },
    { index: 2, name: "분류" },
  ],
  suggestedMapping: { DATE: 0, AMOUNT: 1, CATEGORY: 2 },
  preview: [],
  newCategories: [],
  newCategoryCount: 0,
};

const state = vi.hoisted(() => ({
  analyze: null as unknown,
  execute: null as unknown,
  analyzeSources: [] as string[],
}));

vi.mock("@/features/import/api/importApi", () => ({
  analyzeImport: (_file: File, source: string) => {
    state.analyzeSources.push(source);
    return Promise.resolve(state.analyze);
  },
  executeImport: () => Promise.resolve(state.execute),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: object) => (o ? k + JSON.stringify(o) : k),
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { DataImportSection } = await import("./DataImportSection");

/** 지금 주소 — 가져오기 뒤 가계부로 가는지 본다 */
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries");
  state.analyze = { ...analysis };
  state.execute = null;
  state.analyzeSources = [];
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const btn = (needle: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(needle),
  );

/** 무효화된 루트 키들 — 호출 순서와 무관하게 본다. */
const invalidatedKeys = () =>
  vi
    .mocked(queryClient.invalidateQueries)
    .mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));

/** 파일 선택 → 분석까지. 매핑 단계에 선다. */
async function toMapping(file?: File) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/desk/settings"]}>
          <DataImportSection mobile={false} />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const picked = file ?? new File(["a"], "qa.csv", { type: "text/csv" });
  Object.defineProperty(input, "files", {
    value: [picked],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** 매핑 단계에서 실행까지. 완료 화면에 선다. */
async function toDone(result: ImportExecuteResult) {
  state.execute = result;
  await toMapping();
  await act(async () => {
    btn("import.doImport")!.click();
  });
}

const baseResult: ImportExecuteResult = {
  imported: 8,
  skipped: 20,
  failed: 2,
  failures: [
    { lineNo: 21, reason: "amount" },
    { lineNo: 34, reason: "date" },
  ],
  failuresTruncated: false,
  createdCategories: [],
  createdCategoryCount: 0,
};

describe("가져오기 완료 화면 — 실패한 행 (QA #61)", () => {
  it("어느 행이 실패했는지 행 번호로 알려 준다", async () => {
    await toDone(baseResult);
    expect(container.textContent).toContain('import.failureLine{"line":21}');
    expect(container.textContent).toContain('import.failureLine{"line":34}');
  });

  it("사유 코드를 번역해서 보여 준다 — 코드 원문이 아니다", async () => {
    await toDone(baseResult);
    expect(container.textContent).toContain("import.failReason.amount");
    expect(container.textContent).toContain("import.failReason.date");
  });

  it("모르는 코드는 기본 문구로 떨어뜨린다 — 영문 코드가 새지 않는다", async () => {
    await toDone({
      ...baseResult,
      failed: 1,
      failures: [{ lineNo: 7, reason: "fxRate" }],
    });
    expect(container.textContent).toContain("import.failReason.unknown");
    expect(container.textContent).not.toContain("fxRate");
  });

  it("서버가 목록을 잘랐으면 잘랐다고 적는다", async () => {
    await toDone({
      ...baseResult,
      failed: 120,
      failures: Array.from({ length: 50 }, (_, i) => ({
        lineNo: i + 2,
        reason: "save",
      })),
      failuresTruncated: true,
    });
    expect(container.textContent).toContain(
      'import.failuresCapped{"shown":"50","total":"120"}',
    );
  });

  it("자르지 않았으면 그 안내를 띄우지 않는다", async () => {
    await toDone(baseResult);
    expect(container.textContent).not.toContain("import.failuresCapped");
  });

  it("실패 수와 목록 길이가 어긋나면 그것만으로도 잘렸다고 본다", async () => {
    // 옛 서버가 failuresTruncated 를 안 보내도 "실패 120 · 50줄" 을 그대로 두지 않는다.
    await toDone({
      ...baseResult,
      failed: 120,
      failures: Array.from({ length: 50 }, (_, i) => ({
        lineNo: i + 2,
        reason: "save",
      })),
      failuresTruncated: false,
    });
    expect(container.textContent).toContain(
      'import.failuresCapped{"shown":"50","total":"120"}',
    );
  });

  it("실패가 없으면 목록 자체가 없다", async () => {
    await toDone({ ...baseResult, failed: 0, failures: [] });
    expect(container.textContent).not.toContain("import.failuresTitle");
  });

  it("실제로 만든 카테고리를 완료 화면에 남긴다", async () => {
    await toDone({
      ...baseResult,
      createdCategories: ["싟비", "식비 > 커피"],
      createdCategoryCount: 2,
    });
    expect(container.textContent).toContain("싟비");
    expect(container.textContent).toContain("식비 > 커피");
  });
});

describe("가져오기 매핑 단계 — 새로 만들 카테고리 (QA #59)", () => {
  it("새로 생길 카테고리 이름을 실행 전에 보여 준다", async () => {
    state.analyze = {
      ...analysis,
      newCategories: ["싟비", "식비 > 커피"],
      newCategoryCount: 2,
    };
    await toMapping();
    expect(container.textContent).toContain(
      'import.newCatTitle{"count":2,"countText":"2"}',
    );
    expect(container.textContent).toContain("싟비");
    expect(container.textContent).toContain("식비 > 커피");
  });

  it("상한을 넘으면 몇 개가 더 있는지 적는다", async () => {
    state.analyze = {
      ...analysis,
      newCategories: ["A", "B"],
      newCategoryCount: 60,
    };
    await toMapping();
    expect(container.textContent).toContain('import.newCatMore{"count":"58"}');
  });

  it("새로 생길 게 없으면 블록이 없다", async () => {
    await toMapping();
    expect(container.textContent).not.toContain("import.newCatTitle");
  });

  it("자동 생성을 끄면 블록이 사라진다 — 끄면 미분류로 들어간다", async () => {
    state.analyze = {
      ...analysis,
      newCategories: ["싟비"],
      newCategoryCount: 1,
    };
    await toMapping();
    const autoCat = container.querySelectorAll('[role="checkbox"]')[1]!;
    await act(async () => {
      (autoCat as HTMLElement).click();
    });
    expect(container.textContent).not.toContain("import.newCatTitle");
  });
});

describe("가져오기 성공 — 캐시 비우기 (QA #144)", () => {
  // 가져오기는 거래를 수백 건 만든다. 캐시를 안 비우면 가계부·통계·예산·자산·홈이
  // 전부 옛 값이라, 방금 수백 건을 넣은 사용자가 화면마다 새로고침을 눌러야 했다.
  it("가계부·자산·카드·홈 캐시를 전부 비운다", async () => {
    await toDone(baseResult);
    const keys = invalidatedKeys();
    expect(keys).toContain(JSON.stringify(["expenses"]));
    expect(keys).toContain(JSON.stringify(["assets"]));
    expect(keys).toContain(JSON.stringify(["cards"]));
    expect(keys).toContain(JSON.stringify(["dashboard"]));
  });

  it("한 건도 안 들어와도 비운다 — 건너뛴 게 있으면 중복 판정이 이미 바뀌었다", async () => {
    await toDone({ ...baseResult, imported: 0 });
    expect(invalidatedKeys()).toContain(JSON.stringify(["expenses"]));
  });

  it("실행 전에는 아무것도 안 비운다", async () => {
    state.execute = baseResult;
    await toMapping();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("실행이 실패하면 비우지 않는다 — 만들어진 게 없다", async () => {
    // 떠 있는 rejected promise 를 만들지 않으려고 thenable 로 거절한다.
    state.execute = {
      then: (_ok: unknown, fail: (e: Error) => void) => fail(new Error("boom")),
    };
    await toMapping();
    await act(async () => {
      btn("import.doImport")!.click();
    });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  // 서버 ImportSource enum 이름(POREST · EASYBUDGET · …)이 그대로 가야 한다 — 문구처럼 바꾸면 400.
  it("기본 출처는 서버 enum 이름 POREST 로 보낸다", async () => {
    await toMapping();
    expect(state.analyzeSources).toEqual(["POREST"]);
  });
});

describe("가져오기 단계 머리 (Q6 6B · I-05 48)", () => {
  it("1 단계는 '1 / 3단계' + 단계 이름 + 한 줄 설명이고 단계 원은 없다", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DataImportSection mobile={false} />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    const text = container.textContent ?? "";
    expect(text).toContain('import.stepMeta{"current":1,"total":3}');
    expect(text).toContain("import.stepUpload");
    expect(text).toContain("import.stepUploadDesc");
    expect(text).not.toContain("import.stepDone");
    expect(text).not.toContain("✓");
  });

  it("2 단계는 '2 / 3단계' + 열 매핑", async () => {
    await toMapping();
    const text = container.textContent ?? "";
    expect(text).toContain('import.stepMeta{"current":2,"total":3}');
    expect(text).toContain("import.stepMappingDesc");
  });

  it("완료 화면에는 단계 머리가 없다", async () => {
    await toDone(baseResult);
    expect(container.textContent).not.toContain("import.stepMeta");
  });
});

describe("파일 고르기 (I-05 48)", () => {
  const bigFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.csv", {
    type: "text/csv",
  });

  it("10MB 가 넘으면 분석하지 않고 칸 아래 오류 글로 알린다", async () => {
    await toMapping(bigFile);
    expect(state.analyzeSources).toEqual([]);
    expect(container.textContent).toContain("import.errorSize");
  });

  it("형식이 다르면 칸 아래 오류 글로 알린다", async () => {
    await toMapping(new File(["a"], "memo.pdf", { type: "application/pdf" }));
    expect(state.analyzeSources).toEqual([]);
    expect(container.textContent).toContain("import.errorType");
  });

  it("파일 선택은 키보드로 닿는 버튼이다 — 점선 div 가 아니다", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DataImportSection mobile={false} />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    const pick = container.querySelector('[data-slot="attachment-input-pick"]');
    expect(pick?.tagName).toBe("BUTTON");
  });
});

describe("미리보기 표 (I-05 46 · 48)", () => {
  const rows = [
    {
      lineNo: 2,
      date: "2026-10-01",
      type: "EXPENSE",
      amount: 1000,
      category: "식비",
      asset: "현금",
      memo: "",
      duplicate: false,
      error: null,
    },
    {
      lineNo: 3,
      date: "2026-10-02",
      type: "EXPENSE",
      amount: 2000,
      category: "식비",
      asset: "현금",
      memo: "",
      duplicate: true,
      error: null,
    },
    {
      lineNo: 4,
      date: null,
      type: null,
      amount: null,
      category: null,
      asset: null,
      memo: "",
      duplicate: false,
      error: "date",
    },
  ];

  it("ds Table 이고, 오류 · 중복 줄은 흐리지 않고 상태 배지로 가른다", async () => {
    state.analyze = { ...analysis, preview: rows };
    await toMapping();
    expect(container.querySelector('[data-slot="table"]')).not.toBeNull();
    const trs = [...container.querySelectorAll("tbody tr")] as HTMLElement[];
    expect(trs).toHaveLength(3);
    for (const tr of trs) {
      expect(tr.style.opacity).toBe("");
      expect(tr.className).not.toMatch(/opacity/);
    }
    expect(trs[1]!.textContent).toContain("import.dupBadge");
    expect(trs[2]!.textContent).toContain("import.errorBadge");
    expect(trs[0]!.textContent).not.toContain("import.dupBadge");
  });
});

describe("옵션 · 완료 (I-05 48 · 50)", () => {
  it("중복 건너뛰기 · 새 카테고리 자동 생성은 Checkbox 이고 스위치가 아니다", async () => {
    await toMapping();
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(
      container.querySelectorAll('[role="checkbox"]').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("완료 화면은 Result Section done 이고 [가계부로 가기] 가 가계부로 간다", async () => {
    await toDone(baseResult);
    const rs = container.querySelector('[data-slot="result-section"]');
    expect(rs?.getAttribute("data-kind")).toBe("done");
    expect(rs?.getAttribute("data-size")).toBe("medium"); // 데스크톱 = 카드 안 medium(Q2 A)
    await act(async () => {
      btn("import.toLedger")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
      "/desk/expense",
    );
  });

  it("[다른 파일 가져오기] 는 글 버튼(ghost)이다", async () => {
    await toDone(baseResult);
    expect(btn("import.another")!.className).toContain("bg-transparent");
  });
});

describe("가져오는 동안 덮개 (I-05 49)", () => {
  it("실행 중 덮개가 서고 걷힌다", async () => {
    let finish!: (r: ImportExecuteResult) => void;
    state.execute = new Promise<ImportExecuteResult>((r) => (finish = r));
    await toMapping();
    await act(async () => {
      btn("import.doImport")!.click();
    });
    expect(
      document.body.querySelector('[data-slot="busy-overlay"]'),
    ).not.toBeNull();
    await act(async () => finish(baseResult));
    expect(
      document.body.querySelector('[data-slot="busy-overlay"]'),
    ).toBeNull();
  });
});

describe("검수 반영 — 완료 화면(I-05 50)", () => {
  it("제목은 쉼표가 있는 건수 '{n}건을 가져왔어요' 이고 설명은 건너뛴 · 못 가져온 건수다", async () => {
    await toDone({ ...baseResult, imported: 1234567 });
    const text = container.querySelector(
      '[data-slot="result-section"]',
    )!.textContent!;
    expect(text).toContain(
      'import.doneTitle{"count":1234567,"countText":"1,234,567"}',
    );
    expect(text).toContain("import.doneDetail");
    expect(text).not.toContain("import.doneCount");
  });

  it("만든 카테고리는 Badge 가 아니라 List 줄이다", async () => {
    await toDone({
      ...baseResult,
      createdCategories: ["식비", "식비 > 커피"],
      createdCategoryCount: 2,
    });
    const items = [
      ...container.querySelectorAll('[data-slot="list-item"]'),
    ].map((e) => e.textContent);
    expect(items).toContain("식비");
    expect(items).toContain("식비 > 커피");
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(0);
  });

  it("[가계부로 가기] 는 모든 폭에서 large 48 이다", async () => {
    await toDone(baseResult);
    expect(btn("import.toLedger")!.className).toContain("min-h-[48px]");
  });

  it("목록 머리는 R5 mediumWeak 목록 제목이다(boldSolid 아님)", async () => {
    await toDone(baseResult);
    const header = container.querySelector('[data-slot="list-header"]')!;
    expect(header.className).toContain("text-fg-neutral-subtle");
    expect(header.className).not.toContain("text-fg-neutral ");
  });
});

describe("검수 재반영 — 쉼표 · 실패 사유 자리(W5 · W6)", () => {
  it("건수에 천 단위 쉼표가 붙는다", async () => {
    await toDone({
      ...baseResult,
      failed: 1200,
      failures: [{ lineNo: 5, reason: "date" }],
      failuresTruncated: true,
      createdCategories: ["a"],
      createdCategoryCount: 1234,
    });
    const text = container.textContent ?? "";
    expect(text).toContain(
      'import.failuresTitle{"count":1200,"countText":"1,200"}',
    );
    expect(text).toContain(
      'import.createdCatTitle{"count":1234,"countText":"1,234"}',
    );
    expect(text).toContain(
      'import.failuresCapped{"shown":"1","total":"1,200"}',
    );
  });

  it("실패 사유는 줄 뒤 값이 아니라 설명(detail) 자리다 — 긴 문장도 줄바꿈된다", async () => {
    await toDone(baseResult);
    const row = [...container.querySelectorAll('[data-slot="list-item"]')].find(
      (e) => e.textContent?.includes("import.failureLine"),
    )!;
    expect(
      row.querySelector('[data-slot="list-detail"]')?.textContent,
    ).toContain("import.failReason");
    expect(row.querySelector('[data-slot="list-suffix"]')).toBeNull();
  });
});

describe("데스크톱 완료 = 한 카드(사용자 결정 10-24 05-2 Q2 A)", () => {
  const big = {
    ...baseResult,
    createdCategories: ["식비", "식비 > 커피"],
    createdCategoryCount: 63,
  };

  it("결과 · 만든 카테고리 · 실패 줄이 카드 하나 안에 있고 Result Section 은 medium 이다", async () => {
    await toDone(big);
    const cards = container.querySelectorAll('[data-slot="card"]');
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    const rs = card.querySelector('[data-slot="result-section"]')!;
    expect(rs.getAttribute("data-size")).toBe("medium");
    expect(card.textContent).toContain("import.createdCatTitle");
    expect(card.textContent).toContain("import.failuresTitle");
  });

  it("[가계부로 가기] 는 카드 바닥 오른쪽이다", async () => {
    await toDone(big);
    const card = container.querySelector('[data-slot="card"]')!;
    const bar = card.querySelector('[data-slot="data-action-bar"]')!;
    expect(bar.className).toContain("justify-end");
    expect(bar.textContent).toContain("import.toLedger");
    expect(card.lastElementChild).toBe(bar);
  });
});
