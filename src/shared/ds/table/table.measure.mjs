// Table 을 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다. 값은 src/shared/ds/spec/table.json.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본의 뿌리는 견본 틀(div)이다 — 표 상자 · 일괄 작업 바(표 위)를 함께 담으므로 모든 값을 data-slot 으로 찾는다.
// 줄 선은 칸의 아래 테두리라 머리 줄 · 본문 줄의 선은 그 줄의 칸에서 잰다. 머리 칸 · 본문 칸의 좌우 16 은 첫 칸(24)이 아닌
// 가운데 칸에서 잰다 — 견본이 가운데 칸에 정렬 버튼 없는 열을 둔다. 줄이 누르는 줄이어야 커서(pointer)가 맞으므로 견본의 줄은 누르는 줄이다.
// 호버 · 누름은 검사기가 견본 틀 가운데를 올리고 누르므로, 줄을 보는 견본은 줄이 가운데에 오게(머리 줄 + 줄 하나), 정렬 버튼을
// 보는 견본은 머리 줄만 두어 가운데가 정렬 버튼이 되게 짰다(table.demo.tsx). 키보드 포커스는 견본 틀이 안의 버튼 · 링크로 넘긴다.
//
// 재지 않는 값 — table.test.tsx 가 클래스 · 속성으로 본다
//   root.paddingX  "24" — 첫 칸 앞 · 끝 칸 뒤만 24(칸의 first · last 여백)이고 표 상자 자체의 여백은 0 이다(줄 선이 상자 끝까지 간다)
//   caption.display  "숨긴 글" — 문장이다(sr-only)
//   headerRow.position · zIndex  표 상자가 스스로 스크롤할 때만 붙는다 — 페이지 스크롤 견본에는 없다(sticky 견본은 따로 두고 test 가 본다)
//   cell.alignItems  "center" — 칸은 표 칸이라 vertical-align: middle 이다(align-items 가 아니다)
//   thumbnail.size  Image Frame 1:1 48 — 쓰는 쪽 부품이다(표는 그림 ↔ 글 12 만 정한다)
//   badge.size  "Badge medium" · checkbox.display · checkbox.touchTarget · moreButton.touchTarget  문장이다
//   sortButton.width  "칸 전체" — 문장이다(table.test.tsx)
//   row.transitionDuration · transitionEasing  시간 값
//   width: narrow  768 미만은 표를 그리지 않고 쓰는 쪽이 List 줄로 그린다 — 카탈로그의 "폰" 견본이 List 이고 list 견본이 잰다
//   글꼴(fontFamily)  font-sans 가 src/index.css 의 --font-sans 로 풀려 스펙 글과 글자 그대로 맞지 않는다
const TABLE = "[data-slot=table]";
const HEAD_ROW = "[data-slot=table-header] tr";
const HEAD = "[data-slot=table-head]";
// 가운데 칸 — 첫 칸(24) · 끝 칸(24)이 아니고 정렬 버튼(여백을 버튼이 가진다)이 아닌 머리 칸
const HEAD_MID = `${HEAD}:not(:first-child):not(:last-child):not(:has([data-slot=table-sort-button]))`;
const BODY_ROW = "[data-slot=table-body] tr";
const BODY_CELLS = "[data-slot=table-body] tr > *";
// 가운데 칸 — 72 줄(rich)도 칸 위아래 12(cell.paddingY 12 — 72 는 최소 높이, 2026-11-09) — 한 줄 표와 같은 키로 잰다
const CELL_MID = `${TABLE} [data-slot=table-cell]:not(:first-child):not(:last-child)`;
const CELL_MID_ANY = `${TABLE} [data-slot=table-cell]:not(:first-child):not(:last-child)`;
const BAR = "[data-slot=table-bulk-bar]";
// 지금 방향의 화살표(정렬된 열) · 정렬할 수 있는 열이면 ↑ — 둘 다 흐린 색
const ACTIVE_ARROW = `${HEAD}[aria-sort=ascending] [data-arrow=up], ${HEAD}[aria-sort=descending] [data-arrow=down], ${HEAD}:not([aria-sort]) [data-arrow=up]`;

