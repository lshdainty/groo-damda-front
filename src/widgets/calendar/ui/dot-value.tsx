import type { ReactNode } from "react";

/**
 * 색 점 + 이름 값 (캘린더 · 라벨 줄) — 일정 상세 · 일정 폼 줄이 같은 부품을 쓴다.
 * 점은 **글 흐름 안**에서 첫 글자 바로 앞에 붙는다(사이 6, 크기 8). 덩어리 왼쪽 끝이나 세로 가운데에 두지 않는다 — 그래서 오른쪽 맞춤 줄에서 점이 첫 줄 글과
 * 함께 움직이고, 이름이 여러 줄이어도 첫 줄에서 점 + 첫 글자가 같이 서며 둘째 줄부터는 글만 줄 끝에 맞는다. 점이 글 안이라 첫 줄 높이는 저절로 맞는다.
 * 점과 첫 글자 사이에서 줄이 바뀌지 않게 둘을 한 덩어리(nowrap)로 묶는다.
 */
export function DotValue({
  color,
  children,
}: {
  color?: string;
  children: ReactNode;
}) {
  const dot = color && (
    <span
      aria-hidden
      data-slot="dot-value-dot"
      className="mr-x1_5 inline-block size-[8px] rounded-full align-middle"
      style={{ background: color }}
    />
  );
  if (typeof children !== "string" || children === "")
    return (
      <span>
        {dot}
        {children}
      </span>
    );
  const [first, ...rest] = Array.from(children);
  return (
    <span>
      <span className="whitespace-nowrap">
        {dot}
        {first}
      </span>
      {rest.join("")}
    </span>
  );
}
