import { cva } from "class-variance-authority";

/*
 * Groo Card 의 모양 — 수치 원본은 groo-design specs/components/card.yaml(값은 src/shared/ds/spec/card.json).
 * 컴포넌트와 규칙은 card.tsx 머리 주석이다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// 면 — 바닥 위 흰 면 + 1px 테두리 · 그림자 없음, 모서리 16(카드 안 목록의 동심 모서리 10 = 16 − 6).
// 넘친 것(목록 줄의 누름 바탕 · 순자산 장식 빛)은 모서리에서 자른다
export const cardVariants = cva(
  "relative isolate block overflow-hidden rounded-r4 text-start font-sans text-fg-neutral no-underline",
  {
    variants: {
      variant: {
        default:
          "border border-solid border-stroke-neutral-weak bg-bg-layer-default",
        // 135° 그라디언트 — 면 색(bg-brand-solid)에서 끝 색으로. 끝은 모드마다 다른 단계다(다크에서 brand-900 은 밝은 #7AA9F6 이라 쓰지
        // 않는다). 그라디언트에는 토큰 클래스가 없어 임의 값으로 적었다 — 값은 card.json 의 root.gradientEnd
        hero: [
          // 테두리 두께 0 — 색은 default 와 같은 값을 남긴다(card.json 이 hero 에서도 root.borderColor 를 stroke-neutral-weak 로 둔다)
          "border-0 border-stroke-neutral-weak text-static-white bg-bg-brand-solid",
          "bg-[linear-gradient(135deg,var(--color-bg-brand-solid),var(--color-brand-900))]",
          "dark:bg-[linear-gradient(135deg,var(--color-bg-brand-solid),var(--color-brand-300-dark))]",
        ].join(" "),
      },
      body: {
        content: "p-x6",
        // 좌우 · 위 0 — 머리가 위 24 · 좌우 24 를 갖고, 줄이 제 좌우 24 · 위아래 12 를 가진다. 아래 12 + 마지막 줄 12 = 보이는 24.
        // 머리가 없으면 위도 12 — 첫 줄 12 와 합쳐 보이는 24(위 · 아래 같게)
        list: "pb-x3 [&:not(:has(>[data-slot=card-header]))]:pt-x3",
        // 좌우 · 위 0 — 머리가 위 24 · 좌우 24 를 갖고, 트리거가 제 좌우 24 · 위아래 16 을 가진다. 아래 8 + 마지막 트리거 16 = 보이는 24.
        // 머리가 없으면 위도 8 — 첫 트리거 16 과 합쳐 보이는 24
        accordion: "pb-x2 [&:not(:has(>[data-slot=card-header]))]:pt-x2",
      },
    },
    defaultVariants: { variant: "default", body: "content" },
    compoundVariants: [
      // 순자산 카드는 늘 여백 24 의 글 카드다
      { variant: "hero", body: ["list", "accordion"], class: "p-x6" },
    ],
  },
);

// 누름 whole — 면 색 + 2px 거리 축소, 키보드 포커스에만 바깥 링(띄움 2). 모션 줄이기면 색만
export const CARD_PRESS_WHOLE = [
  "w-full cursor-pointer",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 순자산 카드는 채움이라 면 색을 바꾸지 않는다(색은 -pressed 짝이 있는 표면에서만 — SEED Feedback)
export const CARD_PRESS_WHOLE_SURFACE =
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed";

// 누름 peers — 카드를 누르는 링크를 올리거나 누르면 면 색만(축소 없음). 안의 버튼 · 링크는 카드 링크 위(z 1)에 놓여 각자 눌린다.
// 올림은 마우스가 있는 기기에서만 — 터치에서 호버가 남지 않게. 링은 카드 링크의 키보드 포커스에만 — 직전 입력이 포인터면 그리지 않는다(index.css focus-visible 과 같은 조건)
export const CARD_PRESS_PEERS = [
  "cursor-pointer",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "[@media(hover:hover)]:has-[[data-slot=card-link]:hover]:bg-bg-layer-default-pressed has-[[data-slot=card-link]:active]:bg-bg-layer-default-pressed",
  "has-[[data-slot=card-link]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-2 has-[[data-slot=card-link]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-offset-2 has-[[data-slot=card-link]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-stroke-focus-ring",
  "[&_button:not([data-slot=card-link])]:relative [&_button:not([data-slot=card-link])]:z-[1] [&_a:not([data-slot=card-link])]:relative [&_a:not([data-slot=card-link])]:z-[1]",
].join(" ");

// 순자산 장식 빛 — 오른쪽 위, 글자 뒤(카드 안 쌓임의 맨 아래). 240 원 · 오른쪽 −40 · 위 −80, 흰 22% → 70% 에서 투명
export const CARD_HERO_GLOW =
  "pointer-events-none absolute -right-[40px] -top-[80px] -z-10 size-[240px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-static-white)_22%,transparent),transparent_70%)]";

// 머리 — 제목과 오른쪽 동작 한 줄. 글 카드는 카드 여백 안 · 아래 8, 목록 · 아코디언 카드는 위 24 · 좌우 24 · 아래 4.
// 동작이 머리 폭의 절반을 넘으면 제목 아래 줄 오른쪽 끝으로 내려간다(제목 최소 50% · 줄바꿈 — 03-G 결정 4A). 평소에는 한 줄 그대로다
export const cardHeaderVariants = cva(
  "flex items-center justify-between gap-x2 flex-wrap [&>:first-child:not(:last-child)]:min-w-[50%] [&>:first-child:not(:last-child)]:flex-1 [&>:last-child:not(:first-child)]:ml-auto",
  {
    variants: {
      body: {
        content: "pb-x2",
        list: "px-x6 pb-x1 pt-x6",
        accordion: "px-x6 pb-x1 pt-x6",
      },
    },
    defaultVariants: { body: "content" },
  },
);

export const CARD_TITLE =
  "min-w-0 font-sans tracking-normal text-t5 font-bold text-fg-neutral";

// 머리 동작 = SEED Text Button(D2) — 보이는 상자 36 · 좌우 14 · 모서리 8, 글 t4 · 700 · fg-neutral-muted, 꺾쇠 · 아이콘 없음.
// 누르는 영역 44(::before), 누르면 바탕 + 2px 거리 축소
export const CARD_ACTION = [
  "relative -mr-x3_5 inline-flex min-h-[36px] shrink-0 cursor-pointer items-center rounded-r2 border-0 bg-transparent px-x3_5",
  "font-sans text-t4 font-bold text-fg-neutral-muted no-underline",
  "before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-full before:min-w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

export const CARD_CONTENT = "flex flex-col gap-x3";

// peers 카드의 누르는 자리 — ::after 가 카드 전체를 덮는다(카드가 relative). 포커스 링은 카드가 그린다
export const CARD_LINK = [
  "cursor-pointer border-0 bg-transparent p-0 text-start font-sans text-t5 font-bold text-fg-neutral no-underline",
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
].join(" ");

// 증감 — 방향 색은 ▲ fg-critical · ▼ fg-informative(좋고 나쁨이 아니라 방향)
export const DELTA_BOX =
  "inline-flex flex-wrap items-baseline gap-x1 font-sans text-t3";
export const DELTA_TONE = {
  up: "text-fg-critical",
  down: "text-fg-informative",
  flat: "text-fg-neutral-subtle",
} as const;

// 지표 — 라벨 13 · 500, 숫자 700 · 고정폭 숫자(large 24 / 32 · small 20 / 27)
export const CARD_STAT_LABEL =
  "font-sans text-t3 font-medium text-fg-neutral-subtle";
export const CARD_STAT_VALUE =
  "mt-x1 max-w-full font-sans font-bold tabular-nums text-fg-neutral [overflow-wrap:anywhere]";
export const CARD_STAT_SIZE = { large: "text-t9", small: "text-t7" } as const;

// 순자산 카드의 흰 글자 셋 — 라벨 13 · 500, 금액 32 / 42 · 700(아래 6), 아래 글 13(아래 4). 흐리게(불투명도) 두지 않는다
export const CARD_HERO_LABEL =
  "font-sans text-t3 font-medium text-static-white";
export const CARD_HERO_AMOUNT =
  "mt-x1_5 font-sans text-t12 font-bold tabular-nums text-static-white";
export const CARD_HERO_DETAIL =
  "mt-x1 font-sans text-t3 font-normal text-static-white";