export default {
  "root.background": [TABLE, "color", "background-color"],
  "root.overflowX": [TABLE, "exact", "overflow-x"],
  "headerRow.minHeight": [HEAD_ROW, "px", "height"],
  "headerRow.background": [HEAD_ROW, "color", "background-color"],
  "headerRow.borderBottomWidth": [HEAD, "px", "border-bottom-width"],
  "headerRow.borderBottomColor": [HEAD, "color", "border-bottom-color"],
  "headerCell.paddingY": [HEAD_MID, "px", "padding-top"],
  "headerCell.paddingX": [HEAD_MID, "px", "padding-left"],
  "headerCell.typography": [HEAD, "typography"],
  "headerCell.lineHeight": [HEAD, "px", "line-height"],
  "headerCell.fontWeight": [HEAD, "exact", "font-weight"],
  "headerCell.foreground": [HEAD, "color", "color"],
  "headerCell.textAlign": [HEAD, "exact", "text-align"],
  "row.minHeight": [BODY_ROW, "px", "height"],
  "row.borderBottomWidth": [BODY_CELLS, "px", "border-bottom-width"],
  "row.borderBottomColor": [BODY_CELLS, "color", "border-bottom-color"],
  "row.background": [BODY_ROW, "color", "background-color"],
  "row.cursor": [BODY_ROW, "exact", "cursor"],
  "row.transitionProperty": [BODY_ROW, "exact", "transition-property"],
  "cell.paddingY": [CELL_MID, "px", "padding-top"],
  "cell.paddingX": [CELL_MID_ANY, "px", "padding-left"],
  "cell.typography": [CELL_MID_ANY, "typography"],
  "cell.lineHeight": [CELL_MID_ANY, "px", "line-height"],
  "cell.fontWeight": [CELL_MID_ANY, "exact", "font-weight"],
  "cell.foreground": [CELL_MID_ANY, "color", "color"],
  "cell.textAlign": [CELL_MID_ANY, "exact", "text-align"],
  "cell.numerals": [CELL_MID_ANY, "exact", "font-variant-numeric"],
  "detail.typography": ["[data-slot=table-cell-detail]", "typography"],
  "detail.foreground": ["[data-slot=table-cell-detail]", "color", "color"],
  "detail.gap": ["[data-slot=table-cell-text]", "px", "row-gap"],
  "thumbnail.gap": ["[data-slot=table-cell-content]", "px", "column-gap"],
  "checkbox.size": [
    "[data-slot=table-select-cell] [role=checkbox]",
    "px",
    "width",
  ],
  "moreButton.size": ["[data-slot=table-more-button]", "px", "width"],
  "bulkBar.minHeight": [BAR, "px", "min-height"],
  "bulkBar.paddingX": [BAR, "px", "padding-left"],
  "bulkBar.radius": [BAR, "px", "border-top-left-radius"],
  "bulkBar.background": [BAR, "color", "background-color"],
  "bulkBar.gap": [BAR, "px", "column-gap"],
  "bulkBar.marginBottom": [BAR, "px", "margin-bottom"],
  "sortButton.gap": ["[data-slot=table-sort-button]", "px", "column-gap"],
  "sortButton.cursor": ["[data-slot=table-sort-button]", "exact", "cursor"],
  "sortButton.background": [
    "[data-slot=table-sort-button]",
    "color",
    "background-color",
  ],
  "sortIcon.size": ["[data-slot=table-sort-icon]", "px", "width"],
  "sortIcon.color": [ACTIVE_ARROW, "color", "stroke"],
  // 포커스 링 — 키보드 포커스를 받은 정렬 버튼 · 이름 링크(안쪽 링)
  "focusRing.width": [
    "[data-slot=table-sort-button]:focus-visible, [data-slot=table-row-link]:focus-visible",
    "px",
    "outline-width",
  ],
  "focusRing.offset": [
    "[data-slot=table-sort-button]:focus-visible, [data-slot=table-row-link]:focus-visible",
    "px",
    "outline-offset",
  ],
  "focusRing.color": [
    "[data-slot=table-sort-button]:focus-visible, [data-slot=table-row-link]:focus-visible",
    "color",
    "outline-color",
  ],
};
