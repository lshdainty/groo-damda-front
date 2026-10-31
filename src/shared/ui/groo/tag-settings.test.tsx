// 태그 설정 본문 — 메모 태그 · 할 일 태그가 한 부품을 쓴다(I-15 20 ~ 24 · 열린 질문 Q4 B).
//
// 태그를 지우면 서버는 그 태그를 쓰던 항목의 태그만 비운다. 그래서 확인창은 "N건은 태그 없음으로 남아요" 라고 약속하고,
// 그 N 이 실제 사용 수여야 하며 자리표시자가 글자 그대로 새어 나오면 안 된다(QA #104). 확인창으로 가는 길이 둘(밀기 · ⋮ 메뉴 / 수정 폼 [삭제])
// 이라 폼 [삭제] 길을 본다 — 두 길 모두 같은 `askDelete` 상태를 쓴다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { SnackbarProvider } from "@/shared/ds/snackbar";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import koCommon from "@/locales/ko/common.json";
import koMemo from "@/locales/ko/memo.json";
import koTodo from "@/locales/ko/todo.json";
import { TagSettings, type TagLike } from "./tag-settings";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const i18n = i18next.createInstance();
await i18n.use(initReactI18next).init({
  lng: "ko",
  fallbackLng: "ko",
  ns: ["memo", "todo", "common"],
  defaultNS: "common",
  resources: { ko: { memo: koMemo, todo: koTodo, common: koCommon } },
  interpolation: { escapeValue: false },
});

let container: HTMLDivElement;
let root: Root;

const tagOf = (
  rowId: number,
  tagName: string,
  usageCount: number,
): TagLike => ({ rowId, tagName, color: "#2c70bf", usageCount });

const noop = () => Promise.resolve();

const render = (
  ns: "memo" | "todo",
  mobile: boolean,
  tags: TagLike[],
  extra: Partial<Parameters<typeof TagSettings>[0]> = {},
) =>
  act(() =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <SnackbarProvider>
          <TagSettings
            ns={ns}
            mobile={mobile}
            tags={tags}
            loading={false}
            failed={false}
            onRetry={() => {}}
            create={noop}
            update={noop}
            remove={noop}
            {...extra}
          />
        </SnackbarProvider>
      </I18nextProvider>,
    ),
  );

const screenText = () => document.body.textContent ?? "";
const buttonByText = (text: string) =>
  Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
const openRow = (name: string) => {
  const row = Array.from(
    container.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
  ).find((b) => b.textContent?.includes(name))!;
  act(() => row.click());
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  __resetPointerBlockForTest();
});

