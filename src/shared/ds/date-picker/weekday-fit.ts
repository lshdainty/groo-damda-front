import * as React from "react";
import { useTranslation } from "react-i18next";

import { datePickerLabels } from "./date-picker-dates";

/*
 * 일곱 칸 위 요일 머리의 두 글자 / 한 글자 판정 — groo-design #250(date-picker.md ⓔ Weekday) · #256(International Design "날짜").
 * 날짜 고르기 달력 · 캘린더 화면 · 열지도 어디서나 영어는 두 글자 Su Mo Tu We Th Fr Sa 이고, 칸에 들지 않는 폭에서만 한 글자
 * S M T W T F S 로 줄인다. 줄을 바꾸지 않고, 넓은 화면이라도 세 글자(Sun)로 늘리지 않는다. 한국어는 두 벌이 같다(일 ~ 토).
 * 요일 글은 글자 크기 설정을 따르지 않으므로(칸 안 글 `-static` — groo-design #260) 판정은 칸 폭 · 언어 · 글꼴만 본다.
 *
 * 셈 — 칸마다 두 글자 견본(`WeekdayProbe`, 보이지 않음)을 두고, 견본 폭이 그 칸(견본의 부모) 폭을 넘는 칸이 하나라도 있으면 한 글자.
 * 다시 재는 때 — ① 줄 · 견본의 크기가 바뀔 때(ResizeObserver — 창 폭 · 회전 · 웹폰트 도착) ② 요일 글이 바뀔 때(언어).
 * 잴 때마다 그 순간 줄 안의 견본을 다시 찾는다 — 쓰는 쪽이 칸을 새로 그려도 처음 찾은(떨어져 나간) 칸에 묶이지 않는다.
 */

/** 견본의 data-slot — 판정은 이 견본과 그 부모(칸)만 본다 */
export const WEEKDAY_PROBE_SLOT = "weekday-probe";

/** [root] 안 견본 가운데 하나라도 제 칸보다 넓은지 — 넓으면 한 글자로 줄인다 */
export function weekdayOverflows(root: HTMLElement): boolean {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[data-slot=${WEEKDAY_PROBE_SLOT}]`),
  ).some((probe) => {
    const cell = probe.parentElement;
    return (
      !!cell &&
      probe.getBoundingClientRect().width > cell.getBoundingClientRect().width
    );
  });
}

/**
 * 요일 줄이 한 글자여야 하는지 — [ref] 는 견본을 모두 품은 요소(요일 줄, 줄이 따로 없으면 칸들의 부모).
 * [textKey] 는 두 글자 글(바뀌면 다시 잰다). 날짜 고르기 · 열지도처럼 글을 쓰는 쪽이 따로 가진 곳이 쓴다 — 글까지 받으려면 `useWeekdayFit`.
 */
export function useWeekdayNarrow(
  ref: React.RefObject<HTMLElement | null>,
  textKey: string,
): boolean {
  const [narrow, setNarrow] = React.useState(false);
  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => setNarrow(weekdayOverflows(root));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const probe of root.querySelectorAll(
      `[data-slot=${WEEKDAY_PROBE_SLOT}]`,
    ))
      observer.observe(probe);
    return () => observer.disconnect();
  }, [ref, textKey]);
  return narrow;
}

/** 요일 글 — 언어를 열쇠로 받아 언어가 바뀌면 다시 읽는다(글은 ds 사전이 지금 언어로 읽는다) */
const weekdayLabelsAt = (_language: string): WeekdayLabels => {
  const labels = datePickerLabels();
  return {
    weekdays: labels.weekdays,
    weekdaysNarrow: labels.weekdaysNarrow,
    weekdaysLong: labels.weekdaysLong,
  };
};

/** 요일 글 세 벌(일요일부터 일곱) */
export interface WeekdayLabels {
  /** 두 글자 — 한국어 "일", 영어 "Su" */
  weekdays: readonly string[];
  /** 한 글자 — 한국어 "일", 영어 "S" */
  weekdaysNarrow: readonly string[];
  /** 읽는 이름 — "일요일" · "Sunday" */
  weekdaysLong: readonly string[];
}

/** 요일 글(ds 사전) — 언어가 바뀌면 다시 읽는다. 판정은 쓰는 쪽이 따로 할 때(열지도 · 날짜 고르기) — 보통은 `useWeekdayFit` */
export function useWeekdayLabels(): WeekdayLabels {
  const { i18n } = useTranslation("ds");
  return weekdayLabelsAt(i18n?.resolvedLanguage ?? i18n?.language ?? "");
}

export interface WeekdayFit {
  /** 한 글자로 줄였는지 */
  narrow: boolean;
  /** 보이는 요일(일요일부터 일곱) — 두 글자, 칸에 들지 않으면 한 글자 */
  weekdays: readonly string[];
  /** 두 글자 요일(일요일부터 일곱) — 칸마다 `<WeekdayProbe>{full[i]}</WeekdayProbe>` */
  full: readonly string[];
  /** 읽는 요일(일요일부터 일곱) — "Sunday" · "일요일" */
  long: readonly string[];
}

/**
 * 일곱 칸 요일 머리 — 글(ds 사전)과 두 글자 / 한 글자 판정을 함께 준다. [ref] 는 요일 줄(견본을 모두 품은 요소)에 단 ref 다
 * (ref 를 돌려주지 않고 받는다 — 돌려준 값에 ref 가 섞이면 렌더 중 ref 를 읽는 꼴이 되어 React Compiler 규칙에 걸린다).
 *
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const wd = useWeekdayFit(ref);
 * <div ref={ref} className="grid grid-cols-7">
 *   {wd.weekdays.map((w, i) => (
 *     <span key={i} className="relative whitespace-nowrap">
 *       {w}
 *       <WeekdayProbe>{wd.full[i]}</WeekdayProbe>
 *     </span>
 *   ))}
 * </div>
 * ```
 * 칸은 `relative`(견본이 칸 안에 뜬다) · `whitespace-nowrap`(줄을 바꾸지 않는다), key 는 자리(i)로 — 한 글자 글은 겹친다(T · T).
 * 견본에는 칸에 보일 두 글자 모습 그대로를 넣는다(요일 뒤에 날짜가 붙는 칸이면 날짜까지). 글자는 `-static`(글자 크기 설정을 따르지 않는다)으로.
 */
export function useWeekdayFit(
  ref: React.RefObject<HTMLElement | null>,
): WeekdayFit {
  const labels = useWeekdayLabels();
  const narrow = useWeekdayNarrow(ref, labels.weekdays.join("\u0000"));
  return {
    narrow,
    weekdays: narrow ? labels.weekdaysNarrow : labels.weekdays,
    full: labels.weekdays,
    long: labels.weekdaysLong,
  };
}
