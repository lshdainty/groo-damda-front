import { cva } from "class-variance-authority";

/*
 * Groo List — 구조는 SEED List(2026-10-01). 수치 원본은 groo-design specs/components/list.yaml · list-header.yaml
 * (값은 src/shared/ds/spec/list.json · list-header.json). groo-design recipes/shadcn/components/ui/list.tsx 를 첫 판으로
 * 가져왔다 — 이 파일은 변형 정의, 컴포넌트는 list.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 *   List · ListItem                  목록(ul) · 보기만 하는 줄
 *   ListButtonItem · ListLinkItem    줄 전체가 버튼 · 링크(뒤 붙이개의 작은 버튼은 따로 눌린다)
 *   ListSwitchItem · ListCheckItem · ListRadioItem   줄 전체가 라벨 — 줄 어디를 눌러도 끼운 컨트롤이 바뀐다
 *   ListRadioGroup · ListCheckGroup  하나 고르기(role=radiogroup) · 여럿 고르기(fieldset) 묶음 — 줄은 li 대신 div
 *   ListParentItem                   하위 줄을 접는 부모 줄(2026-10-10) — 줄 앞 꺾쇠 단추 44 + 하위 줄 묶음
 *   ListDivider · ListHeader · ListTile   줄 사이 선(필요할 때만) · 목록 제목 · 내용 줄의 앞 타일
 *
 * 한 줄은 두 층이다 — 바탕 층(list-background: 누름 · 호버 · 강조 바탕, 줄지 않는다)과 콘텐츠 층(list-content: 앞 · 본문 · 뒤).
 * 누르면 바탕이 좌우 6 들어와 모서리 10 이 되고(SEED), 콘텐츠 층만 2px 거리로 준다(기초 Feedback v104) —
 * 배율 = (기준 − 2) ÷ 기준, 기준 = max(높이, 폭 ÷ 4, 24). Button 과 같이 누르는 순간(포인터 · 키) 줄을 재서 --press-basis 로 넘긴다.
 * 호버는 마우스 있는 기기에서만 누름과 같은 바탕(v106). 줄 안의 스위치 · 체크 · 라디오는 따로 줄지 않는다.
 * 누르는 줄의 버튼 · 링크는 ::after 로 콘텐츠 층 전체를 덮어 줄 어디를 눌러도 눌리고, 뒤 붙이개 안의 버튼 · 링크는 z-index 1 로
 * 그 위에 올라 따로 눌린다(SEED 와 같은 짜임).
 * 키보드 포커스 링(웹)은 줄 안쪽 2px 이다 — 화면 폭 줄은 바깥 링이 잘린다. 콘텐츠 층이 링을 그린다(바탕 층은 줄지 않으므로
 * 링이 줄 때 같이 준다 — ::after 로 그렸을 때와 같은 모습이다. 가상 요소는 검사기가 읽지 못해 층에 직접 그린다).
 * 컨트롤 줄은 끼운 컨트롤이 포커스를 받아 그 컨트롤의 링이 보이므로 줄의 링은 없다.
 *
 * 상태를 읽는 표식 — 누르는 줄의 버튼 · 링크 · 라벨(컨트롤 줄)과 끼운 컨트롤은 data-list-action 을 가진다.
 * 줄(group/list-item)이 :has([data-list-action]:hover · :active) 로 바탕 · 축소 · 글자 색을 정한다. 컨트롤에도 다는 까닭 —
 * 키보드(Space)로 누르면 :active 가 라벨이 아니라 컨트롤에 걸린다. 링은 본문(data-slot=list-body)의 포커스에서만 그린다.
 * 막힌 줄은 data-disabled 가 붙어 그 표식에서 빠진다(호버 · 누름 · 축소가 없다).
 *
 * 글자: 제목 t5 · 400, 설명 t3 · fg-neutral-subtle(사용자 결정 — SEED 그대로). 좌우 여백은 spacing-global-gutter(24).
 * 막힌 줄은 제목 · 설명 · 앞뒤 아이콘 · 값 글자가 모두 fg-disabled, 타일은 bg-disabled — 불투명도로 흐리게 하지 않는다(v106).
 * 강조 줄은 바탕만 옅은 브랜드 색이고, 올리거나 누르는 동안 설명 · 값 글자만 fg-neutral-muted 로 한 단계 짙어진다
 * (fg-neutral-subtle 은 짙은 강조 바탕 위에서 4.32:1 로 글자 기준에 모자란다). 화살표는 그대로다.
 *
 * 하위 줄(nest) — 부모 줄은 줄 앞 4(꺾쇠 단추 44 + 4 를 지나 앞 붙이개가 52), 하위 줄은 부모의 제목 자리 104 에서 시작한다
 * (= 4 + 44 + 4 + 타일 40 + 12, 사용자 결정 17B). 누름 바탕은 줄 폭 그대로다.
 */

