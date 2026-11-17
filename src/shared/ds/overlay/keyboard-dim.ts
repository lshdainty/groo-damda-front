/*
 * 키보드가 떠 있는 동안 딤을 레이아웃 뷰포트 아래로 이어 그린다 — 시트 · 대화상자의 딤(overlay)에 붙인다.
 *
 * 딤은 `fixed inset-0` 그대로다 — 레이아웃 뷰포트 전체를 덮고, 키보드 자리 맞춤(useKeyboardViewport)은 표면(시트 · 대화상자)
 * 에만 건다. 그런데 iPhone Safari 26 은 키보드가 뜨면 보이는 영역을 밀어(offsetTop) 그 아래 끝을 레이아웃 뷰포트의 아래 끝에
 * 맞추고, 그 아래 — 떠 있는 주소 알약 둘레에서 키보드 윗변까지(입력 도구줄이 없을 때 약 98pt) — 에도 문서를 그린다
 * (2026-11-17 QA 실측 · iPhone 17 Pro: 레이아웃 714 · 숫자 키패드 보이는 영역 410 · 밀림 304 → 아래 끝 714, 시트 bottom 0).
 * 그 띠는 레이아웃 뷰포트 밖이라 `fixed inset-0` 가 닿지 않아 뒤 페이지가 흐림 없이 비쳤다(할 일 목록 · 자산 회색 바탕).
 *
 * 그래서 키보드가 떠 있는 동안(바로 뒤 표면에 useKeyboardViewport 가 `data-keyboard` 를 단다)만 딤의 ::after 를 딤 바로 아래에
 * 화면 높이(lvh)만큼 붙여 같은 색(bg-inherit)으로 칠한다. 딤 상자 자체 · 색 · 모션은 그대로다 — 덮는 범위만 늘린다.
 * 키보드가 없을 때는 붙이지 않는다 — 주소 알약 자리는 Safari 가 칠한다(키보드 없는 시트의 모습은 바꾸지 않는다).
 * 문서 스크롤은 열린 동안 잠겨 있어(Radix RemoveScroll) 화면 밖으로 늘어난 ::after 가 스크롤을 만들지 않는다.
 *
 * Tailwind 는 소스의 글자 그대로를 읽으므로 조건을 변수로 나눠 잇지 않는다.
 */
export const KEYBOARD_DIM_EXTEND = [
  "[&:has(+[data-keyboard])]:after:absolute",
  "[&:has(+[data-keyboard])]:after:inset-x-0",
  "[&:has(+[data-keyboard])]:after:top-full",
  "[&:has(+[data-keyboard])]:after:h-lvh",
  "[&:has(+[data-keyboard])]:after:bg-inherit",
].join(" ");
