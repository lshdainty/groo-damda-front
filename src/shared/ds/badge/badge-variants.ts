import { cva } from "class-variance-authority";

/*
 * Groo Badge — 구조는 SEED Badge(2026-10-03). 수치 원본은 groo-design
 * specs/components/badge.yaml(값은 src/shared/ds/spec/badge.json).
 * groo-design recipes/shadcn/components/ui/badge.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 이 파일은 변형 정의,
 * 컴포넌트는 badge.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 *   Badge        대상의 상태 · 분류를 한두 낱말로 보이는 작은 라벨 — <span>. 누르지 않는다(호버 · 누름 · 포커스 · 비활성이 없다)
 *   BadgeGroup   한 대상의 배지 묶음 — 둘까지, 사이 4. 줄을 바꾸지 않는다
 *
 *   variant  weak(기본) — 옅은 바탕 bg-{톤}-weak + 진한 글자 fg-{톤}-contrast · 500. 반복되는 목록 · 분류 · 부가 정보
 *            solid — 채움 bg-{톤}-solid + 흰 글자 · 700. 한 화면에서 꼭 눈에 띄어야 할 상태 하나 · 사진 위
 *            outline — 투명 + 안쪽 1px 옅은 선 stroke-{톤}-weak + 의미 색 글자 fg-{톤} · 700. 상세 · 본문의 중간 강조
 *   tone     neutral(기본) · brand · informative · positive · warning · critical — 색은 variant × tone 두 축이 함께 정한다
 *   size     medium 20(기본) — 좌우 6 · 위아래 2 · 모서리 4 · t1-static 11/15 · 앞 아이콘 12
 *            large 24 — 좌우 8 · 위아래 4 · 모서리 6 · t2-static 12/16 · 앞 아이콘 14
 *
 * 중립만 짝이 다르다 — weak 는 bg-neutral-weak + fg-neutral-muted, solid 는 bg-neutral-inverted + fg-neutral-inverted(다크에서
 * 밝은 면 + 짙은 글자로 뒤집힌다), outline 은 stroke-neutral-weak + fg-neutral-muted. warning solid 는 주황 + 흰 글자다(SEED 의
 * 노랑 + 검정 글자가 아니다). outline 테두리는 안쪽 1px(inset box-shadow)이라 상자 크기가 변하지 않는다.
 * 그 두께 · 색은 CSS 변수(--badge-stroke-width · --badge-stroke-color)로 정하고 그림자가 그것을 그린다 — 검사기
 * (npm run ds:check)는 그림자를 읽지 못해 그 변수를 잰다.
 * 중립 weak 의 바탕은 회색 바탕(bg-layer-basement)과 같은 색이라 흰 표면(bg-layer-default) · 시트 위에 둔다 — 회색 위면 outline.
 *
 * 글은 글자 크기 설정을 따르지 않는다(t1-static · t2-static — 정해진 디자인 틀, DESIGN.md Typography "그대로 두는 것", groo-design #260).
 * 배지가 알리는 상태는 놓인 줄 · 상세의 글로도 읽힌다(WCAG 1.4.4 의 예외).
 * 최대 폭이 없다 — 한 줄이고, 부모가 좁거나(flex 안) 쓰는 쪽이 폭을 막을 때만 글이 말줄임(…)한다. 글 전체는 DOM 에 남아
 * 보조 기술이 다 읽는다. 역할이 없는 글이라 앞뒤 글(줄 이름)과 이어 읽힌다. 앞 아이콘은 aria-hidden — 글자색을 따르고,
 * 크기는 배지가 정한다. 상태가 바뀌면 글 · 색이 바로 바뀐다(모션 없음).
 * 배지 안에 버튼을 넣지 않는다 — 뜻을 더 설명해야 하면 배지 옆에 ⓘ Help Bubble. 누르는 라벨은 Chip 이다.
 */
