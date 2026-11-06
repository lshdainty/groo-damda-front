// 폰 할 일 원장(TodoMobileLedger) — 실제 화면을 띄운 채로 I-10 5 ~ 18 · 23 을 잠근다.
// 번역은 CSV 원본에서 읽는다(키 이름이 아니라 사용자가 읽는 글로 본다). 고정한 오늘 + 데이터의 날짜도 함께 고정한다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo, TodoPriority, TodoStatus } from "@/entities/todo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function koCopy(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync("i18n/translations.csv", "utf-8").split(
    "\n",
  )) {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    const [ns, key, ko] = cells;
    if ((ns === "todo" || ns === "common") && key)
      out[`${ns}:${key}`] = ko ?? "";
  }
  return out;
}
const COPY = koCopy();

vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock(
  "@/shared/ui/groo/month-title",
  async () => import("@/shared/ui/groo/month-title.test-double"),
);
vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      const raw = COPY[`${ns ?? "common"}:${k}`];
      if (raw == null) return k;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(opts?.[name] ?? ""),
      );
    },
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/constellation", () => ({
  constellationColorVar: () => "var(--color-chart-blue)",
  constellationName: () => "오리온자리",
}));
vi.mock("@/widgets/constellation", () => ({ NightSkyHero: () => null }));

const { TodoMobileLedger } = await import("./TodoMobileLedger");
const { i18n } = await import("@/shared/i18n/config");

const SKY_TODAY = {
  constellation: { colorKey: "blue" },
  points: 3,
  goal: 5,
  collected: false,
  streak: 4,
} as never;

const todo = (
  rowId: number,
  title: string,
  o: {
    dueDate?: string | null;
    priority?: TodoPriority;
    status?: TodoStatus;
    category?: string | null;
    content?: string | null;
  } = {},
): Todo => ({
  rowId,
  title,
  content: o.content ?? null,
  priority: o.priority ?? "MEDIUM",
  category: o.category === undefined ? null : o.category,
  status: o.status ?? "PENDING",
  type: "TASK",
  isPinned: false,
  dueDate: o.dueDate === undefined ? "2026-10-22" : o.dueDate,
  completedAt: null,
  sortOrder: rowId,
  parentRowId: null,
  tags: [],
  subtaskCount: 0,
  subtaskCompletedCount: 0,
  createAt: "2026-10-01T00:00:00",
  modifyAt: "2026-10-01T00:00:00",
});

const LONG =
  "아주 긴 할 일 제목이 한 줄에 다 들어가지 않을 때 줄이 바뀌고 잘리지 않는지 보려고 길게 적은 제목입니다 — 말줄임 없음";

const st = vi.hoisted(() => ({ todos: [] as Todo[] }));

let container: HTMLDivElement;
let root: Root;
const calls = {
  toggle: [] as number[],
  open: [] as number[],
  edit: [] as number[],
};

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("ko");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00"));
  st.todos = [
    todo(1, "남은 일 보통", { priority: "MEDIUM", category: "업무" }),
    todo(2, "끝낸 일", { status: "COMPLETED", priority: "HIGH" }),
    todo(3, "남은 일 중요", { priority: "HIGH", content: "메모가 있어요" }),
    todo(4, LONG, {
      dueDate: "2026-10-21",
      category: "장기프로젝트자료모으기정",
    }),
    todo(5, "지난 마감", { dueDate: "2026-10-18", priority: "LOW" }),
    todo(6, "마감 없음", { dueDate: null }),
  ];
  calls.toggle = [];
  calls.open = [];
  calls.edit = [];
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

type Props = Partial<Parameters<typeof TodoMobileLedger>[0]>;
const render = (p: Props = {}) =>
  act(() =>
    root.render(
      <TodoMobileLedger
        todos={st.todos}
        tags={["업무", "장기프로젝트자료모으기정"]}
        constellationToday={SKY_TODAY}
        sky={[]}
        doneToday={1}
        pinTop={56}
        onToggle={(t) => calls.toggle.push(t.rowId)}
        onRowClick={(t) => calls.open.push(t.rowId)}
        onEdit={(t) => calls.edit.push(t.rowId)}
        onDelete={async () => {}}
        openNightSky={() => {}}
        openReport={() => {}}
        {...p}
      />,
    ),
  );
