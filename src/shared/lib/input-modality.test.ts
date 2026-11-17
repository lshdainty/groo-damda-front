import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import {
  isKeyboardFocus,
  resetInputModalityForTest,
  trackInputModality,
} from "./input-modality";

// 초점 링은 키보드로 왔을 때만 — 스크립트가 옮긴 초점도 직전 입력이 포인터면 그리지 않는다(DESIGN.md 초점 링 · DW 공통 5)

afterEach(() => resetInputModalityForTest());

const root = () => document.documentElement;
const keydown = (init: KeyboardEventInit) =>
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, ...init }),
  );
const pointerdown = () =>
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));

describe("trackInputModality — <html data-input>", () => {
  it("처음에는 적지 않는다(링을 막지 않는다)", () => {
    trackInputModality();
    expect(root().dataset.input).toBeUndefined();
  });

  it("손가락 · 마우스로 누르면 pointer, 키를 누르면 keyboard", () => {
    trackInputModality();
    pointerdown();
    expect(root().dataset.input).toBe("pointer");
    keydown({ key: "Tab" });
    expect(root().dataset.input).toBe("keyboard");
    pointerdown();
    expect(root().dataset.input).toBe("pointer");
  });

  it("단축키(⌘ · Ctrl · Alt 조합)는 키보드로 세지 않는다", () => {
    trackInputModality();
    pointerdown();
    keydown({ key: "c", metaKey: true });
    keydown({ key: "r", ctrlKey: true });
    keydown({ key: "Tab", altKey: true });
    expect(root().dataset.input).toBe("pointer");
  });

  it("다른 처리보다 먼저 — 잡는 단계에서 바뀐다(누름이 초점을 옮기는 처리 안에서 이미 pointer)", () => {
    trackInputModality();
    keydown({ key: "Tab" });
    let seen: string | undefined;
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.addEventListener("pointerdown", () => {
      seen = root().dataset.input;
    });
    btn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(seen).toBe("pointer");
    btn.remove();
  });
});

describe("index.css — focus-visible 변형", () => {
  const css = readFileSync("src/index.css", "utf-8");

  it("focus-visible 변형이 직전 입력이 포인터면 빠진다 — 글을 넣는 칸은 브라우저 그대로", () => {
    expect(css).toContain(
      '@custom-variant focus-visible (&:focus-visible:not(:where(:root[data-input="pointer"] *:not(input, textarea, select, [contenteditable]))));',
    );
  });

  it("전역 링도 같은 변형을 쓴다(맨 :focus-visible 규칙이 남지 않는다)", () => {
    expect(css).toMatch(/\*\s*\{\s*@variant focus-visible \{/);
    expect(css).not.toMatch(/^\s*:focus-visible\s*\{/m);
  });
});

describe("index.css — 브라우저 기본 링도 포인터 뒤에는 그리지 않는다", () => {
  // 2026-11-17 QA(iPhone Safari 26) — 손가락으로 하단 탭을 누르면 셸이 제목(tabindex -1)에 초점을 두고 Safari 가 그것을
  // :focus-visible 로 잡아 브라우저 기본 링(outline auto 연파랑)이 보였다. 전역 링만 빠지고 기본 링은 남았던 것.
  const css = readFileSync("src/index.css", "utf-8");
  const rule =
    /(:where\(:root\[data-input="pointer"\]\)\s*:where\(:focus-visible[^{]*)\{([^}]*)\}/.exec(
      css,
    );

  it("규칙이 있고 outline 을 없앤다", () => {
    expect(rule).not.toBeNull();
    expect(rule![2]!.trim()).toBe("outline: none;");
  });

  // jsdom 은 :focus-visible 판단을 마지막 이벤트로 흉내 내 흔들린다 — :focus 로 바꿔 우리가 더한 조건(직전 입력 · 칸 종류)만 본다
  const selector = () =>
    rule![1]!
      .trim()
      .replace(/\s+/g, " ")
      .replace(/:focus-visible/g, ":focus");

  function focusFresh(html: string) {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const el = host.firstElementChild as HTMLElement;
    el.focus();
    return { el, done: () => host.remove() };
  }

  it("손가락으로 탭을 누른 뒤 프로그램 초점이 간 제목(tabindex -1) — 기본 링을 걷는다", () => {
    trackInputModality();
    keydown({ key: "Tab" });
    pointerdown();
    const { el, done } = focusFresh('<h1 tabindex="-1">가계부</h1>');
    expect(document.activeElement).toBe(el);
    expect(el.matches(selector())).toBe(true);
    done();
  });

  it("키보드로 왔으면 걷지 않는다(전역 링이 그린다) · 아직 입력이 없어도 걷지 않는다", () => {
    trackInputModality();
    const first = focusFresh('<h1 tabindex="-1">가계부</h1>');
    expect(first.el.matches(selector())).toBe(false);
    first.done();
    keydown({ key: "Tab" });
    const { el, done } = focusFresh('<h1 tabindex="-1">가계부</h1>');
    expect(el.matches(selector())).toBe(false);
    done();
  });

  it.each([
    '<input aria-label="금액" />',
    '<textarea aria-label="메모"></textarea>',
    '<select aria-label="통화"><option>KRW</option></select>',
    '<div contenteditable="true" tabindex="0">메모</div>',
  ])("글을 넣는 칸은 브라우저 그대로 둔다 — %s", (html) => {
    trackInputModality();
    pointerdown();
    const { el, done } = focusFresh(html);
    expect(document.activeElement).toBe(el);
    expect(el.matches(selector())).toBe(false);
    done();
  });
});

describe("isKeyboardFocus — 초점 링과 같은 조건을 JS 에서", () => {
  const focusVisible = (el: Element, on: boolean) => {
    const matches = Element.prototype.matches;
    el.matches = (selector: string) =>
      selector === ":focus-visible" ? on : matches.call(el, selector);
  };

  it(":focus-visible 이 아니면 아니다", () => {
    const btn = document.createElement("button");
    focusVisible(btn, false);
    expect(isKeyboardFocus(btn)).toBe(false);
  });

  it(":focus-visible 이어도 직전 입력이 포인터면 아니다 — 키보드 · 아직 입력 없음이면 맞다", () => {
    const btn = document.createElement("button");
    focusVisible(btn, true);
    expect(isKeyboardFocus(btn)).toBe(true);
    root().dataset.input = "pointer";
    expect(isKeyboardFocus(btn)).toBe(false);
    root().dataset.input = "keyboard";
    expect(isKeyboardFocus(btn)).toBe(true);
  });

  it("글을 넣는 칸은 링처럼 그대로 둔다(직전 입력이 포인터여도)", () => {
    const input = document.createElement("input");
    focusVisible(input, true);
    root().dataset.input = "pointer";
    expect(isKeyboardFocus(input)).toBe(true);
  });
});
