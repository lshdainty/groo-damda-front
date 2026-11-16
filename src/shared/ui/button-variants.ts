import { cva } from "class-variance-authority";

/*
 * Button cva — button.tsx 에서 분리(Fast Refresh: 컴포넌트 파일은 컴포넌트만 export).
 * 시각 spec 주석은 button.tsx 상단 참조.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-[var(--spacing-x2)] whitespace-nowrap select-none",
    // specs/components/button.md: "container 는 radius-sm(4px) 고정".
    // sm·md 는 4, lg·icon 만 아래에서 rounded-r2(8) 로 덮고 iconLg 는 full.
    // (DESIGN.desk.md 표에는 md 가 8 로 적혀 있으나 그쪽이 오래된 사본이다.)
    "cursor-pointer rounded-r1 font-sans font-medium tracking-[-0.005em] leading-none",
    "transition-[box-shadow,background-color,color,border-color,transform] duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
    "disabled:bg-bg-disabled disabled:text-fg-disabled disabled:cursor-not-allowed disabled:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // 채움색은 brand primary(#0147AD, 남색) 가 아니라 info(#1D6FCB) — 버튼 채움에
        // 한정한다(탭 선택·토글 등 brand 채움 자리는 --bg-brand 그대로).
        // spec button.md Migration notes 2026-08.
        default:
          "bg-[var(--status-info)] text-static-white shadow-s1 hover:shadow-s2 hover:brightness-105 active:shadow-none active:scale-[0.98] active:brightness-95",
        destructive:
          "bg-destructive text-static-white shadow-s1 hover:shadow-s2 hover:brightness-105 active:shadow-none active:scale-[0.98] active:brightness-95",
        outline:
          "border border-stroke-neutral-weak bg-transparent text-fg-neutral hover:bg-bg-neutral-weak hover:border-[var(--border-strong)] active:scale-[0.98]",
        // spec Color tokens 표에 border 가 없다 — 구현에만 있던 1px 을 뺐다(2026-08).
        secondary:
          "bg-secondary text-fg-neutral hover:bg-stroke-neutral-weak active:scale-[0.98] active:brightness-95",
        // 모달 footer 의 삭제 — 옅은 빨강 채움. 전체 폭 두 버튼이 나란히 설 때 ghost 는
        // 배경이 없어 버튼으로 안 보인다. 삭제 *확정* 은 AlertDialog 의 destructive.
        dangerSoft:
          "bg-[var(--status-danger-subtle)] text-[var(--status-danger-fg)] hover:bg-bg-critical-weak-pressed active:scale-[0.98] active:brightness-95",
        ghost:
          "bg-transparent text-fg-neutral hover:bg-bg-neutral-weak active:bg-stroke-neutral-weak active:scale-[0.98]",
        accent:
          "bg-transparent text-[var(--fg-brand)] hover:bg-bg-neutral-weak active:bg-stroke-neutral-weak active:scale-[0.98]",
        link: "bg-transparent border-0 px-0.5 text-[var(--fg-link)] hover:text-[var(--fg-link-hover)] hover:underline underline-offset-[3px] active:brightness-90",
        warm: "bg-[var(--bg-section-warm)] text-[var(--fg-on-warm)] hover:bg-bg-neutral-weak",
      },
      size: {
        default: "h-9 px-4 py-[9px] text-sm [&_svg]:size-4",
        xs: "h-6 px-2 py-1 text-xs gap-1 rounded-[var(--radius-r1)] [&_svg]:size-3.5",
        // sm 은 spec 매핑 그대로 (button.md Sizes: h-8 px-2 py-1 12px(t2) + BASE gap 8)
        // — 기존 호환층(px-3·13px·gap-5)이 앱 PButton sm 보다 커 보이던 문제 정리.
        sm: "h-8 px-2 py-1 text-t2 rounded-[var(--radius-r1)] [&_svg]:size-3.5",
        // md 글자는 t4(14px) — button.yaml medium 라벨. 옛 15px(body-md)는 같은 값의 t 단계가 없어
        // 스펙 값으로 옮겼다(2026-11-16). text-t4 가 weight 400 을 물고 오지만, 생성 CSS 가
        // font-weight:var(--tw-font-weight, ...) 라 base 의 font-medium(500)이 이긴다.
        md: "h-10 px-3 py-2 text-t4 [&_svg]:size-4",
        // lg 은 모바일 sheet/dialog footer 의 한 손 조작 폭 — 48×48(touch-comfortable),
        // radius r2(8px). 앱 PButton lg 및 button.md Sizes 표와 같은 값이다.
        // 예전 h-11(44)·rounded-r1(4)·px-5 는 앱보다 납작하고 각졌다.
        lg: "h-12 px-4 py-3 text-t5 rounded-r2 [&_svg]:size-[18px]",
        icon: "h-9 w-9 p-0 rounded-r2 [&_svg]:size-4",
        // 모바일 크롬 헤더(m-header) 전용 — 36×36 원형 + glyph 20px.
        // ghost 조합에서도 보조톤 약화 없이 중립(text-primary) 유지. button.md v97.
        iconLg: "h-9 w-9 p-0 rounded-full [&_svg]:size-5",
      },
      // flush — 컨테이너 edge 에 붙는 ghost + 아이콘 버튼의 광학 정렬용. 해당 방향 좌/우
      // padding 만 제거해 아이콘이 본문 콘텐츠 열에 맞는다. 아래 compound variant 가
      // hover 채움까지 걷는다 — 자세한 건 거기 주석.
      //
      // 채움 버튼(dangerSoft 삭제 등)에는 쓰지 않는다 — fill 이 이미 edge 까지 닿는다.
      flush: {
        left: "pl-0",
        right: "pr-0",
      },
    },
    compoundVariants: [
      // 아이콘 액션 버튼(ghost+icon): 글씨색을 보조톤(text-secondary)으로 약화 —
      // 리스트 행/툴바의 quiet 아이콘 액션. groo-design button.md v96 정합.
      // (iconLg는 페이지당 1개뿐인 주 액션이라 약화 없이 중립 유지 — v97)
      { variant: "ghost", size: "icon", className: "text-fg-neutral-muted" },
      // flush ghost 는 **텍스트 버튼**이다 — hover 에 배경을 깔지 않고 글자색으로만
      // 반응한다(보조톤 → 본문색). 아이콘은 currentColor 라 같이 진해진다.
      //
      // 한쪽 padding 만 0 이라 hover 채움 상자가 글자 기준으로 좌우 비대칭이 되어 버튼이
      // 한쪽으로 삐져나온 것처럼 보였다(2026-09-16 실측). 상자를 없애면 그 문제가 같이
      // 사라지고 위계도 맞다 — 옆의 채움 버튼보다 한 단계 약한 보조 액션이다.
      // spec button.md Edge flush.
      {
        variant: "ghost",
        flush: ["left", "right"],
        className:
          "text-fg-neutral-muted hover:bg-transparent hover:text-fg-neutral active:bg-transparent focus-visible:text-fg-neutral",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