const byName = (name: string, scope: ParentNode = document.body) =>
  Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent) === name,
  );
const click = (el: HTMLElement | undefined) => {
  expect(el, "누를 단추가 있다").toBeTruthy();
  act(() => el!.click());
};
const rowTitles = () =>
  Array.from(
    container.querySelectorAll<HTMLElement>("[data-slot=list-title]"),
  ).map((e) => e.textContent);

describe("머리 — 단추 · 펼침 (I-10 7 · 9 · 10)", () => {
  it("월 이동 · 거르기는 이름이 있는 아이콘 단추고 개수 숫자가 없다", () => {
    render();
    for (const name of ["이전 달", "다음 달", "필터"])
      expect(byName(name), name).toBeTruthy();
    expect(byName("필터")!.textContent).toBe("");
  });

  it('거르기가 걸리면 단추 이름에 "조건 걸림" 이 붙고 알림 점 하나가 뜬다 — 틴트 · 숫자는 없다', () => {
    render();
    expect(
      byName("필터")!.querySelector("[data-slot=notification-badge-dot]"),
    ).toBeNull();
    click(byName("필터"));
    // 시트의 "완료한 할 일 숨기기" 를 켠다
    const sw = document.body.querySelector<HTMLElement>("[role=switch]");
    click(sw!);
    click(byName("완료"));
    expect(byName("필터, 조건 걸림")).toBeTruthy();
    const btn = byName("필터, 조건 걸림")!;
    expect(btn.getAttribute("data-active")).toBeNull();
    expect(btn.className).not.toMatch(/bg-bg-brand-weak/);
    expect(btn.textContent).toBe("");
  });

  it('"월 달력" 과 "밤하늘" 은 하나만 펼친다 — 이름은 "월 달력" 고정 + aria-expanded', () => {
    render();
    const month = () => byName("월 달력")!;
    const sky = () => byName("밤하늘")!;
    expect(month().getAttribute("aria-expanded")).toBe("false");
    click(month());
    expect(month().getAttribute("aria-expanded")).toBe("true");
    click(sky());
    expect(sky().getAttribute("aria-expanded")).toBe("true");
    expect(month().getAttribute("aria-expanded")).toBe("false");
    click(month());
    expect(month().getAttribute("aria-expanded")).toBe("true");
    expect(sky().getAttribute("aria-expanded")).toBe("false");
  });

  it("날 칸 이름이 표시의 뜻을 읽고 표시는 장식(aria-hidden)이다 — 오는 날도 흐리지 않는다", () => {
    render();
    click(byName("월 달력"));
    const cells = Array.from(
      container.querySelectorAll<HTMLElement>("button[data-sel]"),
    );
    const names = cells.map((c) => c.getAttribute("aria-label"));
    expect(names).toContain("10월 22일, 남은 할 일 2개");
    // 오늘 · 오는 날 모두 이름이 있다
    expect(names).toContain("10월 25일");
    const today = cells.find(
      (c) => c.getAttribute("aria-label") === "10월 22일, 남은 할 일 2개",
    )!;
    const mark = today.querySelector<HTMLElement>("[aria-hidden=true]");
    expect(mark?.textContent).toBe("2건");
    expect(mark?.className).toContain("text-fg-brand");
    // 오는 날 숫자는 fg-neutral-subtle 이고 불투명도 클래스 · 인라인이 없다
    const future = cells.find(
      (c) => c.getAttribute("aria-label") === "10월 25일",
    )!;
    const num = future.querySelector<HTMLElement>("span")!;
    expect(num.className).toContain("text-fg-neutral-subtle");
    expect(container.innerHTML).not.toMatch(/opacity/);
  });
});

