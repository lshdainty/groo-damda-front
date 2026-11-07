/**
 * 캘린더 보기 — 월 · 주 · 목록 셋(I-wrap-b1 γ, 일 · 연 보기는 걷었다).
 * 서버로 가는 값이 아니다(화면 상태뿐 — 주소 · 저장소 · 서버 설정 어디에도 실리지 않는다).
 */
export type TCalendarView = "month" | "week" | "agenda";

const CALENDAR_VIEWS: readonly TCalendarView[] = ["month", "week", "agenda"];

/** 옛 값("day" · "year")과 알 수 없는 값은 월이다 — 어디서 들어온 값이든 이 함수를 지난다 */
export function normalizeCalendarView(value: unknown): TCalendarView {
  return CALENDAR_VIEWS.find((v) => v === value) ?? "month";
}

// ================ Builtin Sources (공휴일) ================ //

export type TCalendarSourceType = "holiday";

export interface IBuiltinSource {
  id: TCalendarSourceType;
  labelKey: string;
  color: string;
  enabled: boolean;
}

export const BUILTIN_SOURCES: IBuiltinSource[] = [
  {
    id: "holiday",
    labelKey: "calendar.source.holiday",
    color: "#c73838",
    enabled: true,
  },
];

export type TEventColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "gray"
  | "teal";

export type TBadgeVariant = "dot" | "bar";

export type TWorkingHours = {
  start: number;
  end: number;
};

export type TVisibleHours = {
  start: number;
  end: number;
};
