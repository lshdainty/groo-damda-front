// Attachment Input 을 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본은 눌러 보는 틀(Probe) 안의 Attachment Input 이다(attachment-input.demo.tsx). 검사기는 견본의 첫 요소(틀)의 가운데를 올리고 ·
// 누르고 · 초점을 준다 — 컨트롤의 가운데에는 아무 부품도 없어, 틀이 시험할 부품(첨부 타일 · × · 다시 시도)의 가운데가 틀의 가운데가
// 되도록 안쪽 여백을 맞추고 그 부품에 data-probe 를 단다. 초점은 틀이 시험 부품으로 넘긴다. 올림 · 누름 · 초점으로 달라지는 값
// (trigger.background · removeButton.background · focusRing)은 그 부품(data-probe)에서만 잰다 — 같은 상태의 다른 부품을 올린 것이 아니다.
// 드롭존의 끌어 들어옴(dragOver)은 견본이 진짜 dragenter 를 보내 만든다. 올리는 중 견본은 진행 값(progress)을 주지 않는다 — 값이 10초 동안
// 멈춘 올리기는 실패로 보이므로(스펙 Status), 값을 준 정지 견본은 재는 도중 실패로 바뀐다. 원의 크기는 값 없는 원으로 잰다.
//
// 재지 않는 값 — 까닭
//   trigger.borderWidth · borderColor · item.borderWidth · borderColor · removeButton.borderWidth · borderColor
//                          CSS 테두리가 아니라 안쪽 1px 그림자(box-shadow inset) · ::after 다 — 검사기는 그림자를 테두리로 읽지 못한다.
//                          attachment-input.test.tsx 가 클래스를 본다.
//   removeButton.radius · offset  rounded-full 의 계산값은 아주 큰 수(원), 걸침(−4)은 음수 위치 — px 비교 밖이다. 테스트가 클래스를 본다.
//   removeButton.touchTarget · touchExtend · removeMask.*  보이지 않는 ::before 여백 · mask-image 그라디언트 — 가상 요소 · 그림이라
//                          못 잰다. 테스트가 클래스를 본다.
//   *.scale · scaleDuration · scaleEasing · transition*  누름 · 끌기 축소(2px 거리 — calc 비율)와 시간 · 곡선 — 문장 · 시간 값이다.
//   item.scale · dragging 의 값  끄는 중(dnd-kit 이 끌 때만 생긴다)은 견본으로 만들 수 없다 — attachment-input.test.tsx 가 키보드로 들어
//                          data-dragging 과 클래스를 본다.
//   items.overflowX · bleedX · fog  가로 스크롤 줄 · 화면 가장자리까지 넓힘 · 끝 흐림 — 문장 값이다(Scroll Fog 가 따로 잰다).
//   *.display(보임 · none) · name.maxLines · name.overflow · itemMenu.* · pickButton(variant · size · label · prefixIcon · width) ·
//   dropzone.dropTarget · count.typography 의 fontWeight(400)  문장 · 동작 값이다 — 테스트가 맡는다. 파일 선택 버튼의 크기 large
//                          는 1280 미만에서만 보여(lg:hidden) 1440 폭 카탈로그에서는 잴 수 없다 — 테스트가 클래스를 본다.
const GROUP = "[data-slot=attachment-input]";
const TRIGGER = "[data-slot=attachment-input-trigger]";
const ITEM = "[data-slot=attachment-input-item]";
const REMOVE = "[data-slot=attachment-input-remove]";
const RETRY = "[data-slot=attachment-input-retry]";
const DROPZONE = "[data-slot=attachment-input-dropzone]";
const PROBE = "[data-probe]";