describe("줄 — List + Checkbox (I-10 12 · 13 · 14)", () => {
  it("묶음 안 차례는 남은 일(중요 → 보통) 위 · 끝낸 일 아래다", () => {
    render();
    const titles = rowTitles();
    const day = titles.slice(
      titles.indexOf("남은 일 중요"),
      titles.indexOf("끝낸 일") + 1,
    );
    expect(day).toEqual(["남은 일 중요", "남은 일 보통", "끝낸 일"]);
  });

  it('체크는 이름 "{제목} 완료" 하나고, 지난 마감이면 ", 마감 지남" 이 붙는다', () => {
    render();
    const box = (name: string) =>
      container.querySelector<HTMLElement>(
        `[role=checkbox][aria-label="${name}"]`,
      );
    expect(box("남은 일 보통 완료")).toBeTruthy();
    expect(box("지난 마감 완료, 마감 지남")).toBeTruthy();
    // 끝냄은 체크 상태가 읽는다 — 이름이 "완료 취소" 로 바뀌지 않는다
    expect(box("끝낸 일 완료")!.getAttribute("aria-checked")).toBe("true");
    expect(box("남은 일 보통 완료")!.getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("누르면 바로 부른다 — 칸을 막지 않고 스피너를 그리지 않는다", () => {
    render();
    const box = container.querySelector<HTMLElement>(
      '[role=checkbox][aria-label="남은 일 보통 완료"]',
    )!;
    expect(box.hasAttribute("disabled")).toBe(false);
    expect(box.getAttribute("aria-busy")).toBeNull();
    click(box);
    expect(calls.toggle).toEqual([1]);
    expect(container.querySelector("[data-slot=spinner], .spinner")).toBeNull();
    // 줄 누름(상세)은 따로다
    expect(calls.open).toEqual([]);
  });

  it('줄을 누르면 상세로 가고, 설명은 태그 이름 또는 "태그 없음" · 메모가 있으면 "메모" 다', () => {
    render();
    const row = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
    ).find((b) => b.textContent?.includes("남은 일 중요"))!;
    expect(row.textContent).toContain("태그 없음");
    expect(row.textContent).toContain("메모");
    click(row);
    expect(calls.open).toEqual([3]);
  });

  it("긴 제목은 말줄임 없이 줄이 바뀐다 · 줄 사이 선이 없다 · 끝낸 줄은 취소선 + fg-disabled 이고 흐리지 않는다", () => {
    render();
    const long = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot=list-title]"),
    ).find((e) => e.textContent === LONG)!;
    expect(long.className).not.toMatch(/truncate|ellipsis|nowrap/);
    expect(long.querySelector("span")!.className).not.toMatch(/truncate/);
    expect(container.querySelector("[data-slot=divider]")).toBeTruthy(); // 머리 아래 끝까지 선 하나
    expect(
      container.querySelectorAll("[data-slot=list-item] [data-slot=divider]")
        .length,
    ).toBe(0);
    const doneTitle = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot=list-title] > span"),
    ).find((e) => e.textContent === "끝낸 일")!;
    expect(doneTitle.className).toContain("line-through");
    expect(doneTitle.className).toContain("text-fg-disabled");
    const item = doneTitle.closest<HTMLElement>("[data-slot=list-item]")!;
    expect(item.className).not.toMatch(/opacity/);
    expect(item.getAttribute("aria-disabled")).toBeNull();
  });

  it("우선순위 배지는 중요만 critical 이고 보통 · 여유는 neutral 이다 — 끝낸 줄은 bg-disabled", () => {
    render();
    const badge = (title: string) =>
      Array.from(
        container.querySelectorAll<HTMLElement>("[data-slot=list-item]"),
      )
        .find((i) => i.textContent?.includes(title))!
        .querySelector<HTMLElement>("[data-slot=badge]")!;
    expect(badge("남은 일 중요").className).toMatch(/critical/);
    expect(badge("남은 일 보통").className).not.toMatch(
      /critical|warning|informative/,
    );
    expect(badge("지난 마감").className).not.toMatch(
      /critical|warning|informative/,
    );
    expect(badge("끝낸 일").className).toContain("bg-bg-disabled");
  });
});

describe("날짜 묶음 머리 (I-10 16)", () => {
  it('h2 · "10월 21일 (수) · 어제" · 다 끝낸 날도 초록 없이 같은 글 색이다', () => {
    st.todos = [
      todo(1, "어제 끝낸 일", { dueDate: "2026-10-21", status: "COMPLETED" }),
    ];
    render();
    const h2 = container.querySelector("h2")!;
    expect(h2.textContent?.replace(/\u00a0/g, " ")).toBe(
      "10월 21일 (수) · 어제",
    );
    // 머리말은 브라우저 기본 굵기(700)가 아니라 머리 값(500)을 물려받는다
    expect(h2.className).toContain("[font-weight:inherit]");
    const head = h2.closest("[data-slot=list-header]")!;
    expect(head.textContent).toContain("1/1 완료");
    expect(head.innerHTML).not.toMatch(/green|positive/);
  });

  it('마감일 없는 묶음은 맨 아래, 이름은 "마감일 없음" 이다', () => {
    render();
    const heads = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent,
    );
    expect(heads[heads.length - 1]).toBe("마감일 없음");
  });
});

