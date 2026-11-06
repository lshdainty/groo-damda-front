import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 스와이프 삭제는 **한 번만** 묻는다(QA 30 15).
 *
 * 옛 `SwipeActions`(`@/shared/ui/swipe-actions`)는 destructive 에 스스로 확인을 묻고 `onSelect` 를 불러서, 자기 확인창을 또 여는
 * 화면이 같은 질문을 두 번 했다. 옛 부품은 I-wrap-b1 δ 에서 지웠다 — ds `SwipeActions`(`@/shared/ds/swipe-actions`)는 묻지 않고
 * destructive 는 **부르는 쪽이** 확인창을 하나 연다. 저축 목표 · 예산은 그 확인창을 여는 `onDelete` 를 부른다.
 */

/** destructive 액션 블록 — `kind: "destructive"` 부터 그 액션의 `onSelect` 줄까지. */
function destructiveOnSelects(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('kind: "destructive"');
  while (i >= 0) {
    const on = src.indexOf("onSelect:", i);
    if (on < 0) break;
    out.push(src.slice(on, src.indexOf("\n", on)));
    i = src.indexOf('kind: "destructive"', on);
  }
  return out;
}

describe("스와이프 삭제 확인은 한 번", () => {
  it("옛 밀기 부품은 없다 — 밀기는 ds 하나뿐이다", () => {
    expect(existsSync("src/shared/ui/swipe-actions.tsx")).toBe(false);
    expect(existsSync("src/shared/ui/swipe-actions-geometry.ts")).toBe(false);
  });

  it("저축 목표 · 예산 스와이프는 화면의 ds 확인창을 연다", () => {
    const src = readFileSync(
      "src/widgets/asset-full/ui/SavingGoalManager.tsx",
      "utf-8",
    );
    expect(destructiveOnSelects(src)).toEqual([
      "onSelect: () => onDelete(goal),",
    ]);
    const budget = readFileSync(
      "src/widgets/budget-manage/ui/BudgetManager.tsx",
      "utf-8",
    );
    expect(destructiveOnSelects(budget)).toEqual([
      "onSelect: () => onDelete(b),",
    ]);
  });
});
