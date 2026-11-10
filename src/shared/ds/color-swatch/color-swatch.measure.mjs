// Color Swatch 를 어디서 재나 — scripts/check-ds-spec.mjs(npm run ds:check)가 읽는다.
// [요소, 재는 법, CSS 속성, { skipIf }] — 형식은 검사기 머리 주석.
// 견본은 틀(div) 안의 묶음이다(틀이 키보드 포커스를 탭 자리 칸으로 넘긴다). 부위는 data-slot · [aria-checked=true] 로 찾는다.
// 스펙의 색(color 축)은 고른 칸에 칠해진다 — 견본은 그 색을 고른 채 두므로 칸의 색은 [aria-checked=true] 로 잰다
// (안 고른 견본에는 그 칸이 없어 재지 않는다 — 색은 고른 견본 10개가 전부 잰다).
// 고른 고리(ring.*)도 고른 칸에만 있어 같은 자리로 잰다.
// 재지 않는 값(color-swatch.test.tsx 가 맡는다)
//   group.columns · order · keyboard  격자 열 수 · 차례 · 키보드 — 글로 된 동작 값(테스트가 칸 차례 · 화살표를 본다)
//   swatch.touchTarget · name · tooltip  44 누르는 영역(::before) · 이름 · 툴팁 — 문장 값(테스트가 이름 · 툴팁을 본다)
//   check.display · ring.display  보임 · 숨김 — 고른 칸에만 그려진다(테스트)
//   swatch.scale · scaleDuration · scaleEasing  누름 축소 — 변환 · 시간 값(테스트)
//   focusRing.*  키보드 포커스 링은 ::after 가상 요소의 outline 이라 요소 값으로 잴 수 없다(테스트가 클래스를 본다)
//   divider.stackBelow  지금 색 칸 실제 폭 + 33 + 248 보다 좁으면 쌓인다(ResizeObserver 판정 — 견본 폭 360 은 옆으로 둔다, 테스트가 맡는다)
//   current.background · name · check.color(지금 색)  저장된 색 그대로 · 차트가 쓸 색 · 대비가 큰 쪽 — 문장 값
const SWATCH = "[data-slot=color-swatch]";
const CHECKED = "[role=radio][aria-checked=true]";
export default {
  "group.width": ["[data-slot=color-swatch-grid]", "px", "width"],
  "group.gap": ["[data-slot=color-swatch-grid]", "px", "row-gap"],
  "swatch.size": [SWATCH, "px", "width"],
  "swatch.radius": [SWATCH, "px", "border-top-left-radius"],
  "swatch.cursor": [SWATCH, "exact", "cursor"],
  "swatch.background": [
    `${CHECKED}[data-slot=color-swatch]`,
    "color",
    "background-color",
  ],
  "check.size": ["[data-slot=color-swatch-check] > svg", "px", "width"],
  "check.strokeWidth": [
    "[data-slot=color-swatch-check] > svg",
    "px",
    "stroke-width",
  ],
  "check.color": ["[data-slot=color-swatch-check]", "color", "color"],
  "ring.outlineWidth": [CHECKED, "px", "outline-width"],
  "ring.outlineOffset": [CHECKED, "px", "outline-offset"],
  "ring.outlineColor": [CHECKED, "color", "outline-color"],
  "current.size": ["[data-slot=color-swatch-current]", "px", "width"],
  "current.borderWidth": [
    "[data-slot=color-swatch-current]",
    "px",
    "border-top-width",
  ],
  "current.borderStyle": [
    "[data-slot=color-swatch-current]",
    "exact",
    "border-top-style",
  ],
  "current.borderColor": [
    "[data-slot=color-swatch-current]",
    "color",
    "border-top-color",
  ],
  "currentLabel.typography": [
    "[data-slot=color-swatch-current-label]",
    "typography",
  ],
  "currentLabel.foreground": [
    "[data-slot=color-swatch-current-label]",
    "color",
    "color",
  ],
  "currentLabel.marginTop": [
    "[data-slot=color-swatch-current-label]",
    "px",
    "margin-top",
  ],
  "divider.width": ["[data-slot=color-swatch-divider]", "px", "width"],
  "divider.color": [
    "[data-slot=color-swatch-divider]",
    "color",
    "background-color",
  ],
  "divider.gap": ["[data-slot=color-swatch-layout]", "px", "column-gap"],
};
