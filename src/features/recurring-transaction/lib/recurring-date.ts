import { localDateKey, parseLocalDate } from "@/shared/lib/date";

// 반복 거래 다이얼로그 공용 date helpers — RecurringFromTxDialog / RecurringAddDialog /
// RecurringAddDialog(추가·수정) 공유.
// (컴포넌트 파일이 함수도 export하면 react-refresh 룰 위반이라 별도 .ts 로 분리)
//
// '오늘' 은 여기서 만들지 않는다 — 공용 `todayLocalKey()` 를 호출부가 넘긴다.
// 'YYYY-MM-DD' 는 로컬 자정으로 읽고 로컬 달력으로 되찍는다. 예전의 `new Date(iso)` +
// `toISOString().slice(0, 10)` 왕복은 파싱·출력이 UTC, 중간의 getDay/setDate 가 로컬이라
// 축이 어긋났다 — KST(+9)에서는 우연히 무손실이지만 UTC 뒤쪽 타임존에서는 요일 정규화·
// 미리보기·종료일이 하루씩 밀린다.

export function addYears(iso: string, years: number): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  d.setFullYear(d.getFullYear() + years);
  return localDateKey(d);
}

// 다음 날짜 셈은 한 벌 — recurring-schedule.ts (I-20 D 29)
export { previewNextDates } from "./recurring-schedule";
