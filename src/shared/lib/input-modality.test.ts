import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import {
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
