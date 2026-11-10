// Top Navigation 을 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
//
// 견본의 뿌리는 바(<header>)다 — 스펙의 root. 높이 56 은 안쪽 줄(top-navigation-row)이 잰다(바 자신은 위 안전 영역이 더해져 있을 수 있다 —
// 크로미움은 안전 영역이 0 이라 같다). 버튼 상태 견본은 바를 버튼 하나만 감싸게(w-fit) 그려 가운데가 버튼이다(검사기가 가운데를 올리고 누른다).
//
// 재지 않는 값(문장 · 시간 · 합성이라 계산값이 스펙의 글과 같지 않은 것) — top-navigation.test.tsx 가 맡는다
//   root.position · root.shadow 의 위치 규칙       sticky 는 "맨 위에 붙음(sticky)" 문장 — 클래스를 본다(그림자 none 은 잰다)
//   title.lineClamp                                한 줄 말줄임 — truncate 클래스
//   title.marginLeft                               "화면 끝 → 제목 16 · 56" 은 바의 6 을 포함한 거리다 — 제목 자신의 margin 은 10 · 6(왼쪽 버튼이 없으면 50)
//   trailing.gap · trailing.items                  버튼끼리 붙음(flex 에 gap 없음) · 개수는 문장
//   iconButton.touchTarget                         "44 × 44" 문장 — 상자 44 를 size 가 잰다
//   *.transitionProperty · Duration · Easing       계산값이 "background-color, scale" · "0.15s" · cubic-bezier(…) 라 스펙의 글과 같지 않다
//   *.scale · scaleDuration · scaleEasing          2px 거리 축소 — 누름의 scale 은 문장 · 시간
//   screenTitle.* · screenDescription.* · screenActions.*   본문 맨 위 제목 줄(ScreenTitle)은 바(견본의 뿌리) 밖에 그려져 검사기가 뿌리 안에서 찾지 못한다 — top-navigation.test.tsx 가 클래스(text-screen-title · text-t5 · text-fg-neutral-muted · gap-x4 · gap-x2 · items-end · mt-x0_5)로 잠근다
//   title.display · leading.glyph · primaryButton.buttonSize   문장
const ICON = "[data-slot=top-navigation-icon-button]";
const ICON_PLAIN = `${ICON}:not([aria-pressed=true])`;
const TEXT = "[data-slot=top-navigation-text-button]";

export default {
  "root.height": ["[data-slot=top-navigation-row]", "px", "height"],
  "root.paddingX": ["root", "px", "padding-right"],
  "root.paddingLeft": ["root", "px", "padding-left"],
  "root.paddingRight": ["root", "px", "padding-right"],
  "root.background": ["root", "color", "background-color"],
  "root.borderBottomWidth": ["root", "px", "border-bottom-width"],
  "root.shadow": ["root", "exact", "box-shadow"],
  "root.zIndex": ["root", "exact", "z-index"],
  "title.foreground": ["[data-slot=top-navigation-title]", "color", "color"],
  "title.fontWeight": [
    "[data-slot=top-navigation-title]",
    "exact",
    "font-weight",
  ],
  "title.typography": ["[data-slot=top-navigation-title]", "typography"],
  "title.gap": ["[data-slot=top-navigation-actions]", "px", "padding-left"],
  "iconButton.size": [ICON, "px", "width"],
  "iconButton.radius": [ICON, "px", "border-top-left-radius"],
  "iconButton.iconSize": [`${ICON} svg`, "px", "width"],
  "iconButton.strokeWidth": [`${ICON_PLAIN} svg`, "px", "stroke-width"],
  "iconButton.strokeWidthOn": [
    `${ICON}[aria-pressed=true] svg`,
    "px",
    "stroke-width",
  ],
  "iconButton.color": [ICON, "color", "color"],
  "iconButton.background": [ICON, "color", "background-color"],
  "iconButton.cursor": [ICON, "exact", "cursor"],
  "textButton.height": [TEXT, "px", "height"],
  "textButton.paddingX": [TEXT, "px", "padding-left"],
  "textButton.radius": [TEXT, "px", "border-top-left-radius"],
  "textButton.typography": [TEXT, "typography"],
  "textButton.fontWeight": [TEXT, "exact", "font-weight"],
  "textButton.foreground": [TEXT, "color", "color"],
  "textButton.background": [TEXT, "color", "background-color"],
  "textButton.cursor": [TEXT, "exact", "cursor"],
  "notification.size": ["[data-slot=notification-badge]", "px", "width"],
  "notification.background": [
    "[data-slot=notification-badge]",
    "color",
    "background-color",
  ],
  "notification.top": ["[data-slot=notification-badge]", "px", "top"],
  "notification.right": ["[data-slot=notification-badge]", "px", "right"],
  "primaryButton.marginRight": [
    "[data-slot=top-navigation-primary-button]",
    "px",
    "margin-right",
  ],
  "focusRing.width": ["button", "px", "outline-width"],
  "focusRing.offset": ["button", "px", "outline-offset"],
  "focusRing.color": ["button", "color", "outline-color"],
};