// 목록 — 줄을 세로로 잇는다. 배경 · 줄 사이 간격 없음(줄의 위아래 여백이 간격이다)
export const listVariants = cva("flex w-full flex-col gap-0");

// 줄 — 바탕 층과 콘텐츠 층의 컨테이너. 누르는 줄의 상태는 안쪽 [data-list-action](버튼 · 링크 · 라벨 · 컨트롤)에서 읽는다.
// 기준 길이 기본값 24 — 누르는 순간 줄을 재서 인라인으로 덮는다(list.tsx 의 withPress)
//
// 줄(li)은 컨테이너다(@container/list-item) — 줄 안 폭이 제목 글자 16개(16em = 16rem)보다 좁으면 값을 본문 아래로 내린다(listContentVariants 의 narrow)
export const listItemVariants = cva(
  "group/list-item @container/list-item relative flex w-full [--press-basis:24]",
);

// 바탕 층 — 누름 · 호버 · 강조 바탕. 콘텐츠 뒤에 깔리고 줄지 않는다. 눌리거나 올리면 좌우 6 들어와 모서리가 둥글어진다.
// 모서리의 기본 10(radius-r2_5)은 --list-item-radius 로 바꾼다 — 카드 안에서는 카드 모서리 − 카드 가장자리에서 바탕까지 거리(동심 모서리)
// 가운데 바탕 색은 변형에서 정한다 — 호버 · 누름의 색이 같은 속성이라 한 변형만 남게 한다
export const listBackgroundVariants = cva(
  [
    "pointer-events-none absolute inset-y-0 inset-x-0 rounded-none",
    "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),inset_var(--motion-duration-color-transition)_var(--motion-ease-easing),border-radius_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
    "[@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item:inset-x-x1_5",
    "[@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item:rounded-[var(--list-item-radius,var(--radius-r2_5))]",
    "group-has-[[data-list-action]:not([data-disabled]):active]/list-item:inset-x-x1_5",
    "group-has-[[data-list-action]:not([data-disabled]):active]/list-item:rounded-[var(--list-item-radius,var(--radius-r2_5))]",
  ].join(" "),
  {
    variants: {
      highlight: {
        none: "bg-transparent [@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item:bg-bg-layer-default-pressed group-has-[[data-list-action]:not([data-disabled]):active]/list-item:bg-bg-layer-default-pressed",
        highlighted:
          "bg-bg-brand-weak [@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item:bg-bg-brand-weak-pressed group-has-[[data-list-action]:not([data-disabled]):active]/list-item:bg-bg-brand-weak-pressed",
      },
    },
    defaultVariants: { highlight: "none" },
  },
);

