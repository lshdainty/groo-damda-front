// Field 를 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
// 라벨 · 설명 · 오류 · 글자 수는 레시피가 다는 id 의 끝말(<useId>label · description · error · count)로 찾는다.
// 재지 않는 값 — rem 으로 적은 값(필수 점 크기 · 위 · 왼쪽 여백, "선택" 왼쪽 여백 — 글자 크기 설정을 따라 커진다)은
// 검사기가 px 로 맞추지 않는다. form(Field 사이 24 · 나란한 두 칸 16 · 열)은 Field 가 아니라 Field 를 쌓는 폼 틀의 값이다.
export default {
  "root.direction": ["root", "exact", "flex-direction"],
  "root.gap": ["root", "px", "row-gap"],
  "header.paddingX": ["[data-slot=field-header]", "px", "padding-left"],
  "header.gap": ["[data-slot=field-header]", "px", "column-gap"],
  "header.alignItems": ["[data-slot=field-header]", "exact", "align-items"],
  "header.flexWrap": ["[data-slot=field-header]", "exact", "flex-wrap"],
  "label.typography": ["[id$=label]", "typography"],
  "label.wordBreak": ["[id$=label]", "exact", "word-break"],
  "label.fontWeight": ["[id$=label]", "exact", "font-weight"],
  "label.foreground": ["[id$=label]", "color", "color"],
  "requiredIndicator.color": [
    "[id$=label] > span[aria-hidden]",
    "color",
    "background-color",
  ],
  // "선택" 은 줄 높이만 라벨(22)에 맞춘다 — lineHeight 가 typography(t4 14/19)의 줄 높이를 덮는다
  "optionalIndicator.typography": [
    "[id$=label] > span:not([aria-hidden])",
    "typography",
    null,
    { skipIf: "optionalIndicator.lineHeight" },
  ],
  "optionalIndicator.lineHeight": [
    "[id$=label] > span:not([aria-hidden])",
    "px",
    "line-height",
  ],
  "optionalIndicator.foreground": [
    "[id$=label] > span:not([aria-hidden])",
    "color",
    "color",
  ],
  "headerAction.marginY": [
    "[data-slot=field-header-action]",
    "px",
    "margin-top",
  ],
  "footer.paddingX": ["[data-slot=field-footer]", "px", "padding-left"],
  "footer.gap": ["[data-slot=field-footer]", "px", "column-gap"],
  "footer.alignItems": ["[data-slot=field-footer]", "exact", "align-items"],
  "description.typography": ["[id$=description]", "typography"],
  "description.wordBreak": ["[id$=description]", "exact", "word-break"],
  "description.foreground": ["[id$=description]", "color", "color"],
  "descriptionIcon.size": [
    "[id$=description] > span[aria-hidden] > svg",
    "px",
    "width",
  ],
  "descriptionIcon.color": [
    "[id$=description] > span[aria-hidden]",
    "color",
    "color",
  ],
  "descriptionIcon.gap": [
    "[id$=description] > span[aria-hidden]",
    "px",
    "margin-right",
  ],
  "errorMessage.typography": ["[id$=error]", "typography"],
  "errorMessage.wordBreak": ["[id$=error]", "exact", "word-break"],
  "errorMessage.foreground": ["[id$=error]", "color", "color"],
  "errorIcon.size": ["[id$=error] > svg", "px", "width"],
  "errorIcon.color": ["[id$=error] > svg", "color", "color"],
  "errorIcon.gap": ["[id$=error] > svg", "px", "margin-right"],
  "characterCount.typography": ["[id$=count] > span:first-child", "typography"],
  "characterCount.foreground": [
    "[id$=count] > span:first-child",
    "color",
    "color",
  ],
  "maxCharacterCount.typography": [
    "[id$=count] > span:last-child",
    "typography",
  ],
  "maxCharacterCount.foreground": [
    "[id$=count] > span:last-child",
    "color",
    "color",
  ],
};
