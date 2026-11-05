import { i18n } from "@/shared/i18n/config";
import { formatDateSmart, parseServerUtc } from "@/shared/lib/date";

/**
 * 알림 상대시간 포맷 — 벨(Popover)·Page 공용 single source(SoT 정합).
 *
 * createAt (ISO) →
 *   "방금"(<1분) / "n분 전"(<60분) / "n시간 전"(<24시간) /
 *   "어제"(1일) / "n일 전"(<7일) / "9월 30일"(≥7일 · 다른 해 "2025년 9월 30일" — 날짜 규칙)
 * ko 회귀0: ko 는 date ns 값이 기존 literal 과 동일. en 은 date-fns 없이 문자열 키.
 *
 * createAt 은 서버가 시간대 없이 주는 `[UTC]` 시각이라 [parseServerUtc] 로 읽는다 —
 * `new Date()` 로 그냥 읽으면 UTC 값이 로컬로 둔갑해 KST(+9)에서 방금 온 알림이
 * "9시간 전" 이 된다. 마지막 날짜 분기도 문자열을 자르지 않고 로컬 날짜로 찍는다
 * (자르면 UTC 날짜가 나와 새벽에 하루 어긋난다).
 *
 * [now] 는 상대시각의 기준점이며 **필수**다. 기본값(`Date.now()`)을 두면 호출부마다
 * 다른 순간을 보게 되는데, 실제로 그래서 같은 알림이 벨에선 "방금", 알림 페이지에선
 * "2시간 전" 으로 갈렸다. 렌더 중 `Date.now()` 를 직접 부르는 것도 막힌다 — 같은
 * 입력이 렌더마다 다른 결과를 내 순수하지 않다(react-hooks/purity).
 *
 * 넘길 값은 `useNow()` 가 주는 **흐르는 '지금'** 이다. react-query 의 `dataUpdatedAt`
 * 을 넘기면 안 된다 — 그건 '지금' 이 아니라 '목록을 받아 온 순간' 이라, 재조회가 없는
 * 화면에서는 시계가 그 자리에 얼어붙는다.
 */
export function relativeTime(createAt: string, now: number): string {
  const then = parseServerUtc(createAt);
  if (!then) return "";
  const m = Math.floor((now - then.getTime()) / 60_000);
  if (m < 1) return i18n.t("date:justNow");
  if (m < 60) return i18n.t("date:minutesAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t("date:hoursAgo", { count: h });
  const d = Math.floor(h / 24);
  if (d === 1) return i18n.t("date:yesterday");
  if (d < 7) return i18n.t("date:daysAgo", { count: d });
  // 1주 이상 지난 건 날짜만 — 올해는 줄임, 다른 해는 표준(앱 _relativeTime 과 같다)
  return formatDateSmart(then);
}