// 콘텐츠 층 — 앞 · 본문 · 뒤. 누르면 이 층만 준다. 위아래 12 · 좌우 24.
// 부모 줄(nest=parent)은 왼쪽 4 — 꺾쇠 단추 44 + 4 를 지나 앞 붙이개가 52 에서 시작한다.
// 하위 줄(nest=child)은 왼쪽 104 — 부모의 제목 자리(스펙 list.yaml 이 104 로 정했고 토큰에 없다)
export const listContentVariants = cva(
  [
    "relative flex w-full py-x3",
    "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
    "group-has-[[data-list-action]:not([data-disabled]):active]/list-item:[scale:calc(1-2/var(--press-basis))] motion-reduce:group-has-[[data-list-action]:not([data-disabled]):active]/list-item:[scale:1]",
    // 키보드 포커스에만 줄 안쪽 링 2px
    "has-[[data-slot=list-body]:focus-visible]:outline-2 has-[[data-slot=list-body]:focus-visible]:-outline-offset-2 has-[[data-slot=list-body]:focus-visible]:outline-stroke-focus-ring",
    // 제목 낱말 상한의 앞 자리 상수 — 앞 붙이개 54(아바타 42 + 사이 12), 꺾쇠 단추 · 빈 자리 48(44 + 4)
    "has-[>[data-slot=list-prefix]]:[--list-lead-p:54px] has-[>:is([data-slot=list-expand-button],[data-slot=list-expand-slot])]:[--list-lead-e:48px]",
    // 자식의 격자 자리 — 좁은 줄(narrow)에서만 뜻이 있다. 넓은 줄은 flex 라 grid-column · grid-row 가 무시된다
    "[&>:is([data-slot=list-expand-button],[data-slot=list-expand-slot])]:col-start-1 [&>:is([data-slot=list-expand-button],[data-slot=list-expand-slot])]:row-start-1 [&>:is([data-slot=list-expand-button],[data-slot=list-expand-slot])]:row-span-2",
    "[&>[data-slot=list-prefix]]:col-start-2 [&>[data-slot=list-prefix]]:row-start-1 [&>[data-slot=list-prefix]]:row-span-2",
    "[&>[data-slot=list-body]]:col-start-3 [&>[data-slot=list-body]]:row-start-1",
    "[&>[data-slot=list-suffix]]:col-start-4 [&>[data-slot=list-suffix]]:row-start-1",
    // 값 + 꺾쇠 한 덩어리(Fragment)면 좁은 줄에서 suffix 상자를 풀어(contents) 꺾쇠는 줄 끝(col 4), 값은 본문 아래(col 3 · row 2)로 가른다
    "[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:is(svg,button,a,input,[data-slot=list-mark])]:col-start-4 [&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:is(svg,button,a,input,[data-slot=list-mark])]:row-start-1",
    "[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:col-start-3 [&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:row-start-2",
    // 본문 오른쪽 여백 — 옆에 조작 요소(꺾쇠 · 버튼 · 링크 · 입력 · 표식)가 남으면 10, 남지 않으면 좁은 줄에서 0
    "[&:has(>[data-slot=list-suffix]_svg,>[data-slot=list-suffix]_button,>[data-slot=list-suffix]_a,>[data-slot=list-suffix]_input,>[data-slot=list-suffix]_[data-slot=list-mark])>[data-slot=list-body]]:pr-x2_5",
    // 값(글 값 · 금액)은 본문 아래 — 설명 ↔ 값 4 = 값 위 바깥 여백 2(스펙 suffix.marginTop) + 안쪽 여백 2(본문 안 제목 ↔ 설명 사이 2 와 같은 틈 —
    // 값은 본문 밖의 형제라 그 틈이 저절로 생기지 않는다). `:has()` 안에 `:has()` 를 둘 수 없어 본문 쪽 여백으로는 못 준다. 화살표 · 컨트롤(스위치 · 체크 · 라디오) · 작은 버튼이 든 뒤 붙이개는 줄 끝 그대로
    "[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:col-start-3 [&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:row-start-2",
  ].join(" "),
  {
    variants: {
      align: {
        center: "items-center",
        top: "items-start",
      },
      // 좁은 줄의 값 안쪽 맞춤: 호출처가 평소(값이 줄 끝)에 둔 오른쪽 맞춤 표식(items-end · justify-end · text-end · text-right · self-end · ml-auto)을
      // 값 요소와 자손에서만 왼쪽으로 푼다 — 스펙 list.md "큰 글자에서 값을 본문 아래로": 본문 칸 안 왼쪽 맞춤(금액 · Delta · 배지 · 가린 값). 화살표 · 컨트롤은 줄 끝 그대로
      // 단계마다 좌우 여백이 달라 줄 안 폭의 문턱(16rem + 좌우 여백)도 다르다 — 줄 24 · 24, 부모 4 · 24, 하위 104 · 24
      nest: {
        none: [
          "px-global-gutter [--list-gutters:58px]",
          "@max-[calc(16rem+48px)]/list-item:grid @max-[calc(16rem+48px)]/list-item:grid-cols-[auto_auto_minmax(0,1fr)_auto] @max-[calc(16rem+48px)]/list-item:items-start",
          "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-body]]:pr-0 @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-body]]:min-w-0 @max-[calc(16rem+48px)]/list-item:[&_[data-slot=list-title]]:before:hidden ",
          "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.ml-auto)]:ml-0! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.ml-auto)]:ml-0! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.ml-auto)]:ml-0!",
          "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))]:contents @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:mt-x0_5 @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:pt-x0_5 @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:text-start",
          "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:mt-x0_5 @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:pt-x0_5 @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:text-start @max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix][data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark])))_:is(.justify-end,.items-end,.text-end,.text-right)]:justify-start!",
        ].join(" "),
        parent: [
          "pl-x1 pr-global-gutter [--list-gutters:38px]",
          "@max-[calc(16rem+28px)]/list-item:grid @max-[calc(16rem+28px)]/list-item:grid-cols-[auto_auto_minmax(0,1fr)_auto] @max-[calc(16rem+28px)]/list-item:items-start",
          "@max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-body]]:pr-0 @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-body]]:min-w-0 @max-[calc(16rem+28px)]/list-item:[&_[data-slot=list-title]]:before:hidden ",
          "@max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.ml-auto)]:ml-0! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.ml-auto)]:ml-0! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.ml-auto)]:ml-0!",
          "@max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))]:contents @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:mt-x0_5 @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:pt-x0_5 @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:text-start",
          "@max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:mt-x0_5 @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:pt-x0_5 @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:text-start @max-[calc(16rem+28px)]/list-item:[&>[data-slot=list-suffix][data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark])))_:is(.justify-end,.items-end,.text-end,.text-right)]:justify-start!",
        ].join(" "),
        child: [
          "pl-[104px] pr-global-gutter [--list-gutters:138px]",
          "@max-[calc(16rem+128px)]/list-item:grid @max-[calc(16rem+128px)]/list-item:grid-cols-[auto_auto_minmax(0,1fr)_auto] @max-[calc(16rem+128px)]/list-item:items-start",
          "@max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-body]]:pr-0 @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-body]]:min-w-0 @max-[calc(16rem+128px)]/list-item:[&_[data-slot=list-title]]:before:hidden ",
          "@max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark]):is(.ml-auto)]:ml-0! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])_*:is(.ml-auto)]:ml-0! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:items-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:justify-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:text-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)]:self-start! @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))_*:is(.ml-auto)]:ml-0!",
          "@max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))]:contents @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:mt-x0_5 @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:pt-x0_5 @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))>:not(svg,button,a,input,[data-slot=list-mark])]:text-start",
          "@max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:mt-x0_5 @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:pt-x0_5 @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix]:is(:not(:has(svg,button,a,input,[data-slot=list-mark])),[data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark]))))]:text-start @max-[calc(16rem+128px)]/list-item:[&>[data-slot=list-suffix][data-value=text]:not(:has(>:is(svg,button,a,input,[data-slot=list-mark])))_:is(.justify-end,.items-end,.text-end,.text-right)]:justify-start!",
        ].join(" "),
      },
    },
    defaultVariants: { align: "center", nest: "none" },
  },
);

