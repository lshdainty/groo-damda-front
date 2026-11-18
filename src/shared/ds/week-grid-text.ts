/*
 * 일곱 칸 격자 글자 상한 — groo-design #258(DESIGN.md Layout "지원 폭" · date-picker.md "글자 크기 설정").
 * 날짜 고르기 달력 · 캘린더 화면 · 열지도 · 7일 띠처럼 일곱 칸 격자의 **요일 머리와 날짜 숫자**는 글자 크기 200% 에서 멈춘다 — 그보다 크면
 * 칸 폭(화면 폭 ÷ 7)에 두 자리 숫자도 요일 한 글자도 들지 않는다(WCAG 1.4.4 의 200% 는 지킨다). 제목 · 일정 이름 · 금액 같은 다른 글은
 * 그 위로도 커진다.
 *
 * 셈 — 글자 · 줄 높이를 `min(rem 토큰, static 토큰 × 2)` 로 멈춘다(static 토큰은 글자 크기 설정을 따르지 않는 px 값). 상한 배율은
 * [WEEK_GRID_TEXT_MAX_SCALE] 하나고, 아래 글자 클래스 · 줄 높이 식은 모두 그 배율(`_*_2`)로 적는다 — Tailwind 가 소스에서 클래스를
 * 찾으므로 식을 문자열로 만들어 붙이지 않고 그대로 적는다(시험이 배율과 맞는지 본다).
 *
 * 쓰는 법 — `text-t3` 대신 `WEEK_GRID_TEXT.t3`(글자 크기 · 줄 높이만 바꾼다, 굵기 · 색은 그대로 따로 단다). 줄 높이로 원 · 칸 크기를 세는
 * 곳은 `var(--text-t3--line-height)` 대신 `WEEK_GRID_LINE_HEIGHT.t3` 와 같은 식을 클래스에 적는다.
 */

/** 일곱 칸 격자의 요일 머리 · 날짜 숫자가 멈추는 글자 크기 배율 — 200% */
export const WEEK_GRID_TEXT_MAX_SCALE = 2;

/** 글자 크기 · 줄 높이 — 200% 에서 멈춘다(`text-tN` 자리에) */
export const WEEK_GRID_TEXT = {
  t1: "text-[length:min(var(--text-t1),calc(var(--text-t1-static)_*_2))] leading-[min(var(--text-t1--line-height),calc(var(--text-t1-static--line-height)_*_2))]",
  t2: "text-[length:min(var(--text-t2),calc(var(--text-t2-static)_*_2))] leading-[min(var(--text-t2--line-height),calc(var(--text-t2-static--line-height)_*_2))]",
  t3: "text-[length:min(var(--text-t3),calc(var(--text-t3-static)_*_2))] leading-[min(var(--text-t3--line-height),calc(var(--text-t3-static--line-height)_*_2))]",
  t4: "text-[length:min(var(--text-t4),calc(var(--text-t4-static)_*_2))] leading-[min(var(--text-t4--line-height),calc(var(--text-t4-static--line-height)_*_2))]",
  t5: "text-[length:min(var(--text-t5),calc(var(--text-t5-static)_*_2))] leading-[min(var(--text-t5--line-height),calc(var(--text-t5-static--line-height)_*_2))]",
} as const;

/** 줄 높이 식 — 원 · 칸 크기를 줄 높이로 세는 클래스 안에 적는다(Tailwind 임의 값 꼴, 공백은 `_`) */
export const WEEK_GRID_LINE_HEIGHT = {
  t3: "min(var(--text-t3--line-height),calc(var(--text-t3-static--line-height)_*_2))",
  t4: "min(var(--text-t4--line-height),calc(var(--text-t4-static--line-height)_*_2))",
  t5: "min(var(--text-t5--line-height),calc(var(--text-t5-static--line-height)_*_2))",
} as const;
