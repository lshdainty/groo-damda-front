// Date Picker 를 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본은 두 가지다.
//   달력 견본(selection × visibleRange, 상태 enabled) — 달력 전체(root)가 견본의 첫 요소. 폭 · 머리 · 제목 · 요일 · 달 이름 · 칩 줄 · 안개 · 휠을 잰다.
//   날짜 칸 견본(상태마다 한 줄) — 일곱 칸짜리 한 주(GRID)가 첫 요소이고 가운데 칸(data-probe)이 재는 날이다. 호버 · 누름 · 키보드 초점은
//     검사기가 한 주의 가운데(= 그 칸)를 올리고 · 누르고 · 탭해서 만든다. 날짜 상태는 달력 안에서 쓰는 방식 그대로 DayCell 이 그린다.
// 날짜 원 · 기간 띠 · 초점 링은 진짜 요소(span)라 계산된 스타일을 읽을 수 있다(가상 요소가 아니다).
//
// 재지 않는 것 — date-picker.test.tsx 가 클래스 · 속성으로 본다
//   root.height(continuous)  "시트에 맞춘다" — 문장
//   wheel.columns            "연 120 · 월 96" — 문장(칼럼 폭은 클래스 w-[120px] · w-[96px] 를 테스트가 본다)
//   cell.weeks               6 · "그 달의 주 수" — 칸 개수. 테스트가 줄 수 · 칸 수를 센다
//   presets.chip             "Chip outlineStrong medium 36" — 문장(칩은 chip.measure.mjs 가 잰다). 고름 · 막힘은 테스트
//   footer.paddingTop        바닥은 시트 · 팝오버의 것이다 — 이 컴포넌트는 그리지 않는다(쓰는 쪽이 "완료" 를 둔다)
//   dayVisual.transitionDuration · transitionEasing  시간 값 — 계산된 값은 "0.15s" · cubic-bezier 로 적혀 글자 그대로 맞지 않는다
//   *.typography 의 글꼴 계열  font-sans 가 src/index.css 의 목록으로 풀려 스펙 글과 글자 그대로 맞지 않는다 — 크기 · 줄 높이만 잰다
//   hovered · pressed 의 오늘 · 기간 사이 날 한 단계 짙은 색 — 스펙의 note 문장이고 값이 아니다. 테스트가 클래스를 본다
const PROBE = "[data-probe]";
const VISUAL = `${PROBE} [data-slot=date-picker-day-visual]`;
const LABEL = `${PROBE} [data-slot=date-picker-day]`;
const RING = `${PROBE} [data-slot=date-picker-day-ring]`;
const BAND = `${PROBE} [data-slot=date-picker-band]`;
// 날짜 칸이 누르는 자리 — 날짜는 버튼, 앞뒤 달은 숫자 칸
const PRESS = `${PROBE} :is(button, [data-slot=date-picker-outside])`;

export default {
  // ── 달력 ──
  "root.width": ["root", "px", "width"],
  "root.background": ["root", "color", "background-color"],
  "root.columnGap": ["[data-slot=date-picker-months]", "px", "column-gap"],
  "header.height": ["[data-slot=date-picker-header]", "px", "height"],
  "title.typography": ["[data-slot=date-picker-title]", "typography"],
  "title.fontWeight": ["[data-slot=date-picker-title]", "exact", "font-weight"],
  "title.foreground": ["[data-slot=date-picker-title]", "color", "color"],
  "title.paddingX": ["[data-slot=date-picker-title]", "px", "padding-left"],
  "title.gap": ["[data-slot=date-picker-title]", "px", "column-gap"],
  "title.radius": [
    "[data-slot=date-picker-title]",
    "px",
    "border-top-left-radius",
  ],
  "titleIcon.size": ["[data-slot=date-picker-title-icon]", "px", "width"],
  "titleIcon.color": ["[data-slot=date-picker-title-icon]", "color", "color"],
  "navButton.size": ["[data-slot=date-picker-previous]", "px", "width"],
  "navButton.iconSize": ["[data-slot=date-picker-previous] svg", "px", "width"],
  // 막힌 이전 · 다음(연 · 월 휠이 열린 동안)은 fg-disabled 라 막히지 않은 것만 잰다
  "navButton.color": [
    "[data-slot=date-picker-previous]:not(:disabled)",
    "color",
    "color",
  ],
  "weekday.height": ["[data-slot=date-picker-weekdays]", "px", "height"],
  "weekday.position": ["[data-slot=date-picker-weekdays]", "exact", "position"],
  "weekday.typography": ["[data-slot=date-picker-weekday]", "typography"],
  "weekday.fontWeight": [
    "[data-slot=date-picker-weekday]",
    "exact",
    "font-weight",
  ],
  "weekday.foreground": ["[data-slot=date-picker-weekday]", "color", "color"],
  "cell.height": ["[data-slot=date-picker-cell]", "px", "height"],
  "monthLabel.height": ["[data-slot=date-picker-month-label]", "px", "height"],
  "monthLabel.typography": [
    "[data-slot=date-picker-month-label]",
    "typography",
  ],
  "monthLabel.fontWeight": [
    "[data-slot=date-picker-month-label]",
    "exact",
    "font-weight",
  ],
  "monthLabel.foreground": [
    "[data-slot=date-picker-month-label]",
    "color",
    "color",
  ],
  "monthLabel.paddingX": [
    "[data-slot=date-picker-month-label]",
    "px",
    "padding-left",
  ],
  "wheel.height": ["[data-slot=date-picker-wheel]", "px", "height"],
  "wheel.background": [
    "[data-slot=date-picker-wheel]",
    "color",
    "background-color",
  ],
  "fog.height": ["[data-slot=date-picker-fog]", "px", "height"],
  // 칩 줄 — 어디서나 한 줄 가로 스크롤이라 안쪽 스크롤 칸이 칩 사이를 벌린다(#255). 아래 12 는 묶음
  "presets.gap": [
    "[data-slot=date-picker-presets] [data-slot=chip-scroll-row]",
    "px",
    "column-gap",
  ],
  "presets.paddingBottom": [
    "[data-slot=date-picker-presets]",
    "px",
    "padding-bottom",
  ],

  // ── 날짜 칸 ──
  "cell.cursor": [PRESS, "exact", "cursor"],
  "dayVisual.size": [VISUAL, "px", "width"],
  "dayVisual.radius": [VISUAL, "px", "border-top-left-radius"],
  "dayVisual.background": [VISUAL, "color", "background-color"],
  "dayVisual.transitionProperty": [VISUAL, "exact", "transition-property"],
  "dayLabel.typography": [LABEL, "typography"],
  "dayLabel.fontWeight": [LABEL, "exact", "font-weight"],
  "dayLabel.foreground": [LABEL, "color", "color"],
  "dayLabel.textDecoration": [LABEL, "exact", "text-decoration-line"],
  "rangeBand.height": [BAND, "px", "height"],
  "rangeBand.background": [BAND, "color", "background-color"],
  "focusRing.width": [RING, "px", "outline-width"],
  "focusRing.offset": [RING, "px", "outline-offset"],
  "focusRing.color": [RING, "color", "outline-color"],
};