// 앞 붙이개 — 아이콘 22(fg-neutral — 22 는 간격 토큰에 없어 스펙 list.yaml icon.size 값 그대로 쓴다). 막히면 아이콘 · 타일 모두 비활성 색(타일은 부르는 쪽의 카테고리 색을 덮는다)
export const listPrefixVariants = cva(
  "flex shrink-0 items-center pr-x3 [&>svg]:size-[22px] [&>svg]:shrink-0",
  {
    variants: {
      disabled: {
        true: "text-fg-disabled [&_[data-slot=list-tile]]:bg-bg-disabled [&_[data-slot=list-tile]]:text-fg-disabled",
        false: "text-fg-neutral",
      },
    },
    defaultVariants: { disabled: false },
  },
);

// 본문 — 제목 + 설명. 누르는 줄은 이것이 버튼 · 링크다. 남는 폭을 쓰고(flex-1), 뒤 붙이개가 길면 먼저 양보하되
// 제목의 가장 긴 낱말 폭까지만 준다(min-w-min = min-content — 단어 단위 줄바꿈(keep-all)에서 min-content 는 가장 긴 낱말이고,
// 설명 칸은 w-0 이라 폭을 키우지 않는다. 뒤 여백 10 은 안쪽 여백이라 min-content 에 이미 들어 있다).
// "장소" 같은 짧은 제목이 긴 값 옆에서 "장/소" 로 갈라지지 않는다(2026-10-30 사용자 결정 — list.md "값이 길 때" 안 B 가 Q-001 A 의 한 글자 규칙을 바꿨다).
// 좁은 줄(nest 의 narrow)은 값이 본문 아래로 내려가 제목이 줄 안 폭을 다 쓰므로 최소 폭 0 이다. 제목 · 설명은 칸 끝에서 끊는다
export const listBodyVariants = cva(
  "flex min-w-min flex-1 flex-col items-start gap-x0_5 pr-x2_5 text-left",
);

