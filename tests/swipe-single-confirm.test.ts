import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * 스와이프 삭제는 **한 번만** 묻는다(QA 30 15).
 *
 * `SwipeActions` 는 destructive 액션에 `confirm` 을 타입으로 강제하고, 확인을 받은 뒤에야
 * `onSelect` 를 부른다. 그런데 할 일 태그·메모 태그·일정 라벨·프리셋·저축 목표 다섯 화면이
 * `onSelect` 에서 자기 확인창(`setConfirmDelete`)을 또 열어 같은 질문을 두 번 했다.
 * 스와이프의 `onSelect` 는 확인이 끝난 뒤이므로 바로 지운다. 데스크톱 삭제 버튼은 자기
 * 확인창을 그대로 쓴다.
 *
 * 이 규칙은 **옛 `@/shared/ui/swipe-actions`(스스로 묻는다)** 를 쓰는 파일에만 해당한다. ds `SwipeActions`
 * (`@/shared/ds/swipe-actions`)는 묻지 않는다 — destructive 는 **부르는 쪽이** 확인창을 연다(swipe-actions.tsx 의
 * SwipeAction.onSelect 주석). 그래서 ds 로 옮긴 화면의 `setConfirmDelete(...)` 는 한 번 묻는 올바른 길이다.
 */
const files = execSync('git grep -l "kind: \\"destructive\\"" -- src', {
  encoding: "utf-8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) =>
    readFileSync(f, "utf-8").includes('from "@/shared/ui/swipe-actions"'),
  );

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
  it("destructive 액션의 onSelect 가 확인창을 다시 열지 않는다", () => {
    const offenders = files.flatMap((f) =>
      destructiveOnSelects(readFileSync(f, "utf-8"))
        .filter((line) => /set\w*Confirm\w*\(/.test(line))
        .map((line) => `${f}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it("저축 목표 · 예산 스와이프는 화면의 ds 확인창을 연다(confirm: false)", () => {
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
