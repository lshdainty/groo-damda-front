// 띠 화면의 시작 · 끝 틈 없음(I-05 74 · 스펙 DESIGN Layout "화면 바탕") — 머리 바로 아래 첫 띠 위 틈 0,
// 마지막 띠 아래 틈 0, 띠 사이 8(spacing-x2)만 남는다. 셸의 띠 하나(strip)와 풀스크린 본문 띠도 같다.
// jsdom 은 CSS 파일을 적용하지 않아 스타일 글을 읽어 본다(실제 계산 값은 렌더 측정이 맡는다).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(path.join(__dirname, "..", file), "utf8");

// 주석을 걷고 선택자 하나의 선언 블록을 돌려준다
function rule(css: string, selector: string): string {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const start = body.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`규칙 없음: ${selector}`);
  return body.slice(start, body.indexOf("}", start) + 1);
}

describe("띠 화면 시작 · 끝 틈", () => {
  const css = read("src/shared/styles/groo.css");

  it(".screen-bands 는 띠 사이 8 만 두고 맨 위 padding 이 없다", () => {
    const r = rule(css, ".screen-bands");
    expect(r).toContain("gap: var(--spacing-x2)");
    expect(r).not.toMatch(/padding/);
  });

  it("마지막 띠 아래 padding · margin 이 없다", () => {
    const bands = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .filter((b) => /\.screen-bands/.test(b.split("{")[0]));
    for (const b of bands) {
      expect(b).not.toMatch(/margin-(top|bottom)|padding-bottom/);
    }
  });

  it("셸의 띠 하나(strip)는 위 8 을 두지 않는다", () => {
    const layout = read("src/widgets/layout/ui/AppLayout.tsx");
    expect(layout).toContain('floor === "strip" && "bg-bg-layer-default"');
    expect(layout).not.toMatch(/mt-x2/);
  });
});
