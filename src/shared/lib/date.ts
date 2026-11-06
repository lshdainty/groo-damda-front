import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { i18n } from "@/shared/i18n/config";

// 로케일 소스 = i18n.language(SoT). ko('ko'/'ko-KR'/미정) → ko, en → enUS.
const isEnLocale = (): boolean => (i18n.language ?? "").startsWith("en");

export const getLocale = () => (isEnLocale() ? enUS : ko);

/**
 * 다 친 날짜인가 — `YYYY-MM-DD` 이면서 **달력에 있는 날**. `2026-02-30` 은 `new Date` 가
 * 3/2 로 넘겨 버리므로 연·월·일이 그대로 돌아오는지까지 본다. 날짜 칸이 키를 누르는
 * 동안의 미완성 값을 걸러 낼 때 쓴다(`InputDatePicker` 의 `commitOnComplete`).
 */
export const isCompleteDate = (value: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d
  );
};

export const formatDate = (
  date: Date | string,
  formatStr: string = "yyyy-MM-dd",
) => {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, formatStr, { locale: getLocale() });
};

// ── 로케일 대응 날짜 헬퍼 ──────────────────────────────────────────────────
// ko 는 기존 인라인과 100% 바이트 동일한 literal 을 그대로 유지하고, en 만 date-fns 로
// 분기한다(ko 회귀0). 페이지/다이얼로그 인라인 요일·월일 포맷 중복 제거용 허브.

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 'YYYY-MM-DD'(또는 datetime) 문자열 / Date → 로컬 Date. 문자열은 TZ shift 없이 파싱. */
const toDate = (input: Date | string): Date => {
  if (input instanceof Date) return input;
  const [y, m, d] = input.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** 로케일 단축 요일 배열(일~토 / Sun~Sat). 캘린더 헤더 등. */
export const getWeekDays = (): string[] => (isEnLocale() ? DOW_EN : DOW_KO);

/** 단일 요일 라벨 — ko "수" / en "Wed". */
export const weekdayShort = (input: Date | string): string =>
  getWeekDays()[toDate(input).getDay()] ?? "";

/** ko "M월 D일"(pad 시 "07월 08일") / en "Jul 8". */
export const formatMonthDay = (
  input: Date | string,
  opts: { pad?: boolean } = {},
): string => {
  const d = toDate(input);
  if (isEnLocale()) return format(d, "MMM d", { locale: enUS });
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return opts.pad
    ? `${String(m).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`
    : `${m}월 ${day}일`;
};

/**
 * ko "M월 D일 (수)" / en "Jul 8 (Wed)".
 *
 * <p>올해가 아니면 연도를 붙인다 — 반복거래는 내년치를 미리 만들어 두는데, 연도가
 * 없으면 2027-01-01 이 그냥 "1월 1일" 로 보여 올해 것과 구분되지 않는다.
 */
/**
 * 표준 날짜 — 한국어 "2026년 9월 30일" · 영어 "Sep 30, 2026"(DESIGN.md International Design 날짜 "표준").
 * 화면에 `2026-09-30` 을 그대로 보이지 않는다(입력칸 값 · 내보내기 · API 는 그대로).
 */
export const formatDateLong = (input: Date | string): string => {
  // 읽을 수 없는 글은 원문 그대로(날짜를 지어내지 않는다)
  if (typeof input === "string" && !/^\d{4}-\d{2}-\d{2}/.test(input))
    return input;
  const d = toDate(input);
  if (isEnLocale()) return format(d, "MMM d, yyyy", { locale: enUS });
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/**
 * 올해 날짜는 줄임("9월 30일"), 다른 해면 표준("2025년 9월 30일") — International Design 의 날짜 규칙.
 * `now` 는 시험용(올해를 고정한다).
 */
export const formatDateSmart = (
  input: Date | string,
  now: Date = new Date(),
): string =>
  toDate(input).getFullYear() === now.getFullYear()
    ? formatMonthDay(input)
    : formatDateLong(input);

/**
 * 요일 형식 — International Design 날짜 표 "요일": ko "10월 25일 (일)" / en "Sun, Oct 25"(`E, MMM d`).
 * 다른 해면 표준에 요일을 붙인다 — ko "2025년 10월 25일 (토)" / en "Sat, Oct 25, 2025". `now` 는 시험용(올해를 고정한다).
 */
export const formatMonthDayDow = (
  input: Date | string,
  now: Date = new Date(),
): string => {
  const d = toDate(input);
  const otherYear = d.getFullYear() !== now.getFullYear();
  if (isEnLocale())
    return format(d, otherYear ? "EEE, MMM d, yyyy" : "EEE, MMM d", {
      locale: enUS,
    });
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_KO[d.getDay()]})`;
  return otherYear ? `${d.getFullYear()}년 ${md}` : md;
};

/**
 * ko "M월 D일 수요일" / en "Jul 8, Wednesday". 다이얼로그 타이틀 등 전체 요일명.
 * 올해가 아니면 연도를 붙인다(formatMonthDayDow 와 같은 이유).
 */
export const formatMonthDayWeekday = (input: Date | string): string => {
  const d = toDate(input);
  const otherYear = d.getFullYear() !== new Date().getFullYear();
  if (isEnLocale())
    return format(d, otherYear ? "MMM d, yyyy, EEEE" : "MMM d, EEEE", {
      locale: enUS,
    });
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW_KO[d.getDay()]}요일`;
  return otherYear ? `${d.getFullYear()}년 ${md}` : md;
};