describe("거르기 시트 (I-10 23)", () => {
  it('태그 칩에 "태그 없음"(그런 할 일이 있을 때만, 맨 뒤) · 우선순위 칩 · 완료 숨기기는 스위치 줄이다', () => {
    render();
    click(byName("필터"));
    const sheet = document.body.querySelector(
      "[data-slot=bottom-sheet-content]",
    )!;
    const chips = Array.from(
      sheet.querySelectorAll<HTMLElement>("[role=checkbox]"),
    ).map((c) => c.textContent);
    expect(chips).toEqual([
      "업무",
      "장기프로젝트자료모으기정",
      "태그 없음",
      "중요",
      "보통",
      "여유",
    ]);
    expect(sheet.querySelector("[role=switch]")).toBeTruthy();
    expect(byName("초기화")!.hasAttribute("disabled")).toBe(true);
  });

  it('"태그 없음" 만 골라도 바로 목록에 걸리고, 초기화로 풀린다 — 고르기 시트라 바깥을 눌러도 닫힌다', () => {
    render();
    click(byName("필터"));
    const chip = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=checkbox]"),
    ).find((c) => c.textContent === "태그 없음")!;
    click(chip);
    // 시트가 열려 있어도 뒤 목록이 이미 걸렸다 — 태그가 있는 줄(업무 · 긴 이름)이 빠지고 태그 없는 줄만 남는다
    expect(rowTitles()).toEqual([
      "지난 마감",
      "남은 일 중요",
      "끝낸 일",
      "마감 없음",
    ]);
    expect(rowTitles()).not.toContain("남은 일 보통");
    expect(rowTitles()).not.toContain(LONG);
    expect(byName("초기화")!.hasAttribute("disabled")).toBe(false);
    click(byName("초기화"));
    expect(rowTitles()).toContain("남은 일 보통");
  });

  it('걸러서 0건이면 funnel-x 빈 화면 + 글 "조건을 바꾸거나 지워보세요." · 버튼이 없다', () => {
    st.todos = [todo(1, "하나", { category: "업무" })];
    render();
    click(byName("필터"));
    const prio = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=checkbox]"),
    ).find((c) => c.textContent === "여유")!;
    click(prio);
    const rs = container.querySelector("[data-slot=result-section]")!;
    expect(rs.textContent).toContain("조건에 맞는 할 일이 없어요");
    expect(rs.textContent).toContain("조건을 바꾸거나 지워보세요.");
    expect(rs.querySelector("button")).toBeNull();
  });
});

describe("비어 있음 · 실패 (I-10 18)", () => {
  it("이 달 0건 — 안내 글 · 버튼 없음(추가는 [+] 가 맡는다)", () => {
    render({ todos: [] });
    const rs = container.querySelector("[data-slot=result-section]")!;
    expect(rs.textContent).toContain("10월 할 일이 없어요");
    expect(rs.querySelector("button")).toBeNull();
  });

  it("실패 — Result Section failure + 다시 시도, 서버 원문을 그리지 않는다", () => {
    let retried = 0;
    render({ failed: true, todos: [], onRetry: () => retried++ });
    const rs = container.querySelector("[data-slot=result-section]")!;
    expect(rs.textContent).toContain("할 일을 불러오지 못했어요");
    click(byName("다시 시도", rs));
    expect(retried).toBe(1);
    // 머리 틀은 그대로 있다
    expect(byName("이전 달")).toBeTruthy();
  });

  it("처음 받는 중 — 틀은 그리고 목록 자리만 aria-busy", () => {
    render({ loading: true, todos: [] });
    expect(container.querySelector("[aria-busy=true]")).toBeTruthy();
    expect(byName("이전 달")).toBeTruthy();
  });
});