// 제목 색이 바뀔 때만(끝냄 · 막힘 · 강조) 150ms 색 전환(앱 List 와 같은 값 — 처음 그림은 바뀌는 게 없어 모션 없음, 모션 줄이기면 전환 없음).
// 제목 — 평소엔 단어 단위, 낱말 하나가 줄 안 폭보다 길 때만 글자 사이에서 끊는다.
// overflow-wrap: break-word 는 min-content 를 줄이지 않아(anywhere 는 줄인다) 본문의 최소 폭이 가장 긴 낱말이 된다.
// 공백 없는 긴 제목은 상한 = (줄 안 폭 − 앞 붙이개 폭 − 앞 붙이개와 본문 사이 12) ÷ 2 에서 글자 사이로 끊어, 값이 줄의 절반 아래로 밀리지 않게 한다
// (2026-10-30 디자인 세션). 줄(li)이 컨테이너라 100cqw 가 줄 폭이다. --list-gutters(좌우 여백 + 본문 뒤 여백 10)는 nest 마다 listContentVariants 가,
// --list-lead-p(앞 붙이개가 있으면 54 = 흔한 가장 넓은 아바타 42 + 사이 12)와 --list-lead-e(꺾쇠 단추 · 빈 자리가 있으면 48 = 44 + 4)는
// 콘텐츠 층(listContentVariants)이 자식 유무로 정한 상수다 — 재지 않는다(수백 줄 목록에서 줄마다 관찰자를 달지 않는다). 좁은 줄(값이 아래로)은 제한이 없다
export const listTitleVariants = cva(
  "font-sans text-t5 font-normal [transition:color_var(--motion-duration-color-transition)_var(--motion-ease-easing)] motion-reduce:transition-none",
  {
    variants: {
      disabled: { true: "text-fg-disabled", false: "text-fg-neutral" },
      // ruler — 글 제목: 제목 자신은 anywhere(min-content 가 글자 하나)로 두고, 같은 글을 담은 높이 0 의 ::before(data-ruler)가
      // min-content 만 대신 정한다 — 가장 긴 낱말 폭, 단 상한(절반)까지. 제목 전체를 max-width 로 막으면 띄어쓰기 있는 제목이 절반에서 줄을 바꾼다.
      // ruler=false 는 잣대 없이 break-word 로 가장 긴 낱말 폭까지(상한 없음) — 줄은 늘 true 를 준다
      ruler: {
        true: [
          "[overflow-wrap:anywhere]",
          "before:invisible before:block before:h-0 before:overflow-hidden before:content-[attr(data-ruler)] before:[overflow-wrap:normal]",
          "before:[max-inline-size:calc((100cqw-var(--list-gutters,58px)-var(--list-lead-p,0px)-var(--list-lead-e,0px))/2)]",
        ].join(" "),
        false: "break-words",
      },
    },
    defaultVariants: { disabled: false, ruler: false },
  },
);