/** ko "Y년 M월" / en "MMM yyyy"(예: "Jul 2026"). */
export const formatYearMonth = (input: Date | string): string => {
  const d = toDate(input);
  if (isEnLocale()) return format(d, "MMM yyyy", { locale: enUS });
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
};

/** ko "Y년" / en "Y". 연도 number 직접 허용. */
export const formatYear = (input: Date | string | number): string => {
  const y = typeof input === "number" ? input : toDate(input).getFullYear();
  return isEnLocale() ? String(y) : `${y}년`;
};

/** ko "Y년 Q분기" / en "Q{q} yyyy"(예: "Q3 2026"). */
export const formatYearQuarter = (input: Date | string): string => {
  const d = toDate(input);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return isEnLocale()
    ? `Q${q} ${d.getFullYear()}`
    : `${d.getFullYear()}년 ${q}분기`;
};

/** 단월 라벨 — ko "M월"(pad 시 "07월") / en "MMM"(Jul). 월 number(1~12) 직접 허용. */
export const formatMonthShort = (
  input: Date | string | number,
  opts: { pad?: boolean } = {},
): string => {
  if (isEnLocale()) {
    const d =
      typeof input === "number" ? new Date(2000, input - 1, 1) : toDate(input);
    return format(d, "MMM", { locale: enUS });
  }
  const m = typeof input === "number" ? input : toDate(input).getMonth() + 1;
  return opts.pad ? `${String(m).padStart(2, "0")}월` : `${m}월`;
};

/**
 * 서버가 준 `[UTC]` 시각을 [Date] 로 읽는다.
 *
 * 백엔드는 `LocalDateTime` 을 시간대 없이 직렬화한다 — `2026-08-24T10:30:00`.
 * JS 는 시간대 표시가 없는 date-time 문자열을 **로컬**로 읽으므로(ES2015+),
 * 그대로 `new Date(s)` 하면 UTC 값이 로컬 시각으로 둔갑해 KST(+9)에서는 방금
 * 일어난 일이 "9시간 전" 으로 보인다. 그래서 UTC 로 못 박고 읽는다.
 *
 * 이미 `Z` 나 오프셋이 붙어 오면 그대로 존중한다 — 서버가 나중에 형식을 바꿔도
 * 이 함수가 두 번 보정하지 않는다.
 *
 * **시각이 있는 입력 전용이다.** 서버 `LocalDateTime` 필드(`...T10:30:00`)만 넣는다 —
 * `'2026-08-24'` 같은 날짜만 문자열은 이 함수 대상이 아니다. 웹 V8 은 `'2026-08-24Z'` 를
 * UTC 자정으로 받아 주지만 앱의 `DateTime.tryParse` 는 같은 값을 거부해 `null` 을 낸다.
 * 같은 데이터가 웹에선 날짜로, 앱에선 빈칸으로 갈리므로 계약을 여기서 닫는다.
 *
 * 날짜만 필드(`expenseDate`·`transferDate`·캘린더 `startDate`/`endDate`)는 사용자가 입력한
 * **벽시계**라 애초에 UTC 변환 대상이 아니다 — `slice(0, 10)` 으로 그대로 쓴다.
 * '지금이 며칠인가' 가 필요하면 [todayLocalKey] 를 쓴다.
 */
