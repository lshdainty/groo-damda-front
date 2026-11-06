// 할 일 추가 · 수정 폼 · 상세(I-10 20 · 21) — 실제 부품을 띄운 채로 잠근다. 번역은 CSV 원본에서 읽는다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo, TodoFormValues } from "@/entities/todo";

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

vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
const { TodoFormDialog } = await import("./TodoFormDialog");
const { TodoDetailDialog } = await import("./TodoDetailDialog");

const base: Todo = {
  rowId: 7,
  title: "세금 신고",
  content: "첫 줄\n둘째 줄",
  priority: "HIGH",
  category: "업무",
  status: "PENDING",
  type: "TASK",
  isPinned: false,
  dueDate: "2026-10-18",
  completedAt: null,
  sortOrder: 0,
  parentRowId: null,
  tags: [],
  subtaskCount: 0,
  subtaskCompletedCount: 0,
  createAt: "2026-10-01T00:00:00",
  modifyAt: "2026-10-01T00:00:00",
};

let container: HTMLDivElement;
let root: Root;
let saved: { values: TodoFormValues; id?: number }[];
let closed: number;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  saved = [];
  closed = 0;
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
});

const form = (todo: Todo | null) =>
  act(() =>
    root.render(
      <TodoFormDialog
        todo={todo}
        today="2026-10-22"
        tags={["업무", "공부"]}
        onClose={() => closed++}
        onSave={(values, id) => saved.push({ values, id })}
      />,
    ),
  );
const q = <T extends Element = HTMLElement>(sel: string) =>
  document.body.querySelector<T>(sel);
const byName = (name: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === name,
  );
const click = (el: Element | null | undefined) => {
  expect(el, "누를 것이 있다").toBeTruthy();
  act(() => (el as HTMLElement).click());
};
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("추가 · 수정 폼 (I-10 20)", () => {
  it("처음 초점 — 새 할 일은 제목 칸, 수정은 글 입력 칸이 아닌 표면(폰에서 키보드가 가리지 않게)", async () => {
    form(null);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.activeElement).toBe(
      q("input[placeholder='할 일을 적어주세요']"),
    );
    act(() => root.unmount());
    root = createRoot(container);
    form(base);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.activeElement?.tagName).not.toBe("INPUT");
    expect(document.activeElement?.tagName).not.toBe("TEXTAREA");
  });

  it("칸은 세로로 하나씩 — 제목(필수 점) · 마감일 · 태그 · 우선순위 칩 · 메모", () => {
    form(null);
    const labels = Array.from(
      document.body.querySelectorAll("[data-slot=field-header]"),
    ).map((l) => l.textContent);
    expect(labels).toEqual(["제목", "마감일", "태그", "우선순위", "메모"]);
    expect(q("input[placeholder='할 일을 적어주세요']")).toBeTruthy();
    // 우선순위는 손 분절 버튼이 아니라 Chip 하나 고르기 셋이다
    const radios = Array.from(document.body.querySelectorAll("[role=radio]"));
    expect(radios.map((r) => r.textContent)).toEqual(["중요", "보통", "여유"]);
    expect(
      radios.find((r) => r.getAttribute("aria-checked") === "true")
        ?.textContent,
    ).toBe("보통");
    // 필수 점은 제목 칸만
    expect(
      document.body.querySelectorAll(
        "[data-slot=field-header] span[aria-hidden]",
      ).length,
    ).toBe(1);
  });

  it('새 할 일의 마감일 기본값은 오늘이고, 주 버튼은 "추가" 다(수정은 "저장")', () => {
    form(null);
    expect(q("[data-slot=input-button-value]")?.textContent).toContain("22");
    expect(byName("추가")).toBeTruthy();
    expect(byName("저장")).toBeFalsy();
    form(base);
    expect(byName("저장")).toBeTruthy();
  });

  it('제목이 비면 저장되지 않고 칸 아래 오류 "제목을 입력해주세요."', () => {
    form(null);
    click(byName("추가"));
    expect(saved).toEqual([]);
    expect(document.body.textContent).toContain("제목을 입력해주세요.");
    // 지금 웹의 빨간 상자는 없다
    expect(q("[style*=status-danger]")).toBeNull();
  });

  it('태그 목록은 "태그 없음" 이 맨 앞이다', () => {
    form(null);
    const select = q("[role=combobox]")!;
    click(select);
    const options = Array.from(
      document.body.querySelectorAll("[role=option]"),
    ).map((o) => o.textContent);
    expect(options.slice(0, 3)).toEqual(["태그 없음", "업무", "공부"]);
  });

  it("값을 넣고 저장하면 그대로 나간다 — 태그 없음은 null, 메모는 그대로", () => {
    form(null);
    setValue(
      q<HTMLInputElement>("input[placeholder='할 일을 적어주세요']")!,
      "  장 보기 ",
    );
    click(document.body.querySelectorAll("[role=radio]")[0]);
    click(byName("추가"));
    expect(saved).toHaveLength(1);
    expect(saved[0]!.values).toMatchObject({
      title: "장 보기",
      priority: "HIGH",
      category: null,
      dueDate: "2026-10-22",
    });
  });

  it('값이 바뀐 채 닫으면 "작성한 내용이 사라져요" 를 묻는다 — 바뀐 게 없으면 바로 닫힌다', () => {
    form(null);
    click(q("[data-slot=bottom-sheet-close]"));
    expect(closed).toBe(1);

    form(null);
    setValue(
      q<HTMLInputElement>("input[placeholder='할 일을 적어주세요']")!,
      "쓰던 글",
    );
    click(q("[data-slot=bottom-sheet-close]"));
    expect(closed).toBe(1);
    expect(q("[role=alertdialog]")).toBeTruthy();
  });

  it("제목은 200자 · 메모는 10,000자에서 멈춘다", () => {
    form(null);
    const title = q<HTMLInputElement>(
      "input[placeholder='할 일을 적어주세요']",
    )!;
    setValue(title, "가".repeat(300));
    expect(title.value.length).toBe(200);
    const memo = q<HTMLTextAreaElement>("textarea")!;
    setValue(memo, "나".repeat(10_050));
    expect(memo.value.length).toBe(10_000);
  });
});

