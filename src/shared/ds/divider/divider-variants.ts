import { cva } from "class-variance-authority";

/*
 * Groo Divider — 구조는 SEED Divider(2026-10-03). 수치 원본은 groo-design
 * specs/components/divider.yaml(값은 src/shared/ds/spec/divider.json).
 * groo-design recipes/shadcn/components/ui/divider.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 이 파일은 변형 정의,
 * 컴포넌트는 divider.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 *   Divider   내용 사이를 나누는 1px 선 — <hr> 이 아니라 <div> 로 그린다
 *
 *   orientation  horizontal(기본) — 세로로 쌓인 내용 사이. 부모 폭, 높이 1
 *                vertical — 가로로 놓인 칸 사이(통계 세 칸 · 버튼 묶음). 폭 1, 높이는 부모가 정한다 — flex 안에서 늘어나고
 *                (align-self stretch), 부모에 높이가 없으면 선이 0 이 된다
 *   inset        false(기본) — 끝까지. 묶음 사이 · 액션 영역(바닥 버튼) 위 · 스크롤되는 본문 위 머리
 *                true — 양끝 16 들임(세로선은 위아래 16). 같은 묶음 안 — 상세의 키-값 줄 묶음 · 카드 안 위아래
 *   decorative   true(기본) — 장식, aria-hidden(묶음은 제목 · 목록 · section 이 알린다)
 *                false — role="separator" + aria-orientation. 문서의 장처럼 보조 기술도 "구분선" 을 알아야 할 자리만
 *
 * 선은 하나다 — 1px stroke-neutral-subtle(흰 바탕 1.15 · 다크 1.30, SEED 기본 선과 같은 진하기). 굵은 선 · 짙은 선 · 점선 ·
 * 자리마다 다른 색을 두지 않는다 — 더 세게 나눠야 하면 선이 아니라 간격이다(회색 바탕 bg-layer-basement 위에 흰 층
 * bg-layer-default 묶음을 8 띄워 놓는다 — "8px 구분선" 은 없다). 바깥 여백이 없다 — 위아래 · 좌우 간격은 쓰는 자리가 정하고,
 * 들임만 Divider 가 갖는다. 선은 내용 사이에만 — 화면 · 묶음의 마지막 아래 · 카드 맨 위 · 맨 아래에는 두지 않는다.
 * 반복되는 목록 줄 사이는 Divider 가 아니라 List 의 줄 사이 선(ListDivider — 같은 값, 필요할 때만)이다.
 * 상태가 없다 — 정적인 선(누르기 · 포커스 없음).
 */
export const dividerVariants = cva("shrink-0 bg-stroke-neutral-subtle", {
  variants: {
    orientation: {
      horizontal: "h-px",
      vertical: "w-px self-stretch",
    },
    inset: {
      false: "",
      true: "",
    },
  },
  compoundVariants: [
    { orientation: "horizontal", inset: false, className: "w-full" },
    // 양끝 16 — 폭은 부모 폭 − 32(블록 · flex 어느 부모에서나 넘치지 않게)
    {
      orientation: "horizontal",
      inset: true,
      className: "mx-x4 w-[calc(100%-2*var(--spacing-x4))]",
    },
    { orientation: "vertical", inset: true, className: "my-x4" },
  ],
  defaultVariants: { orientation: "horizontal", inset: false },
});