describe.each([
  ["memo", "메모", "메모 태그"],
  ["todo", "할 일", "할 일 태그"],
] as const)("TagSettings — %s", (ns, noun, title) => {
  it("서버가 준 태그와 사용 수를 그린다", () => {
    render(ns, true, [tagOf(1, "회의록", 3), tagOf(2, "아이디어", 0)]);
    const text = screenText();
    expect(text).toContain("회의록");
    expect(text).toContain("3건에 사용 중");
    expect(text).toContain("0건에 사용 중");
  });

  it("폰 — 안내 Callout(제목 없음) · 목록 제목 h2 + 글 버튼 · 색 타일 줄 · 줄 사이 선과 카드가 없다", () => {
    render(ns, true, [
      tagOf(1, "장기프로젝트자료모으기정", 0),
      tagOf(2, "공부", 4),
    ]);
    const callout = container.querySelector("[data-slot=callout]");
    expect(callout?.getAttribute("data-tone")).toBe("informative");
    expect(callout?.textContent).toContain("태그 없음");
    expect(container.querySelector("h2")?.textContent).toBe(`${title} · 2`);
    expect(buttonByText("태그 추가")).toBeTruthy();
    expect(container.querySelectorAll("[data-slot=list-tile]").length).toBe(2);
    expect(container.querySelector("[data-slot=divider]")).toBeNull();
    expect(container.querySelector("[data-slot=card]")).toBeNull();
    // 줄 끝 ⋮ 는 없다(좁은 목록 줄) · 이름은 말줄임 없이 줄바꿈
    expect(container.querySelector('button[aria-label$="더보기"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/text-ellipsis|truncate/);
  });

  it("데스크톱 — 안내 상자 없이 카드 하나, 줄 끝 ⋮ · 휴지통 · 꺾쇠가 없다(list.md 줄 끝 ⋮ 금지 — 줄 → 수정 폼 → [삭제])", () => {
    render(ns, false, [tagOf(1, "회의록", 3)]);
    expect(container.querySelector("[data-slot=callout]")).toBeNull();
    expect(container.querySelector("[data-slot=card]")).toBeTruthy();
    expect(container.querySelector('button[aria-label$="더보기"]')).toBeNull();
    expect(container.querySelector('button[aria-label="삭제"]')).toBeNull();
    // 대체 길 — 줄을 누르면 수정 폼, 폼 바닥에 [삭제]
    openRow("회의록");
    expect(buttonByText("삭제")).toBeTruthy();
  });

  it("태그가 없으면 첫 태그를 만들라고 안내한다 — 빈 화면으로 두지 않는다", () => {
    render(ns, true, []);
    const rs = container.querySelector("[data-slot=result-section]");
    expect(rs?.textContent).toContain("태그가 없어요");
    expect(rs?.querySelector("button")).toBeNull();
  });

  it("불러오지 못하면 Result Section 실패 + 다시 시도 — 서버 글을 그리지 않는다", () => {
    const onRetry = vi.fn();
    render(ns, true, [], { failed: true, onRetry });
    expect(screenText()).toContain("태그를 불러오지 못했어요");
    act(() => buttonByText("다시 시도")!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it(`수정 폼 [삭제] → 확인창이 실제 사용 수와 '태그 없음' 을 말한다 (${noun})`, () => {
    render(ns, true, [tagOf(1, "운동", 3)]);
    openRow("운동");
    const del = buttonByText("삭제")!;
    expect(del.className).toContain("text-fg-critical");
    // 시트 바닥 [삭제] 는 주 버튼과 같은 large 48(글자만큼 폭) — small 이 아니다(I-15 215)
    expect(del.className).toContain("min-h-[48px]");
    // 본문 끝에 따로 여백을 두지 않는다 — 바닥 위 12 는 바닥이 갖는다
    expect(
      document.body.querySelector("[data-slot=bottom-sheet-body] > div")
        ?.className,
    ).not.toContain("pb-x2");
    act(() => del.click());
    expect(document.body.querySelector("[role=alertdialog]")).toBeTruthy();
    const text = screenText();
    expect(text).toContain('"운동" 태그를 삭제하면');
    expect(text).toContain(`${noun} 3건은 태그 없음으로 남아요`);
    expect(text).not.toContain("{{count}}");
    expect(text).not.toContain("{{name}}");
  });

  it("사용 수 0 도 숫자로 말한다", () => {
    render(ns, true, [tagOf(1, "아이디어", 0)]);
    openRow("아이디어");
    act(() => buttonByText("삭제")!.click());
    expect(screenText()).toContain(`${noun} 0건은 태그 없음으로 남아요`);
  });

  it("태그 폼 본문에는 Scroll Fog 를 걸지 않는다(칸 두셋 — 늘 들어맞는 본문)", () => {
    render(ns, true, [tagOf(1, "운동", 3)]);
    openRow("운동");
    const body = document.body.querySelector(
      "[data-slot=bottom-sheet-body], [data-slot=dialog-body]",
    )!;
    expect(body.getAttribute("data-scroll-fog")).toBeNull();
  });

  it("새 태그 폼에는 [삭제] 가 없다", () => {
    render(ns, true, []);
    act(() => buttonByText("태그 추가")!.click());
    expect(buttonByText("삭제")).toBeFalsy();
  });

  it("삭제가 실패하면 확인창을 닫고 스낵바 + 다시 시도로 알린다 — 서버 글은 없다", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("서버 원문"));
    render(ns, true, [tagOf(1, "운동", 3)], { remove });
    openRow("운동");
    act(() => buttonByText("삭제")!.click());
    const confirm = Array.from(
      document.body.querySelectorAll<HTMLElement>("[role=alertdialog] button"),
    ).find((b) => b.textContent === "삭제")!;
    await act(async () => confirm.click());
    expect(document.body.querySelector("[role=alertdialog]")).toBeNull();
    expect(screenText()).toContain("삭제하지 못했어요");
    expect(screenText()).toContain("다시 시도");
    expect(screenText()).not.toContain("서버 원문");
  });

  it("저장이 실패하면 폼이 열린 채 위 Callout 으로 알린다", async () => {
    const create = vi.fn().mockRejectedValue(new Error("서버 원문"));
    render(ns, true, [], { create });
    act(() => buttonByText("태그 추가")!.click());
    const input = document.body.querySelector<HTMLInputElement>("input")!;
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      set.call(input, "새 태그");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    await act(async () => buttonByText("저장")!.click());
    // 실패 Callout 을 화면에 들인다(M2)
    expect(spy).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      tagName: "새 태그",
      color: expect.stringMatching(/^#/),
    });
    expect(screenText()).toContain("저장하지 못했어요");
    expect(screenText()).not.toContain("서버 원문");
    expect(document.body.querySelector("input")).toBeTruthy();
  });
});
