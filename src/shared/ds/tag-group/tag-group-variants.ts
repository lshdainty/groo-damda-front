import { cva } from "class-variance-authority";

/*
 * Groo Tag Group — 구조는 SEED Tag Group(2026-10-03). 수치 원본은 groo-design
 * specs/components/tag-group.yaml(값은 src/shared/ds/spec/tag-group.json).
 * groo-design recipes/shadcn/components/ui/tag-group.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 이 파일은 변형 정의,
 * 컴포넌트는 tag-group.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 *   TagGroup       여러 메타 정보(카테고리 이름 · 자산 · 시각 · 거리 · 개수 · 금액)를 " · " 로 이은 글줄 — 묶음 <span>, 역할 없음
 *                  (목록 역할을 주지 않는다 — "목록, 항목 3개" 를 줄마다 읽지 않게). 항목 사이 구분은 묶음이 스스로 넣는다
 *   TagGroupItem   항목 — 글 하나 + 아이콘 하나(앞 prefixIcon 또는 뒤 suffixIcon — 앞뒤 모두 두지 않는다)
 *
 *   size      t2 12/16(기본) · t3 13/18 · t4 14/19 — 묶음에 하나(한 줄 안에서 섞지 않는다). 아이콘 12 · 13 · 14, 아이콘 ↔ 글 2
 *   tone      neutralSubtle(기본 — fg-neutral-subtle) · neutral(fg-neutral) · brand(fg-brand, 아껴서) — 항목마다 고른다
 *   weight    regular 400(기본) · bold 700 — 항목마다. 금액처럼 앞세울 항목 하나만 neutral · bold
 *             묶음의 tone · weight 는 항목의 기본값이다
 *   truncate  false(기본) — 넘치면 낱말 단위로 줄을 바꾼다(keep-all + break-word, v114 — 항목 사이 · 항목 안 띄어쓰기에서)
 *             true — 한 줄(inline-flex · 최대 폭 100%). 넘치면 항목 글이 각자 말줄임(…)하고 구분은 줄지 않는다.
 *             줄어드는 차례는 항목의 shrink — 기본 1, 0 은 줄지 않고 수가 클수록 먼저 · 많이 준다(금액처럼 꼭 보일 항목은 0).
 *             줄어드는 항목도 첫 글자 + "…" 까지만 — 항목 최소 폭 2.1em(+ 아이콘), 두 글자 이하면 글 폭(max-content)
 *
 * 구분 " · " 는 줄이 안 바뀌는 공백(U+00A0) · 가운뎃점(U+00B7) · 공백 — 앞 항목에 붙어, 줄이 바뀌면 앞 줄 끝에 남고 다음 줄은
 * 항목으로 시작한다. 아이콘은 그 글과 한 줄에 붙어 있다(아이콘만 줄 끝에 남지 않는다 — 항목 + 구분을 한 칸으로 묶어 칸 안은
 * 글 안 띄어쓰기에서만 줄을 바꾼다). 색은 톤과 관계없이 fg-disabled · 400(글보다 한 단계 흐린 장식). 보조 기술에는 구분을 숨기고 그 자리에
 * 보이지 않는 ", " 를 둔다 — "식비, 신한카드, 오후 2:10" 처럼 끊어 읽는다(SEED 는 "식비신한카드오후 2:10" 처럼 붙는다).
 * 빈 항목은 건너뛴다 — 자식이 null · false · "" 이거나, 글 · 아이콘이 모두 없는 TagGroupItem 이면 구분도 넣지 않는다.
 * 아이콘은 늘 aria-hidden(항목 글자색을 따른다). 뜻이 있는 아이콘(갈래 = 분할 · 눈 = 조회)은 srLabel 로 읽을 글을 준다 —
 * 주면 보이는 글 · 아이콘을 숨기고 그 글을 읽는다("분할 2건" · "조회 12"). 말줄임해도 글 전체를 읽는다.
 * 글은 글자 크기 설정을 따른다(rem) — wrap 이면 줄이 늘고, truncate 면 더 일찍 말줄임한다. 아이콘은 px 그대로다.
 * 누르지 않는다 — 상태가 없다. 막힌 줄 안이면 그 줄의 규칙(모든 글 fg-disabled)을 부르는 쪽이 className 으로 준다.
 */

// 묶음 — 글자는 묶음이 정한다(줄 상자 = 그 크기의 줄 높이). wrap 은 inline-block 이라 둘레 글의 줄 높이를 따르지 않는다
export const tagGroupVariants = cva("font-sans", {
  variants: {
    size: {
      t2: "text-t2",
      t3: "text-t3",
      t4: "text-t4",
    },
    truncate: {
      false: "inline-block break-keep [overflow-wrap:break-word]",
      // min-width 0 — 제목 옆처럼 flex 줄의 칸이어도 줄어들어 말줄임한다
      // overflow-x clip — 줄어들 수 없는 항목(shrink 0)만으로 칸 폭이 모자라면 "줄 끝이 잘린다"(tag-group.md). 자르지 않으면 넘친 글이 옆 칸(금액)을 덮는다
      true: "inline-flex min-w-0 max-w-full items-center overflow-x-clip whitespace-nowrap",
    },
  },
  defaultVariants: { size: "t2", truncate: false },
});

export const tagGroupItemVariants = cva("", {
  variants: {
    tone: {
      neutralSubtle: "text-fg-neutral-subtle",
      neutral: "text-fg-neutral",
      brand: "text-fg-brand",
    },
    weight: {
      regular: "font-normal",
      bold: "font-bold",
    },
    // wrap 은 글 흐름 안(inline — 항목 안 띄어쓰기에서도 줄이 바뀐다), truncate 는 한 줄의 칸(줄어들며 말줄임)
    truncate: {
      false: "inline",
      true: "inline-flex min-w-0 items-center",
    },
  },
  defaultVariants: {
    tone: "neutralSubtle",
    weight: "regular",
    truncate: false,
  },
});

// 줄어드는 항목의 최소 폭 — 글 칸에 첫 글자 + "…" 가 남는 2.1em(글자 크기를 따른다) + 아이콘(12 · 13 · 14) · 사이 2.
// 두 글자 이하인 글은 글 폭 그대로(max-content — 넓히지 않는다). 최소 폭은 항목 칸에 준다 — 글 칸(overflow hidden)의 최소 폭은
// 항목의 최소 크기로 올라가지 않는다. 사용자 결정 2026-10-17 — 03-E 결정 5 B (두 글자 이하 기준은 2026-10-21 확정)
const LABEL_MIN = "2.1em";
const ICON_PX = { t2: 12, t3: 13, t4: 14 } as const;
type GraphemeSegmenter = {
  segment(input: string): Iterable<{ segment: string }>;
};
const Segmenter = (
  Intl as unknown as {
    Segmenter?: new (
      locales: string | undefined,
      options: { granularity: "grapheme" },
    ) => GraphemeSegmenter;
  }
).Segmenter;
const graphemes = Segmenter
  ? new Segmenter(undefined, { granularity: "grapheme" })
  : null;
const graphemeCount = (text: string) =>
  graphemes
    ? Array.from(graphemes.segment(text)).length
    : Array.from(text).length;

export function tagGroupItemMinWidth(
  label: unknown,
  size: "t2" | "t3" | "t4",
  hasIcon: boolean,
): string {
  if (
    (typeof label === "string" || typeof label === "number") &&
    graphemeCount(String(label).trim()) <= 2
  )
    return "max-content";
  return hasIcon
    ? `calc(${LABEL_MIN} + ${ICON_PX[size]}px + var(--spacing-x0_5))`
    : LABEL_MIN;
}