export default {
  "root.gap": [GROUP, "px", "row-gap"],
  "items.gap": ["[data-slot=attachment-input-items]", "px", "column-gap"],
  "items.paddingTop": ["[data-slot=attachment-input-row]", "px", "padding-top"],
  "trigger.size": [TRIGGER, "px", "width"],
  "trigger.radius": [TRIGGER, "px", "border-top-left-radius"],
  "trigger.background": [`${TRIGGER}${PROBE}`, "color", "background-color"],
  "trigger.gap": [TRIGGER, "px", "row-gap"],
  "trigger.cursor": [`${TRIGGER}${PROBE}`, "exact", "cursor"],
  "triggerIcon.size": [`${TRIGGER} > svg`, "px", "width"],
  "triggerIcon.color": [`${TRIGGER} > svg`, "color", "color"],
  "count.typography": ["[data-slot=attachment-input-count]", "typography"],
  "count.fontWeight": [
    "[data-slot=attachment-input-count]",
    "exact",
    "font-weight",
  ],
  "count.foreground": [
    "[data-slot=attachment-input-count] > span:first-child",
    "color",
    "color",
  ],
  "countMax.typography": [
    "[data-slot=attachment-input-count] > span:last-child",
    "typography",
  ],
  "countMax.fontWeight": [
    "[data-slot=attachment-input-count] > span:last-child",
    "exact",
    "font-weight",
  ],
  "countMax.foreground": [
    "[data-slot=attachment-input-count] > span:last-child",
    "color",
    "color",
  ],
  "item.height": [ITEM, "px", "height"],
  "item.width": [ITEM, "px", "width"],
  "item.radius": [ITEM, "px", "border-top-left-radius"],
  "item.gap": [ITEM, "px", "column-gap"],
  "item.paddingX": [ITEM, "px", "padding-left"],
  "item.cursor": [ITEM, "exact", "cursor"],
  "item.opacity": [ITEM, "exact", "opacity"],
  "image.radius": [
    "[data-slot=attachment-input-image]",
    "px",
    "border-top-left-radius",
  ],
  "image.objectFit": [
    "[data-slot=attachment-input-image]",
    "exact",
    "object-fit",
  ],
  "thumbnail.size": ["[data-slot=attachment-input-thumbnail]", "px", "width"],
  "thumbnail.radius": [
    "[data-slot=attachment-input-thumbnail]",
    "px",
    "border-top-left-radius",
  ],
  "thumbnail.background": [
    "[data-slot=attachment-input-thumbnail]",
    "color",
    "background-color",
  ],
  "thumbnailIcon.size": [
    "[data-slot=attachment-input-thumbnail] > svg:not([data-slot])",
    "px",
    "width",
  ],
  "thumbnailIcon.color": [
    "[data-slot=attachment-input-thumbnail] > svg:not([data-slot])",
    "color",
    "color",
  ],
  "meta.gap": [
    "[data-slot=attachment-input-meta]",
    "px",
    "row-gap",
    { skipIf: "meta.display" },
  ],
  "meta.width": [
    "[data-slot=attachment-input-meta]",
    "px",
    "width",
    { skipIf: "meta.display" },
  ],
  "name.typography": ["[data-slot=attachment-input-name]", "typography"],
  "name.fontWeight": [
    "[data-slot=attachment-input-name]",
    "exact",
    "font-weight",
  ],
  "name.foreground": ["[data-slot=attachment-input-name]", "color", "color"],
  "name.wordBreak": [
    "[data-slot=attachment-input-name]",
    "exact",
    "word-break",
  ],
  "name.maskClear": ["[data-slot=attachment-input-name-clear]", "px", "width"],
  "size.typography": ["[data-slot=attachment-input-size]", "typography"],
  "size.fontWeight": [
    "[data-slot=attachment-input-size]",
    "exact",
    "font-weight",
  ],
  "size.foreground": ["[data-slot=attachment-input-size]", "color", "color"],
  "backdrop.background": [
    "[data-slot=attachment-input-backdrop]",
    "color",
    "background-color",
  ],
  "progressCircle.size": ["[data-slot=progress-circle]", "px", "width"],
  "actionButton.gap": [RETRY, "px", "row-gap"],
  "actionButton.iconSize": [`${RETRY} > svg`, "px", "width"],
  "actionButton.typography": [RETRY, "typography"],
  "actionButton.fontWeight": [RETRY, "exact", "font-weight"],
  "actionButton.color": [RETRY, "color", "color"],
  "badge.height": ["[data-slot=attachment-input-badge]", "px", "height"],
  "badge.paddingX": [
    "[data-slot=attachment-input-badge]",
    "px",
    "padding-left",
  ],
  "badge.background": [
    "[data-slot=attachment-input-badge]",
    "color",
    "background-color",
  ],
  "badge.typography": ["[data-slot=attachment-input-badge]", "typography"],
  "badge.fontWeight": [
    "[data-slot=attachment-input-badge]",
    "exact",
    "font-weight",
  ],
  "badge.foreground": ["[data-slot=attachment-input-badge]", "color", "color"],
  "removeButton.size": [REMOVE, "px", "width"],
  "removeButton.background": [`${REMOVE}${PROBE}`, "color", "background-color"],
  "removeButton.iconSize": [`${REMOVE} > svg`, "px", "width"],
  "removeButton.iconColor": [`${REMOVE} > svg`, "color", "color"],
  "removeButton.cursor": [REMOVE, "exact", "cursor"],
  "dropzone.minHeight": [DROPZONE, "px", "min-height"],
  "dropzone.gap": [DROPZONE, "px", "row-gap"],
  "dropzone.paddingX": [DROPZONE, "px", "padding-left"],
  "dropzone.radius": [DROPZONE, "px", "border-top-left-radius"],
  "dropzone.borderWidth": [DROPZONE, "px", "border-top-width"],
  "dropzone.borderStyle": [DROPZONE, "exact", "border-top-style"],
  "dropzone.borderColor": [DROPZONE, "color", "border-top-color"],
  "dropzone.background": [DROPZONE, "color", "background-color"],
  "dropzone.alignItems": [DROPZONE, "exact", "align-items"],
  "dropzoneLabel.typography": [
    "[data-slot=attachment-input-dropzone-label]",
    "typography",
  ],
  "dropzoneLabel.fontWeight": [
    "[data-slot=attachment-input-dropzone-label]",
    "exact",
    "font-weight",
  ],
  "dropzoneLabel.foreground": [
    "[data-slot=attachment-input-dropzone-label]",
    "color",
    "color",
  ],
  "pickButton.background": [
    `${DROPZONE} [data-slot=attachment-input-pick]`,
    "color",
    "background-color",
  ],
  // 링은 키보드 포커스에만 나타난다 — 포커스한 견본에서만 잰다(:focus-visible)
  "focusRing.width": [`${PROBE}:focus-visible`, "px", "outline-width"],
  "focusRing.offset": [`${PROBE}:focus-visible`, "px", "outline-offset"],
  "focusRing.color": [`${PROBE}:focus-visible`, "color", "outline-color"],
};
