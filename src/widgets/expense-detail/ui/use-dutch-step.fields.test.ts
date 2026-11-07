// 더치페이 참여자 줄의 편집 칸 — 큰 글자에서 이름을 한 글자 폭으로 누르지 않는다(I-wrap-b5 2-b B).
// 컨테이너 쿼리는 jsdom 이 재지 못한다 — 실제 폭(390 · 200%)은 렌더 하네스가 맡고, 여기서는 그 결과를 만드는 클래스 계약만 잠근다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(cwd(), "src/widgets/expense-detail/ui/use-dutch-step.tsx"),
  "utf8",
);

describe("더치페이 참여자 줄 편집 칸", () => {
  it("칸 폭은 px 다 — rem 클래스(w-24 · w-32)는 글자 배율을 따라 커져 이름을 눌렀다", () => {
    expect(src).not.toMatch(/rootClassName="w-(24|32)"/);
    expect(src).toContain('RATIO_FIELD = "w-[96px] ');
    expect(src).toContain('CUSTOM_FIELD = "w-[172px] ');
  });

  it("직접 입력 칸은 172 — 9,999,999,999원(한 사람 몫 최대)이 보통 글자에서 안 잘리는 실측 폭이고, 문턱은 긴 이름(본문 절반)에서도 칸이 줄 안에 남는 446px 다", () => {
    expect(src).toContain(
      'CUSTOM_FIELD = "w-[172px] @max-[446px]/list-item:w-full"',
    );
    expect(src).toContain(
      "@max-[446px]/list-item:[&_[data-slot=list-suffix]:has(input)]:col-start-3!",
    );
    expect(src).toContain('method === "CUSTOM" ? FIELD_ROW_CUSTOM : FIELD_ROW');
    // 문턱이 List 자체(16rem + 48px)보다 넓으므로 격자도 이 줄에서 직접 건다
    expect(src).toContain(
      "@max-[446px]/list-item:[&_[data-slot=list-content]]:grid-cols-[auto_auto_minmax(0,1fr)_auto]",
    );
  });

  it("줄 안 폭이 16rem + 48px 보다 좁으면 칸이 본문 아래(3열 · 2행) 전폭으로 내려간다 — List 의 narrow 문턱과 같다", () => {
    const narrow = "@max-[calc(16rem+48px)]/list-item";
    expect(src).toContain(`${narrow}:w-full`);
    expect(src).toContain(
      `${narrow}:[&_[data-slot=list-suffix]:has(input)]:col-start-3!`,
    );
    expect(src).toContain(
      `${narrow}:[&_[data-slot=list-suffix]:has(input)]:row-start-2!`,
    );
  });
});
