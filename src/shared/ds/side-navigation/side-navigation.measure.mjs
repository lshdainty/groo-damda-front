// Side Navigation 을 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본의 뿌리는 사이드바(<nav>)다 — 스펙의 root. 상태 견본은 작은 사이드바(항목 하나 · 접기 버튼 하나)라 가운데가 그 단추다(검사기가 가운데를
// 올리고 누른다). 항목 · 아이콘 · 이름 · 꺾쇠는 견본의 첫 항목에서 잰다 — "지금 항목"(current) 견본은 첫 항목이 지금 화면이다.
// 이름 · 묶음 이름은 접히면 보이지 않게(sr-only) 남아 글자 값이 걸리지 않는다 — 보이는 이름(:not(.sr-only))에서만 잰다.
// 펼침 메뉴는 접힌 사이드바의 하위 부모를 눌러 연 견본(side-navigation.demo.tsx — 눌러 붙들어 둔다)에서 잰다. 검사기가 다른 견본을 누르면 닫혀
// 그 견본의 값은 재지 않고 넘어간다(없는 요소는 재지 않는다).
//
// 재지 않는 값(문장 · 합성 · 시간 · 의사 요소라 계산값이 스펙의 글과 같지 않은 것) — side-navigation.test.tsx 가 맡는다
//   root.borderColor · borderWidth · position · transition*   오른쪽 안쪽 1px 은 box-shadow(inset) · sticky 는 문장
//   header 아래 선(divider.*) · fog.*                          안쪽 그림자 · 마스크 — 내용이 스크롤됐을 때 · 늘 켜짐(마스크 이미지 합성)
//   groupDivider.*                                            ::before 의사 요소(묶음 사이 선 — 접혔을 때)
//   content.scrollPadding · item.transition* · *.scale ·
//   *.scaleDuration · *.scaleEasing · touchTarget · 여러 시간   문장 · 시간
//   flyout.offset · openDelay · closeDelay · shadow · tooltip.*   위치 · 기다림 · 그림자 합성 · 말풍선(Help Bubble) 값
//   flyoutItem.insetX · radius                                 알약의 좌우 8 · 모서리 12 는 안쪽 span · ::after 의 inset — 알약 바탕(background)은 span 에서 잰다
//   focusRing.radius                                           항목 10 · 접기 버튼 8 · 펼침 메뉴 줄 12 — 요소마다 달라 한 값으로 못 잰다
//   itemLabel.display · groupLabel.display · logo.display · chevron.display · subItem.display   문장("보이지 않게 · 보임")
const ITEM = "[data-slot=side-navigation-item]";
const LABEL = "[data-slot=side-navigation-item-label]:not(.sr-only)";
const GROUP_LABEL = "[data-slot=side-navigation-group-label]:not(.sr-only)";
const FLYOUT = "[data-slot=side-navigation-flyout]";
const FLYOUT_LABEL = "[data-slot=side-navigation-flyout-label]";
const FLYOUT_ITEM = "[data-slot=side-navigation-flyout-item]";
const PILL = `${FLYOUT_ITEM} > span[aria-hidden]`;
const LOGO = "[data-slot=side-navigation-logo]";
const TRIGGER = "[data-slot=side-navigation-trigger]";