export const badgeVariants = cva(
  "inline-flex min-w-0 cursor-default items-center gap-x0_5 overflow-hidden whitespace-nowrap font-sans",
  {
    variants: {
      variant: {
        weak: "font-medium",
        solid: "font-bold",
        // 안쪽 1px 선 — 두께는 여기, 색은 톤마다(아래 compound). 그림자라 상자 크기가 변하지 않는다
        outline:
          "bg-transparent font-bold [--badge-stroke-width:1px] [box-shadow:inset_0_0_0_var(--badge-stroke-width)_var(--badge-stroke-color)]",
      },
      tone: {
        neutral: "",
        brand: "",
        informative: "",
        positive: "",
        warning: "",
        critical: "",
      },
      size: {
        medium: "min-h-x5 rounded-r1 px-x1_5 py-x0_5 text-t1-static",
        large: "min-h-x6 rounded-r1_5 px-x2 py-x1 text-t2-static",
      },
    },
    compoundVariants: [
      // weak — 옅은 바탕 + 진한 글자
      {
        variant: "weak",
        tone: "neutral",
        className: "bg-bg-neutral-weak text-fg-neutral-muted",
      },
      {
        variant: "weak",
        tone: "brand",
        className: "bg-bg-brand-weak text-fg-brand-contrast",
      },
      {
        variant: "weak",
        tone: "informative",
        className: "bg-bg-informative-weak text-fg-informative-contrast",
      },
      {
        variant: "weak",
        tone: "positive",
        className: "bg-bg-positive-weak text-fg-positive-contrast",
      },
      {
        variant: "weak",
        tone: "warning",
        className: "bg-bg-warning-weak text-fg-warning-contrast",
      },
      {
        variant: "weak",
        tone: "critical",
        className: "bg-bg-critical-weak text-fg-critical-contrast",
      },
      // solid — 채움 + 흰 글자(중립은 뒤집힌 면 + 뒤집힌 글자)
      {
        variant: "solid",
        tone: "neutral",
        className: "bg-bg-neutral-inverted text-fg-neutral-inverted",
      },
      {
        variant: "solid",
        tone: "brand",
        className: "bg-bg-brand-solid text-static-white",
      },
      {
        variant: "solid",
        tone: "informative",
        className: "bg-bg-informative-solid text-static-white",
      },
      {
        variant: "solid",
        tone: "positive",
        className: "bg-bg-positive-solid text-static-white",
      },
      {
        variant: "solid",
        tone: "warning",
        className: "bg-bg-warning-solid text-static-white",
      },
      {
        variant: "solid",
        tone: "critical",
        className: "bg-bg-critical-solid text-static-white",
      },
      // outline — 안쪽 1px 옅은 선 + 의미 색 글자
      {
        variant: "outline",
        tone: "neutral",
        className:
          "text-fg-neutral-muted [--badge-stroke-color:var(--color-stroke-neutral-weak)]",
      },
      {
        variant: "outline",
        tone: "brand",
        className:
          "text-fg-brand [--badge-stroke-color:var(--color-stroke-brand-weak)]",
      },
      {
        variant: "outline",
        tone: "informative",
        className:
          "text-fg-informative [--badge-stroke-color:var(--color-stroke-informative-weak)]",
      },
      {
        variant: "outline",
        tone: "positive",
        className:
          "text-fg-positive [--badge-stroke-color:var(--color-stroke-positive-weak)]",
      },
      {
        variant: "outline",
        tone: "warning",
        className:
          "text-fg-warning [--badge-stroke-color:var(--color-stroke-warning-weak)]",
      },
      {
        variant: "outline",
        tone: "critical",
        className:
          "text-fg-critical [--badge-stroke-color:var(--color-stroke-critical-weak)]",
      },
    ],
    defaultVariants: {
      variant: "weak",
      tone: "neutral",
      size: "medium",
    },
  },
);

// 묶음 — 배지 사이 4, 줄을 바꾸지 않는다(넘치면 배지가 글을 말줄임 — 셋 이상 필요하면 중요한 것만 남긴다)
export const badgeGroupVariants = cva(
  "inline-flex min-w-0 max-w-full flex-nowrap items-center gap-x1",
);