/**
 * `'YYYY-MM-DD'` · `'YYYYMMDD'` — Java `LocalDate`. 시간대가 없는 벽시계 날짜다.
 * 앱 `date.dart` 의 `_dateOnly` 와 **같은 정규식**이어야 한다.
 */
const DATE_ONLY = /^[+-]?\d{4,6}-?\d{2}-?\d{2}$/;

export const parseServerUtc = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  // 날짜만 오면 거부한다. V8 은 `'2026-08-24Z'` 를 UTC 자정으로 받아 주는데, 그걸 로컬로
  // 옮기면 KST(+9)에서는 날짜가 그대로라 멀쩡해 보이고 UTC 뒤쪽(-05:00)에서만 하루 밀린다.
  // 개발 기기에서 안 드러나는 종류의 오차라 여기서 끊는다. 앱은 같은 입력에 null 을 낸다.
  if (DATE_ONLY.test(iso)) return null;
  const hasZone = iso.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * 서버가 준 `[UTC]` 시각 → **로컬** 'YYYY-MM-DD'. 못 읽으면 null.
 *
 * 문자열을 `slice(0, 10)` 으로 자르면 UTC 날짜가 그대로 나온다 — KST(+9) 새벽 0~9시에
 * 일어난 일이 전날로 찍혀, 로컬 달력으로 만든 '오늘'·요일 칸과 하루씩 어긋난다.
 * 그래서 [parseServerUtc] 로 읽고 로컬 달력으로 다시 조립한다.
 *
 * 자르기 대신 파싱이라 낙관적 업데이트가 캐시에 넣는 `Z` 붙은 문자열
 * (`new Date().toISOString()`)도 같은 값으로 읽힌다 — 낙관적 렌더와 재조회 렌더가
 * 갈리지 않는다.
 *
 * [parseServerUtc] 의 계약을 그대로 물려받는다 — **시각이 있는 입력 전용**이다.
 */
export const toLocalDateKey = (
  iso: string | null | undefined,
): string | null => {
  const d = parseServerUtc(iso);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** 서버 `[UTC]` 시각 → 로컬 'YYYY-MM-DD HH:mm'. 못 읽으면 null. [toLocalDateKey] 와 같은 이유. */
export const toLocalDateTime = (
  iso: string | null | undefined,
): string | null => {
  const d = parseServerUtc(iso);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * **로컬** 달력 기준 오늘 'YYYY-MM-DD'.
 *
 * `new Date().toISOString().slice(0, 10)` 은 UTC 날짜라 KST(+9) 00:00~09:00 에는 어제가
 * 나온다. 앱은 '오늘' 을 전부 `DateTime.now()`(로컬)로 잡으므로 그 9시간 동안 앱과 웹의
 * '오늘' 이 갈린다 — 기본 거래일이 하루 이르게 **저장되고**(벽시계 필드라 서버가 안
 * 고쳐 준다), 전일 종가로 어제 봉 대신 그제 봉을 집는다.
 *
 * 서버가 준 시각을 로컬 날짜로 읽는 [toLocalDateKey] 와 짝이다 — 이쪽은 '지금이 며칠인가'
 * 를 묻고, 저쪽은 '이 값이 며칠인가' 를 묻는다. 둘 다 로컬 달력 한 벌만 본다.
 */
export const todayLocalKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * `'YYYY-MM-DD'`(벽시계 LocalDate) → **로컬** 자정 Date. 못 읽으면 null.
 *
 * `new Date('YYYY-MM-DD')` 는 스펙상 UTC 자정 파싱이라, 이어지는 로컬 getter
 * (getDay/getDate/setDate)와 축이 어긋난다 — UTC 뒤쪽 타임존에서 하루 밀리고
 * KST 에서만 우연히 맞는다. 벽시계 날짜 문자열을 Date 로 읽을 때는 이걸 쓴다.
 */
export const parseLocalDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/** Date → 로컬 달력 'YYYY-MM-DD'. [todayLocalKey] 의 임의 시점 판. */
export const localDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  isSameDay,
  isSameMonth,
};