export default {
  "root.width": ["root", "px", "width"],
  "root.background": ["root", "color", "background-color"],
  "root.zIndex": ["root", "exact", "z-index"],
  "header.minHeight": [
    "[data-slot=side-navigation-header]",
    "px",
    "min-height",
  ],
  "header.padding": ["[data-slot=side-navigation-header]", "px", "padding-top"],
  "logo.size": [`${LOGO} > svg`, "px", "width"],
  "logo.gap": [LOGO, "px", "column-gap"],
  "logo.typography": [LOGO, "typography"],
  "logo.fontWeight": [LOGO, "exact", "font-weight"],
  "logo.foreground": [LOGO, "color", "color"],
  "logo.marginLeft": [LOGO, "px", "margin-left"],
  "trigger.size": [TRIGGER, "px", "width"],
  "trigger.radius": [TRIGGER, "px", "border-top-left-radius"],
  "trigger.iconSize": [`${TRIGGER} > svg`, "px", "width"],
  "trigger.color": [TRIGGER, "color", "color"],
  "trigger.top": [TRIGGER, "px", "top"],
  "trigger.right": [TRIGGER, "px", "right"],
  "trigger.background": [TRIGGER, "color", "background-color"],
  "content.paddingTop": [
    "[data-slot=side-navigation-content]",
    "px",
    "padding-top",
  ],
  "content.paddingX": [
    "[data-slot=side-navigation-content]",
    "px",
    "padding-left",
  ],
  "content.paddingBottom": [
    "[data-slot=side-navigation-content]",
    "px",
    "padding-bottom",
  ],
  "content.gap": ["[data-slot=side-navigation-content]", "px", "row-gap"],
  "content.overflowY": [
    "[data-slot=side-navigation-content]",
    "exact",
    "overflow-y",
  ],
  "groupLabel.typography": [GROUP_LABEL, "typography"],
  "groupLabel.fontWeight": [GROUP_LABEL, "exact", "font-weight"],
  "groupLabel.foreground": [GROUP_LABEL, "color", "color"],
  "groupLabel.padding": [GROUP_LABEL, "px", "padding-top"],
  "item.minHeight": [ITEM, "px", "min-height"],
  "item.paddingX": [ITEM, "px", "padding-left"],
  "item.width": [ITEM, "px", "width"],
  "item.gap": ["[data-slot=side-navigation-item-content]", "px", "column-gap"],
  "item.radius": [ITEM, "px", "border-top-left-radius"],
  "item.background": [ITEM, "color", "background-color"],
  "item.cursor": [ITEM, "exact", "cursor"],
  "itemIcon.size": [
    "[data-slot=side-navigation-item-icon] > svg",
    "px",
    "width",
  ],
  "itemIcon.color": ["[data-slot=side-navigation-item-icon]", "color", "color"],
  "itemLabel.typography": [LABEL, "typography"],
  "itemLabel.fontWeight": [LABEL, "exact", "font-weight"],
  "itemLabel.foreground": [LABEL, "color", "color"],
  "itemLabel.paddingY": [LABEL, "px", "padding-top"],
  "chevron.size": ["[data-slot=side-navigation-chevron]", "px", "width"],
  "chevron.color": ["[data-slot=side-navigation-chevron]", "color", "color"],
  "chevron.rotate": ["[data-slot=side-navigation-chevron]", "exact", "rotate"],
  "chevron.transitionProperty": [
    "[data-slot=side-navigation-chevron]",
    "exact",
    "transition-property",
  ],
  "subItem.minHeight": [
    "[data-slot=side-navigation-sub-item]",
    "px",
    "min-height",
  ],
  "subItem.paddingLeft": [
    "[data-slot=side-navigation-sub-item]",
    "px",
    "padding-left",
  ],
  "footer.padding": ["[data-slot=side-navigation-footer]", "px", "padding-top"],
  "flyout.width": [FLYOUT, "px", "width"],
  "flyout.background": [FLYOUT, "color", "background-color"],
  "flyout.radius": [FLYOUT, "px", "border-top-left-radius"],
  "flyout.paddingY": [FLYOUT, "px", "padding-top"],
  "flyout.zIndex": [FLYOUT, "exact", "z-index"],
  "flyoutLabel.typography": [FLYOUT_LABEL, "typography"],
  "flyoutLabel.fontWeight": [FLYOUT_LABEL, "exact", "font-weight"],
  "flyoutLabel.foreground": [FLYOUT_LABEL, "color", "color"],
  "flyoutLabel.paddingY": [FLYOUT_LABEL, "px", "padding-top"],
  "flyoutLabel.paddingX": [FLYOUT_LABEL, "px", "padding-left"],
  "flyoutItem.minHeight": [FLYOUT_ITEM, "px", "min-height"],
  "flyoutItem.paddingX": [FLYOUT_ITEM, "px", "padding-left"],
  "flyoutItem.typography": [FLYOUT_ITEM, "typography"],
  "flyoutItem.fontWeight": [FLYOUT_ITEM, "exact", "font-weight"],
  "flyoutItem.foreground": [FLYOUT_ITEM, "color", "color"],
  "flyoutItem.background": [PILL, "color", "background-color"],
  "focusRing.width": ["a, button", "px", "outline-width"],
  "focusRing.offset": ["a, button", "px", "outline-offset"],
  "focusRing.color": ["a, button", "color", "outline-color"],
};
