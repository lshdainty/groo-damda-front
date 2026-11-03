// 메모 추가 · 수정 폼 · 상세(I-15 13 · 14) — 실제 부품을 띄운 채로 잠근다. 번역은 CSV 원본에서 읽는다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Memo, MemoFormValues } from "@/entities/memo";

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
    if ((ns === "memo" || ns === "common") && key)
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

const { MemoFormDialog } = await import("./MemoFormDialog");
const { MemoDetailDialog } = await import("./MemoDetailDialog");

const base: Memo = {
  rowId: 7,
  title: "여행 계획",
  content: "첫 줄\n둘째 줄",
  tag: "여행",
  color: "#b36418",
  isPinned: true,
  createAt: "2026-10-01T00:00:00",
  modifyAt: "2026-10-22T08:10:00",
};

let container: HTMLDivElement;
let root: Root;
let saved: { values: MemoFormValues; id?: number; pinned: boolean }[];
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

const form = (memo: Memo | null, saveError = false, tagsReady = true) =>
  act(() =>
    root.render(
      <MemoFormDialog
        memo={memo}
        tags={["여행", "독서"]}
        saveError={saveError}
        saveErrorSeq={saveError ? 1 : 0}
        tagsReady={tagsReady}
        onClose={() => closed++}
        onSave={(values, id, pinned) => {
          saved.push({ values, id, pinned });
          return Promise.resolve();
        }}
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

describe("메모 폼 (I-15 13)", () => {
  it("제목 · 내용 아래 줄 칸 셋(태그 · 색상 · 상단에 고정)이 선 한 줄 뒤에 온다 — 꺾쇠 없음", () => {
    form(null);
    expect(q("[role=dialog]")).toBeTruthy();
    expect(q("input")).toBeTruthy();
    expect(q("textarea")).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toContain("태그");
    expect(text).toContain("태그 없음");
    expect(text).toContain("색상");
    expect(text).toContain("파랑");
    expect(text).toContain("상단에 고정");
    expect(q("[data-slot=list-chevron]")).toBeNull();
  });

  it("폼 본문에는 Scroll Fog 를 걸지 않는다(내용 칸이 화면 높이 32% 에서 멈춰 시트 90% 에 닿지 않는다)", () => {
    form(null);
    expect(
      q("[data-slot=bottom-sheet-body]")?.getAttribute("data-scroll-fog"),
    ).toBeNull();
  });

  it("태그 고르기 시트 본문에는 Scroll Fog 가 켜진다(태그 수는 사용자 데이터)", () => {
    form(null);
    click(byName("태그, 태그 없음"));
    const sheets = Array.from(
      document.body.querySelectorAll("[data-slot=bottom-sheet-body]"),
    );
    expect(sheets[sheets.length - 1]?.getAttribute("data-scroll-fog")).toBe(
      "overlayBody",
    );
  });

  it("제목 · 내용 칸의 라벨은 읽는 이름으로 남고 머리 줄은 흐름에 없다(칸 사이 gap 한 칸 더 없음)", () => {
    form(null);
    const headers = document.body.querySelectorAll("[data-slot=field-header]");
    expect(headers.length).toBeGreaterThanOrEqual(2);
    headers.forEach((h) => expect(h.className).toContain("sr-only"));
    expect(q<HTMLInputElement>("input")!.labels?.[0]?.textContent).toBe("제목");
    expect(q<HTMLTextAreaElement>("textarea")!.labels?.[0]?.textContent).toBe(
      "내용",
    );
  });

  it("제목 칸은 머리 아래 12 · 아래 8 — 본문 Scroll Fog 가 없어 위 여백을 칸이 갖는다(bottom-sheet.md)", () => {
    form(null);
    const field = q("[data-slot=field]")!;
    expect(field.className).toContain("pt-x3");
    expect(field.className).toContain("pb-x2");
  });

  it("바닥은 [저장] 하나뿐이다 — 시트에는 [취소] 가 없다", () => {
    form(null);
    const footer = q("[data-slot=bottom-sheet-footer]")!;
    expect(
      Array.from(footer.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["저장"]);
  });

  it("제목이 비면 [저장] 은 켜 둔 채 누를 때 칸 아래 오류를 보인다 — 저장은 나가지 않는다", () => {
    form(null);
    click(byName("저장"));
    expect(document.body.textContent).toContain("제목을 입력해주세요.");
    expect(saved).toHaveLength(0);
  });

  it("새 메모는 태그 없음 · 파랑 · 고정 끔으로 열리고, 저장 본문은 태그 null 이다", () => {
    form(null);
    setValue(q<HTMLInputElement>("input")!, "  새 메모  ");
    click(byName("저장"));
    expect(saved).toEqual([
      {
        values: { title: "새 메모", content: "", tag: null, color: "#2c70bf" },
        id: undefined,
        pinned: false,
      },
    ]);
  });

  it("있는 메모를 열면 지금 값이 그대로 들어 있고, 고정은 저장 인자로 넘어간다", () => {
    form(base);
    expect(q<HTMLInputElement>("input")!.value).toBe("여행 계획");
    click(byName("저장"));
    expect(saved[0]).toEqual({
      values: {
        title: "여행 계획",
        content: "첫 줄\n둘째 줄",
        tag: "여행",
        color: "#b36418",
      },
      id: 7,
      pinned: true,
    });
  });

  it("저장이 실패하면 폼 맨 위 Callout 이 고정 글로 알린다", () => {
    form(base, true);
    const callout = q("[data-slot=callout]");
    expect(callout?.textContent).toBe(
      "저장하지 못했어요. 잠시 뒤 다시 시도해주세요.",
    );
    expect(callout?.getAttribute("data-tone")).toBe("critical");
  });
});

describe("메모 폼 — 기기 뒤로 가기(폰, B3)", () => {
  it("뒤로 가기(popstate)는 바뀐 값이 없으면 폼을 닫는다", async () => {
    form(base);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(closed).toBe(1);
  });
});

describe("메모 폼 — 검수 고침", () => {
  it("저장 실패 Callout 은 화면에 들이도록 scrollIntoView 를 부른다(M2)", () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    form(base, true);
    expect(spy).toHaveBeenCalled();
  });

  it("태그 목록을 못 받았으면 '태그는 설정에서 만들어요' 안내를 하지 않는다(L3)", () => {
    form(null, false, false);
    click(byName("태그, 태그 없음"));
    expect(document.body.textContent).not.toContain("만들어요");
  });

  it("내용은 앞뒤 공백 · 빈 줄 그대로 보낸다 — trim 은 비었는지 판단에만 쓴다(M3)", () => {
    form(base);
    setValue(q<HTMLTextAreaElement>("textarea")!, "  들여쓴 줄\n\n");
    click(byName("저장"));
    expect(saved[0]?.values.content).toBe("  들여쓴 줄\n\n");
  });

  it('내용을 지우면 빈 글 "" 을 보낸다(웹 값 — 앱이 맞춘다)', () => {
    form(base);
    setValue(q<HTMLTextAreaElement>("textarea")!, "");
    click(byName("저장"));
    expect(saved[0]?.values.content).toBe("");
  });

  it("글자 수가 붙고(제목 200 · 내용 10,000) 이모지도 UTF-16 한도를 넘지 않는다(M6)", () => {
    form(null);
    // 글자 수는 내용에만 붙는다(textarea.md) — 제목은 상한 200 만 조용히 둔다
    expect(document.body.textContent).toContain("0/10,000");
    expect(document.body.textContent).not.toContain("/200");
    setValue(q<HTMLTextAreaElement>("textarea")!, "😀".repeat(6000));
    const v = q<HTMLTextAreaElement>("textarea")!.value;
    expect(v.length).toBeLessThanOrEqual(10_000);
  });

  it("수정 폼은 제목에 초점을 주지 않는다 — 새 메모만 첫 칸(L10)", () => {
    form(base);
    expect(document.activeElement).not.toBe(q("input"));
  });
});

describe("메모 상세 (I-15 14)", () => {
  const detail = (memo: Memo, remove = () => Promise.resolve(true)) =>
    act(() =>
      root.render(
        <MemoDetailDialog
          memo={memo}
          remove={remove}
          pin={() => Promise.resolve(true)}
          onClose={() => closed++}
          onEdit={() => {}}
        />,
      ),
    );

  it("상세 본문에도 Scroll Fog 가 켜져 있다(10,000자 본문)", () => {
    detail(base);
    expect(
      q("[data-slot=bottom-sheet-body]")?.getAttribute("data-scroll-fog"),
    ).toBe("overlayBody");
  });

  it("머리 제목이 메모 제목이고 색 히어로 카드 · 테두리 본문 상자가 없다", () => {
    detail(base);
    expect(q("[role=dialog] h2")?.textContent).toBe("여행 계획");
    expect(q("[data-slot=card]")).toBeNull();
  });

  it("메타는 '태그 · 시각 수정 · 고정' 한 줄이고 본문은 줄바꿈 그대로다", () => {
    detail(base);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/여행.*수정.*고정/);
    expect(q("p.whitespace-pre-wrap")?.textContent).toBe("첫 줄\n둘째 줄");
  });

  it("공백만 있는 본문은 '내용 없음' 이다(M3 — trim 은 비었는지 판단에만)", () => {
    detail({ ...base, content: "   \n  " });
    expect(document.body.textContent).toContain("내용 없음");
  });

  it("제목 · 본문이 비면 '제목 없음' · '내용 없음' 이다", () => {
    detail({ ...base, title: "", content: null, isPinned: false });
    expect(q("[role=dialog] h2")?.textContent).toBe("제목 없음");
    expect(document.body.textContent).toContain("내용 없음");
    expect(document.body.textContent).not.toContain("고정");
  });

  it("바닥은 [수정] 하나뿐이고 [삭제] 는 머리 ⋮ 메뉴에 있다", () => {
    detail(base);
    const footer = q("[data-slot=bottom-sheet-footer]")!;
    expect(
      Array.from(footer.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["수정"]);
    expect(byName("여행 계획 더보기")).toBeTruthy();
  });

  it("⋮ 메뉴에서 [삭제] 를 고르면 확인창을 먼저 연다", async () => {
    detail(base);
    click(byName("여행 계획 더보기"));
    const del = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=menuitem]"),
    ).find((e) => e.textContent?.includes("삭제"));
    expect(del, "메뉴 줄 삭제").toBeTruthy();
    await act(async () => del!.click());
    expect(q("[role=alertdialog]")?.textContent).toContain(
      '"여행 계획" 메모를 삭제할까요?',
    );
    expect(q("[role=alertdialog]")?.textContent).toContain(
      "삭제한 메모는 되돌릴 수 없어요.",
    );
  });

  it("⋮ 메뉴 첫 줄은 고정이면 '고정 해제', 아니면 '고정' 이다", () => {
    detail(base);
    click(byName("여행 계획 더보기"));
    const items = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=menuitem]"),
    ).map((e) => e.textContent?.trim());
    expect(items[0]).toBe("고정 해제");
  });

  it("지우지 못하면(false) 상세를 닫지 않는다", async () => {
    detail(base, () => Promise.resolve(false));
    click(byName("여행 계획 더보기"));
    await act(async () =>
      Array.from(document.body.querySelectorAll<HTMLElement>("[role=menuitem]"))
        .find((e) => e.textContent?.includes("삭제"))!
        .click(),
    );
    const confirm = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=alertdialog] button"),
    ).find((b) => b.textContent === "삭제")!;
    await act(async () => confirm.click());
    expect(closed).toBe(0);
  });

  it("확인 뒤 지우면 상세를 닫는다 · 지우지 못하면 닫지 않는다", async () => {
    detail(base, () => Promise.resolve(true));
    click(byName("여행 계획 더보기"));
    await act(async () =>
      Array.from(document.body.querySelectorAll<HTMLElement>("[role=menuitem]"))
        .find((e) => e.textContent?.includes("삭제"))!
        .click(),
    );
    const confirm = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=alertdialog] button"),
    ).find((b) => b.textContent === "삭제")!;
    await act(async () => confirm.click());
    expect(closed).toBe(1);
  });
});