describe("상세 (I-10 21)", () => {
  const detail = (todo: Todo) =>
    act(() =>
      root.render(
        <TodoDetailDialog
          todo={todo}
          today="2026-10-22"
          onClose={() => closed++}
          onEdit={() => {}}
          onDelete={async () => {}}
        />,
      ),
    );

  it("제목은 본문 맨 위 한 줄(머리 카드 · 그라디언트 없음), 키-값은 List 줄, 메모는 따로 List Header", () => {
    detail(base);
    const body =
      q("[data-slot=bottom-sheet-body]") ?? q("[data-slot=dialog-body]")!;
    expect(body.querySelector("h3")?.textContent).toBe("세금 신고");
    expect(body.innerHTML).not.toMatch(/gradient/);
    const rows = Array.from(body.querySelectorAll("[data-slot=list-item]")).map(
      (r) => r.textContent,
    );
    expect(rows.some((r) => r?.includes("마감일"))).toBe(true);
    expect(rows.some((r) => r?.includes("태그"))).toBe(true);
    expect(rows.some((r) => r?.includes("우선순위"))).toBe(true);
    // 메모는 키-값 줄에 들지 않는다
    expect(rows.every((r) => !r?.includes("첫 줄"))).toBe(true);
    const memoHead = Array.from(
      body.querySelectorAll("[data-slot=list-header]"),
    ).find((h) => h.textContent === "메모");
    expect(memoHead?.tagName).toBe("H3");
    expect(body.textContent).toContain("첫 줄\n둘째 줄");
  });

  it('지난 마감이면 값에 "마감 지남" 이 글로 붙고 fg-critical 이다', () => {
    detail(base);
    const due = Array.from(
      document.body.querySelectorAll("[data-slot=list-item]"),
    ).find((r) => r.textContent?.includes("마감일"))!;
    expect(due.textContent).toContain("마감 지남");
    expect(due.querySelector(".text-fg-critical")).toBeTruthy();
  });

  it("끝낸 할 일은 제목 취소선 + fg-disabled, 완료 일시 줄이 더해진다", () => {
    detail({
      ...base,
      status: "COMPLETED",
      completedAt: "2026-10-20T01:00:00",
    });
    const h = q("h3")!;
    expect(h.className).toContain("line-through");
    expect(h.className).toContain("text-fg-disabled");
    expect(document.body.textContent).toContain("완료 일시");
    expect(document.body.textContent).not.toContain("마감 지남");
  });

  it('메모가 없으면 "없음" 이다 · 바닥은 [삭제] [수정] 이고 삭제는 확인창을 연다', () => {
    detail({ ...base, content: null });
    expect(document.body.textContent).toContain("없음");
    click(byName("삭제"));
    const alert = q("[role=alertdialog]")!;
    expect(alert.textContent).toContain("할 일 삭제");
    expect(alert.textContent).toContain("되돌릴 수 없어요");
  });
});
