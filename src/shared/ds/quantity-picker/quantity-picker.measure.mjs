// Quantity Picker 를 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본은 두 모양이다(quantity-picker.demo.tsx).
//   · 눌러 보는 견본 — 검사기는 견본의 첫 요소 가운데를 올리고 · 누른다. 컨트롤 가운데는 값 칸(누르지 못한다)이라, 견본 틀을
//     버튼 하나 크기로 좁혀 컨트롤이 틀 밖으로 넘치게 둔다 — 틀의 가운데가 곧 시험할 버튼이다. 그 버튼(probe)에 틀이 data-probe 를 단다.
//       data-probe="normal"   막히지 않은 버튼 — 스펙의 button.* 이 걸리는 자리
//       data-probe="blocked"  끝에 닿아 막힌 버튼, 또는 최소의 지우기(removable) — 스펙의 decrement.* · increment.* 가 걸리는 자리
//   · fill 견본 — 부모 Flex(w 320)가 틀이다.
// 컨트롤(role=group)은 [data-slot=quantity-picker], 버튼 · 선 · 값 칸은 각자의 data-slot 이다.
// 키보드 포커스는 검사기가 틀에 주면 틀이 probe 버튼으로 넘긴다.
//
// 재지 않는 값 — 까닭
//   root.borderWidth · borderColor  CSS 테두리가 아니라 안쪽 그림자(box-shadow inset, 오류는 2px)다. 검사기는 그림자를 테두리로
//                                   읽지 못한다 — quantity-picker.test.tsx 가 클래스와 data-invalid 를 본다.
//   root.role · root.breakpoint · root.width("남은 폭")  역할 · 미디어 쿼리(lg:) · 비율 — 문장 값이다. 견본은 크기를
//                                   large · medium 으로 정해 둔다(카탈로그는 1440 폭). 테스트가 본다.
//   button.touchTarget · touchExtend  보이지 않는 ::before 여백 — 가상 요소라 못 고른다. 테스트가 클래스를 본다.
//   button.scale · scaleDuration · scaleEasing · transition*  누름 축소(2px 거리 — calc 비율)와 시간 · 곡선 — 문장 · 시간 값이다.
//   button.repeat · decrement.name · increment.name · *.ariaDisabled · value.minWidth · pointerEvents · ariaLive  동작 · 읽는 말 —
//                                   테스트가 맡는다.
//   progressCircle.display · icon.display  "보임" · "none" — 로딩 견본에서 원이 있고 아이콘이 없는지는 테스트가 본다.
//   value.typography 의 fontWeight(400)  값 칸은 500 이 이긴다(value.fontWeight) — 글자 크기 · 줄 높이만 잰다.
const BTN = "[data-probe=normal]";
const BLOCKED = "[data-probe=blocked]";
const PROBE = "[data-probe]";
const GROUP = "[data-slot=quantity-picker]";
const VALUE = "[data-slot=quantity-picker-value]";
const DIVIDER = "[data-slot=quantity-picker-divider]";
// 막히지 않은 버튼의 아이콘(막힌 버튼의 아이콘 색은 decrement.iconColor · increment.iconColor 가 맡는다)
const ICON = "button:not([data-probe=blocked]) > svg:not([data-slot])";

export default {
  // fill 은 부모 Flex 의 아이템이라 inline-flex 가 flex 로 바뀐다(CSS 가 아이템을 블록으로 바꾼다) — hug 견본에서만 잰다
  "root.display": [
    "[data-slot=quantity-picker][data-layout=hug]",
    "exact",
    "display",
  ],
  "root.background": [GROUP, "color", "background-color"],
  "root.minHeight": [GROUP, "px", "min-height"],
  "root.radius": [GROUP, "px", "border-top-left-radius"],
  "button.background": [BTN, "color", "background-color"],
  "button.cursor": [BTN, "exact", "cursor"],
  "button.size": ["button", "px", "width"],
  "button.radius": ["button", "px", "border-top-left-radius"],
  "decrement.background": [BLOCKED, "color", "background-color"],
  "decrement.cursor": [BLOCKED, "exact", "cursor"],
  "decrement.iconColor": [`${BLOCKED} > svg`, "color", "color"],
  "increment.background": [BLOCKED, "color", "background-color"],
  "increment.cursor": [BLOCKED, "exact", "cursor"],
  "increment.iconColor": [`${BLOCKED} > svg`, "color", "color"],
  "icon.size": ["button > svg:not([data-slot])", "px", "width"],
  "icon.color": [ICON, "color", "color"],
  "divider.width": [DIVIDER, "px", "width"],
  "divider.height": [DIVIDER, "px", "height"],
  "divider.background": [DIVIDER, "color", "background-color"],
  "value.foreground": [VALUE, "color", "color"],
  "value.fontWeight": [VALUE, "exact", "font-weight"],
  "value.fontVariantNumeric": [VALUE, "exact", "font-variant-numeric"],
  "value.textAlign": [VALUE, "exact", "text-align"],
  "value.paddingX": [VALUE, "px", "padding-left"],
  "value.flexGrow": [VALUE, "exact", "flex-grow"],
  "value.typography": [VALUE, "typography"],
  "progressCircle.size": ["[data-slot=progress-circle]", "px", "width"],
  "progressCircle.thickness": [
    "[data-slot=progress-circle-track]",
    "px",
    "stroke-width",
  ],
  "progressCircle.track": [
    "[data-slot=progress-circle-track]",
    "color",
    "stroke",
  ],
  "progressCircle.range": [
    "[data-slot=progress-circle-range]",
    "color",
    "stroke",
  ],
  "focusRing.width": [PROBE, "px", "outline-width"],
  "focusRing.offset": [PROBE, "px", "outline-offset"],
  "focusRing.color": [PROBE, "color", "outline-color"],
};
