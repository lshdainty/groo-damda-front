// 메모 줄(I-15 9) — 제목은 줄바꿈(말줄임 없음), 메타는 Tag Group 한 줄, 빈 시각 조각 없음, 고정 표시 · 줄 사이 선 · 줄 끝 ⋮ 없음.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import koMemo from "@/locales/ko/memo.json";
import type { Memo } from "@/entities/memo";
import { MemoRow } from "./MemoRow";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const i18n = i18next.createInstance();
await i18n.use(initReactI18next).init({
  lng: "ko",
  ns: ["memo"],
  defaultNS: "memo",
  resources: { ko: { memo: koMemo } },
  interpolation: { escapeValue: false },
});

const memo = (o: Partial<Memo> = {}): Memo => ({
  rowId: 1,
  title:
    "아주 긴 제목이 목록 칸에서 줄을 바꿔 모두 보이는지 보는 메모 제목입니다 정말 깁니다",
  content: "본문 한 줄",
  tag: null,
  color: "#2c70bf",
  isPinned: true,
  createAt: "2026-10-01T00:00:00",
  modifyAt: "",
  ...o,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = (m: Memo) =>
  act(() =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <ul>
          <MemoRow memo={m} onOpen={() => {}} />
        </ul>
      </I18nextProvider>,
    ),
  );

describe("MemoRow", () => {
  it("제목은 말줄임 없이 줄바꿈이고 위 맞춤이다", () => {
    render(memo());
    const title = container.querySelector("[data-slot=list-title]")!;
    expect(title.textContent).toContain("정말 깁니다");
    expect(title.className).not.toMatch(/truncate|ellipsis/);
  });

  it("메타는 '태그 없음' 으로 시작하고 시각이 비면 끝에 ' ·' 가 남지 않는다", () => {
    render(memo());
    const meta = container.querySelector("[data-slot=tag-group]")!;
    expect(meta.textContent?.trim()).toBe("태그 없음");
  });

  it("제목이 없으면 '제목 없음', 본문이 없으면 본문 줄을 두지 않는다", () => {
    render(memo({ title: "", content: null }));
    expect(container.querySelector("[data-slot=list-title]")?.textContent).toBe(
      "제목 없음",
    );
    expect(container.querySelector("[data-slot=memo-body]")).toBeNull();
  });

  it("줄 안 고정 표시 · 줄 끝 ⋮ · 줄 사이 선이 없다", () => {
    render(memo());
    expect(container.querySelector("svg.lucide-pin")).toBeNull();
    expect(container.querySelector('button[aria-label$="더보기"]')).toBeNull();
    expect(container.querySelector("[data-slot=list-divider]")).toBeNull();
  });
});