// 강조 줄을 올리거나 누르는 동안 — 짙은 강조 바탕 위라 설명 · 값 글자를 한 단계 짙게
const HIGHLIGHT_MUTED =
  "[@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item:text-fg-neutral-muted group-has-[[data-list-action]:not([data-disabled]):active]/list-item:text-fg-neutral-muted";

// 설명 칸은 내용 폭을 0 으로 세고 본문 폭만 min-width 로 건다(w-0 min-w-full) — 한 줄 말줄임(Tag Group truncate)이 본문의 최소 폭을
// 키워 금액을 줄 밖으로 미는 것을 막는다. 본문이 폭을 정하고 설명은 그 안에서 줄을 바꾸거나 말줄임한다(list.md:128 "금액은 한 줄 · 본문이 양보")
export const listDetailVariants = cva(
  "w-0 min-w-full font-sans text-t3 [overflow-wrap:anywhere]",
  {
    variants: {
      disabled: { true: "text-fg-disabled", false: "text-fg-neutral-subtle" },
      highlighted: { true: "", false: "" },
    },
    compoundVariants: [
      { disabled: false, highlighted: true, className: HIGHLIGHT_MUTED },
    ],
    defaultVariants: { disabled: false, highlighted: false },
  },
);

// 뒤 붙이개 — 줄지 않고 본문이 양보한다(value=node: 금액 · 화살표 · 컨트롤 · 작은 버튼은 한 덩어리).
// 글로 넘긴 값(value=text: 이메일 · 계좌번호 · 긴 이름)은 본문이 1em 이 된 뒤에야 줄고 줄 끝에서 끊는다 — 본문 위로 넘치지 않는다(Q-001 A).
// 값 글자(t5 · 옅은 색) · 화살표 18. 안의 버튼 · 링크는 줄의 ::after 위로 올라 따로 눌린다. 단 Input Button 의 누르는 층(상자를 덮는 absolute)은 제외한다 —
// relative 로 덮으면 폭 0 이 된다
// 강조 줄을 올리거나 누르면 값 글자만 짙어진다 — 화살표는 그대로 옅은 색
export const listSuffixVariants = cva(
  "flex items-center gap-x1 font-sans text-t5 [&>svg]:size-x4_5 [&>svg]:shrink-0 [&_a]:relative [&_a]:z-1 [&_button:not([data-slot=input-button]>button)]:relative [&_button:not([data-slot=input-button]>button)]:z-1",
  {
    variants: {
      disabled: {
        true: "text-fg-disabled",
        false: "text-fg-neutral-subtle",
      },
      highlighted: { true: "", false: "" },
      value: {
        node: "shrink-0",
        text: "min-w-0 shrink text-end [overflow-wrap:anywhere]",
      },
    },
    compoundVariants: [
      {
        disabled: false,
        highlighted: true,
        className: `${HIGHLIGHT_MUTED} [&>svg]:text-fg-neutral-subtle`,
      },
    ],
    defaultVariants: { disabled: false, highlighted: false, value: "node" },
  },
);

// 누르는 줄의 본문 버튼 · 링크 — ::after 가 콘텐츠 층 전체를 덮는다(누르는 영역). 링은 콘텐츠 층이 그린다
export const listActionVariants = cva(
  [
    "cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[inherit] no-underline outline-none",
    "after:absolute after:inset-0 after:content-['']",
    "data-[disabled]:cursor-not-allowed",
  ].join(" "),
);

// 컨트롤 줄 — 줄 전체가 라벨
export const listControlVariants = cva(
  "cursor-pointer select-none data-[disabled]:cursor-not-allowed",
);

// 끼운 컨트롤은 따로 줄지 않는다 — 줄의 콘텐츠가 함께 준다(v104). 라벨의 누름이 컨트롤로 넘어오므로 컨트롤 자신의 축소만 끈다
export const LIST_MARK_NO_SCALE = "active:[scale:1]";

