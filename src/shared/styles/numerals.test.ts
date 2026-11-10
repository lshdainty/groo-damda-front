// 숫자는 고정폭(tabular-nums)만 — 자간 · font-feature-settings(cv01 · ss03)는 웹에서 걷었다(결정 9C, 2026-11-10). 앱과 같은 폭.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) =>
  readFileSync(new URL(f, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

describe("숫자 글꼴 설정(9C)", () => {
  it(".num 은 tabular-nums 만 — 자간 · 글꼴 옵션 없음", () => {
    const css = read("./groo.css");
    const block = css.match(/\n\.num\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(block).toContain("font-variant-numeric: tabular-nums");
    expect(block).not.toMatch(/letter-spacing|font-feature-settings/);
  });
  it("본문에 cv01 · ss03 을 켜지 않는다", () => {
    const css = read("../../index.css");
    expect(css).not.toMatch(/cv01|ss03/);
  });
});
