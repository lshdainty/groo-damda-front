import type { ReactNode } from "react";
import { Separator } from "@/shared/ui/separator";

/**
 * 반반 액션 바 — 무게가 같은 액션 **둘**을 한 묶음으로 보여야 할 때
 * (내역 분할의 `항목 추가` · `균등 분배`). spec button.md Layout > Split bar.
 *
 * 본문 폭을 꽉 채운 **얇은 네모 바**를 반으로 갈라 각 칸에 `ghost` 버튼 하나씩 둔다.
 * 모서리는 컨테이너가 깎으므로 버튼 쪽 radius 를 지운다.
 *
 * **구분선은 글자 높이만큼만** 긋는다. 바 위아래 끝까지 그으면 두 칸이 벽으로 막힌 것처럼
 * 답답해 보인다 — 여백을 남겨야 "한 바 안의 두 칸" 으로 읽힌다. 칸의 `border-left` 로는
 * 높이를 못 줄이므로 사이에 `Separator` 를 세운다.
 *
 * **얇게(sm 32) 둔다** — 목록에 줄을 더하는 성격이라 본문 행보다 무거우면 안 된다.
 * 화면의 주 액션은 footer 에 따로 있다.
 *
 * **pill 로 만들지 마라.** 선택 컨트롤(`ToggleGroup variant="segmented"`)과 갈리는 건
 * 눌린 상태가 없다는 점 하나뿐이라, 생김새까지 같아지면 단서가 사라진다.
 *
 * 칸은 **둘뿐이다** — 그 이상은 그냥 나란히(gap 8) 두거나 DropdownMenu 로 접는다.
 */
export function SplitActions({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div
      className={[
        "flex w-full items-center overflow-hidden rounded-[var(--radius-r2)]",
        "border border-stroke-neutral-weak bg-[var(--bg-canvas)]",
        "[&>button]:flex-1 [&>button]:rounded-none",
      ].join(" ")}
    >
      {left}
      <Separator orientation="vertical" className="h-[var(--text-t2)]" />
      {right}
    </div>
  );
}