// 줄 사이 선 — 필요할 때만. 기본은 줄 폭 전체, inset 이면 좌우 24 들인다
export const listDividerVariants = cva(
  "h-px shrink-0 bg-stroke-neutral-subtle",
  {
    variants: { inset: { true: "mx-global-gutter", false: "w-full" } },
    defaultVariants: { inset: false },
  },
);

// 목록 제목 — 목록 밖, 바로 위. 좌우 24(줄과 같다) · 위아래 8 · 제목과 오른쪽 버튼 사이 10.
// 오른쪽 작은 글 버튼은 위아래 −8 · 오른쪽 −14 로 스스로 번져 머리가 버튼 높이(36)가 되고 글 끝이 화면 여백 24 에 선다(list-header.yaml action.marginY −8 · 보이는 36 · 누르는 44).
// 오른쪽 동작이 머리 폭의 절반을 넘으면 제목 아래 줄 오른쪽 끝으로 내려간다(제목 최소 50% · 줄바꿈 — 03-G 결정 4A)
export const listHeaderVariants = cva(
  "m-0 flex w-full tracking-normal items-center justify-between gap-x2_5 px-global-gutter py-x2 font-sans text-t4 flex-wrap [&>:first-child:not(:last-child)]:min-w-[50%] [&>:first-child:not(:last-child)]:flex-1 [&>:last-child:not(:first-child)]:ml-auto [&>button:last-child:not(:first-child)]:-my-x2 [&>button:last-child:not(:first-child)]:-mr-x3_5",
  {
    variants: {
      variant: {
        mediumWeak: "font-medium text-fg-neutral-subtle",
        boldSolid: "font-bold text-fg-neutral",
      },
    },
    defaultVariants: { variant: "mediumWeak" },
  },
);

// 내용 줄의 앞 타일 — 40 · 모서리 12(크기 × 0.3), 아이콘 20. 바탕 · 아이콘 색은 부르는 쪽이 카테고리 색(chart-{색}-weak · chart-{색})으로 준다
export const listTileVariants = cva(
  "inline-grid size-x10 shrink-0 place-items-center rounded-r3 [&>svg]:size-x5",
);

// ── 하위 줄 ─────────────────────────────────────────────────
// 줄 앞 꺾쇠 단추 — 보이는 상자 = 누르는 영역 44 · 모서리 10 · 단추 뒤 4. 줄과 따로 눌린다(줄의 누름 바탕은 생기지 않는다):
// 올리거나 누르면 단추만 bg-layer-default-pressed, 누르면 2px 거리 축소(기준 44 → 0.955). 키보드 포커스에만 단추 안쪽 2px 링.
// 위아래 2 를 줄의 여백에 겹쳐 타일 40 줄의 높이(64)를 그대로 둔다. 줄의 버튼 ::after 위(z 1)에 놓인다
export const listExpandButtonVariants = cva(
  [
    "relative z-1 -my-x0_5 mr-x1 inline-flex size-[44px] shrink-0 cursor-pointer appearance-none items-center justify-center rounded-r2_5 border-0 bg-transparent p-0 text-fg-neutral-subtle",
    "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
    "[--press-basis:44] [@media(hover:hover)]:hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
  ].join(" "),
);

// 꺾쇠 20 — 접혀 있으면 오른쪽(0°), 펼치면 아래(90° · 300ms easing, 모션 줄이기면 바로)
export const listExpandIconVariants = cva(
  "size-x5 shrink-0 [transition:rotate_var(--motion-duration-d6)_var(--motion-ease-easing)] motion-reduce:transition-none",
  {
    variants: { open: { true: "rotate-90", false: "rotate-0" } },
    defaultVariants: { open: false },
  },
);

// 하위가 없는 부모 줄 · 늘 펼쳐 두는 화면 — 꺾쇠 단추와 같은 폭의 빈 자리(부모 타일이 모두 52 에 선다)
export const LIST_EXPAND_SLOT = "-my-x0_5 mr-x1 size-[44px] shrink-0";
