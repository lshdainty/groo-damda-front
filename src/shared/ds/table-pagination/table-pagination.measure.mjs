// Table Pagination 을 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다. 값은
// src/shared/ds/spec/table-pagination.json. [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본의 뿌리는 견본 틀(div)이고 줄(role=group)은 그 안에 있다 — 모든 값을 data-slot 으로 찾는다. 화살표 값은 "다음" 칸에서 잰다
// (호버 · 누름 · 포커스도 같은 칸). 호버 · 누름은 검사기가 틀 가운데를 올리고 누르므로, 그 견본은 40 × 40 틀을 줄 오른쪽 끝에
// 맞춰 "다음" 칸이 틀 가운데에 오게 짰다(table-pagination.demo.tsx 의 OnNext). 키보드 포커스는 틀이 "다음" 칸으로 넘긴다.
//
// 재지 않는 값 — table-pagination.test.tsx 가 클래스 · 속성으로 본다
//   pageSize.size · pageRange.size  "Select medium" — 문장이다(Select 의 견본이 잰다. 이 컴포넌트는 size="medium" 을 고른다)
//   pageRange.maxHeight  열린 목록의 최대 높이 240 — 목록은 열려야 생긴다(Select 의 listMaxHeight 로 넘긴다 — test 가 본다)
//   pageRange.display · total.display  "글로만" · "none" — 문장이다(전체 수를 모르면 범위는 글이고 "/ 총 N개" 가 없다)
//   arrow.touchTarget  "40 × 44" — 문장이다(::before 가 위아래로 2 씩 넓힌다)
//   arrow.transitionProperty · transitionDuration · transitionEasing · scale  이 칸의 전환은 색과 축소 둘이 한 transition 에 있어
//     계산된 속성이 "background-color, scale" 이고 스펙의 색 규칙("background-color")과 글자 그대로 맞지 않는다. 시간 값이고
//     "2px 거리 축소" 는 문장이다 — test 가 클래스로 본다
//   글꼴(fontFamily)  font-sans 가 src/index.css 의 --font-sans 로 풀려 스펙 글과 글자 그대로 맞지 않는다
const PG = "[data-slot=table-pagination]";
const NEXT = "[data-slot=table-pagination-next]";
const SUFFIX = "[data-slot=table-pagination-suffix]";
const TOTAL = "[data-slot=table-pagination-total]";

export default {
  "root.minHeight": [PG, "px", "min-height"],
  "root.justifyContent": [PG, "exact", "justify-content"],
  "root.gap": [PG, "px", "column-gap"],
  "root.marginTop": [PG, "px", "margin-top"],
  "pageSize.minWidth": [
    "[data-slot=table-pagination-page-size] > div",
    "px",
    "min-width",
  ],
  "pageSize.gap": [
    "[data-slot=table-pagination-page-size]",
    "px",
    "column-gap",
  ],
  "pageSizeSuffix.typography": [SUFFIX, "typography"],
  "pageSizeSuffix.fontWeight": [SUFFIX, "exact", "font-weight"],
  "pageSizeSuffix.foreground": [SUFFIX, "color", "color"],
  "pageRange.minWidth": [
    "div[data-slot=table-pagination-range] > div",
    "px",
    "min-width",
  ],
  "pageRange.gap": [
    "div[data-slot=table-pagination-range]",
    "px",
    "column-gap",
  ],
  // 빈 표("0-0")의 막힌 범위 — 고르기 트리거의 글
  "pageRange.foreground": [
    "div[data-slot=table-pagination-range] [data-slot=select-value]",
    "color",
    "color",
  ],
  "total.typography": [TOTAL, "typography"],
  "total.fontWeight": [TOTAL, "exact", "font-weight"],
  "total.foreground": [TOTAL, "color", "color"],
  "total.numerals": [TOTAL, "exact", "font-variant-numeric"],
  "arrow.size": [NEXT, "px", "width"],
  "arrow.radius": [NEXT, "px", "border-top-left-radius"],
  "arrow.iconSize": [`${NEXT} > svg`, "px", "width"],
  "arrow.color": [NEXT, "color", "color"],
  "arrow.background": [NEXT, "color", "background-color"],
  "arrow.cursor": [NEXT, "exact", "cursor"],
  "focusRing.width": [`${NEXT}:focus-visible`, "px", "outline-width"],
  "focusRing.offset": [`${NEXT}:focus-visible`, "px", "outline-offset"],
  "focusRing.color": [`${NEXT}:focus-visible`, "color", "outline-color"],
};
