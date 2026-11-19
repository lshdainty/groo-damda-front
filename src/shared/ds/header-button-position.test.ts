// 머리 단추(닫기 · ⋮ · ←)는 제목 첫 줄 가운데에 선다 — 대화상자 · 시트 · 팝오버 · 도움말(groo-design #263 — dialog · bottom-sheet ·
// popover · help-bubble yaml 의 close 비고). 단추 · 아이콘은 px 그대로이고, 글자를 키워 제목 줄이 높아지면 그 절반만큼 따라 내려간다.
// jsdom 은 calc 를 풀지 않으므로 클래스의 top · mt 식을 브라우저가 푸는 셈으로 푼다 — 여백 토큰은 px, 글 줄 높이 · rem 은 글자 배율을
// 따른다. 300%(처음부터 · 뜬 뒤 모두 같은 식이다 — CSS 는 배율이 바뀌면 바로 다시 푼다)에서 단추 가운데와 제목 첫 줄 가운데의 거리가
// 100% 와 같고, 100% 에서는 예전 자리(px)와 같은지 본다.
import { describe, expect, it } from "vitest";

import {
  SHEET_BACK,
  SHEET_CLOSE,
  SHEET_HEADER_ACTION,
} from "./bottom-sheet/bottom-sheet-variants";
import {
  DIALOG_BACK,
  DIALOG_CLOSE,
  DIALOG_HEADER_ACTION,
  DIALOG_HEADER_ACTION_CLOSE,
} from "./dialog/dialog-variants";
import { BUBBLE_CLOSE } from "./help-bubble/help-bubble-variants";
import { POPOVER_CLOSE } from "./popover/popover-variants";

/** 글 줄 높이(px, 100%) — groo-tokens.css 의 --text-tN--line-height(rem) × 16 */
const LINE: Record<string, number> = { t3: 18, t7: 27, t8: 30 };
/** 여백 토큰(px — 글자 배율을 따르지 않는다) */
const SPACING: Record<string, number> = { x6: 24, x7: 28 };

/** 클래스에서 변형 없는 [prop]-[…] 의 값을 브라우저처럼 푼다(px) */
function solve(cls: string, prop: "top" | "mt", scale: number): number {
  const m = cls.match(new RegExp(`(?:^|\\s)${prop}-\\[([^\\s]+)\\]`));
  if (!m) throw new Error(`${prop} 값이 없다: ${cls}`);
  const expr = m[1]!
    .replace(/_/g, " ")
    .replace(/^calc\((.*)\)$/, "$1")
    .replace(/var\(--spacing-(\w+)\)/g, (_, k: string) => String(SPACING[k]))
    .replace(
      /var\(--text-(t\d+)--line-height\)/g,
      (_, k: string) => `(${LINE[k]! * scale})`,
    )
    .replace(/([\d.]+)rem/g, (_, n: string) => `(${Number(n) * 16 * scale})`)
    .replace(/([\d.]+)px/g, "$1");
  if (!/^[\d\s.+\-*/()]+$/.test(expr)) throw new Error(`풀 수 없다: ${expr}`);
  return Function(`return (${expr});`)() as number;
}

/** 머리 단추 가운데(px) — 상자 위 + 상자 반, -translate-y-1/2 면 top 이 곧 가운데 */
type Probe = { name: string; center: (scale: number) => number; at100: number };
const box = (cls: string, size: number) =>
  /(?:^|\s)-translate-y-1\/2(?=\s|$)/.test(cls)
    ? (s: number) => solve(cls, "top", s)
    : (s: number) => solve(cls, "top", s) + size / 2;

/** 제목 첫 줄 가운데 = 위 여백 24 + 제목 줄 높이 ÷ 2 */
const titleCenter = (token: string, top: number) => (scale: number) =>
  top + (LINE[token]! * scale) / 2;

const cases: (Probe & { title: (scale: number) => number })[] = [
  // 대화상자 — 제목 t8, 머리 위 24. 닫기는 52 상자(아이콘 위 28), ⋮ · ← 는 -translate-y-1/2 로 가운데 39
  {
    name: "대화상자 닫기",
    center: box(DIALOG_CLOSE, 52),
    at100: 39,
    title: titleCenter("t8", 24),
  },
  {
    name: "대화상자 ⋮(닫기 있음)",
    center: box(DIALOG_HEADER_ACTION_CLOSE, 0),
    at100: 39,
    title: titleCenter("t8", 24),
  },
  {
    name: "대화상자 ⋮(닫기 없음)",
    center: box(DIALOG_HEADER_ACTION, 0),
    at100: 39,
    title: titleCenter("t8", 24),
  },
  {
    name: "대화상자 ←",
    center: box(DIALOG_BACK, 40),
    at100: 39,
    title: titleCenter("t8", 24),
  },
  // 시트 — 제목 t8, 머리 위 24. 닫기 원 28 은 위 24(가운데 38 — 제목 가운데 39 보다 1 위, bottom-sheet.yaml), ⋮ 은 닫기 원 가운데
  {
    name: "시트 닫기",
    center: box(SHEET_CLOSE, 28),
    at100: 38,
    title: titleCenter("t8", 24),
  },
  {
    name: "시트 ⋮",
    center: box(SHEET_HEADER_ACTION, 0),
    at100: 38,
    title: titleCenter("t8", 24),
  },
  {
    name: "시트 ←",
    center: box(SHEET_BACK, 40),
    at100: 39,
    title: titleCenter("t8", 24),
  },
  // 팝오버 — 제목 t7, 위 24. 닫기 52 상자 위 12(아이콘 위 27 · 가운데 38)
  {
    name: "팝오버 닫기",
    center: box(POPOVER_CLOSE, 52),
    at100: 38,
    title: titleCenter("t7", 24),
  },
  // 도움말 — 제목 t3 이 말풍선 안 여백 위에서 시작한다(0 을 기준으로 잰다). 닫기 38 상자는 mt (줄 높이 − 38) ÷ 2
  {
    name: "도움말 닫기",
    center: (s) => solve(BUBBLE_CLOSE, "mt", s) + 19,
    at100: 9,
    title: titleCenter("t3", 0),
  },
];

describe("머리 단추는 제목 첫 줄 가운데에 선다", () => {
  it.each(cases)("$name — 100% 에서는 예전 자리 그대로", (c) => {
    expect(c.center(1)).toBe(c.at100);
  });

  it.each(cases)(
    "$name — 300% 에서 제목 첫 줄 가운데와의 거리가 100% 와 같다(단추는 커지지 않고 따라 내려간다)",
    (c) => {
      const gap100 = c.center(1) - c.title(1);
      for (const scale of [1.5, 2, 3]) {
        expect(c.center(scale) - c.title(scale)).toBeCloseTo(gap100, 5);
      }
      // 따라 내려간다 — px 로 박혀 있으면 300% 에서 제목 가운데보다 위에 남는다
      expect(c.center(3)).toBeGreaterThan(c.center(1));
    },
  );

  it("대화상자 · 팝오버 · 도움말 · 시트 ← 는 300% 에서도 제목 첫 줄 가운데와 같다(0.5 이하)", () => {
    for (const c of cases.filter((x) => !x.name.startsWith("시트 닫기"))) {
      if (c.name === "시트 ⋮") continue;
      expect(Math.abs(c.center(3) - c.title(3))).toBeLessThanOrEqual(0.5);
    }
  });
});
