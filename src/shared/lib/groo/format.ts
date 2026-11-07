import { i18n } from "@/shared/i18n/config";
import { formatMonthDay, weekdayShort } from "@/shared/lib/date";

/** 현재 로케일이 영어인지. 순수 함수라 React 밖에서도 i18n.language 직접 참조. */
export const isEn = (): boolean => (i18n.language ?? "").startsWith("en");

/**
 * 손으로 붙이는 금액 부호는 U+2212(−) 하나로 통일한다.
 *
 * 하이픈(-)과 폭이 달라 한 카드 안에서 섞이면 tabular-nums 정렬이 어긋난다
 * (QA #22 — 홈 9월 카드에서 지출은 `−7,560`, 잔액은 `-7,560` 이었다).
 * 앱도 같은 규범이다 — `porest-desk-app/lib/core/format/krw.dart` 주석 참조.
 */
export const MINUS = "−";

/**
 * 등락률(%) — **어디서나 소수 둘째 자리**(0.43% · 5.00% · −12.30%, 사용자 결정 2026-10-25). 증권 · 홈 · 자산 · 통계가 한 함수를 쓴다.
 * "첫째 자리" · "소수가 0 이면 빼기" 는 거절. 사용률 · 비중 · 달성률 같은 **등락이 아닌 비율**은 이 함수가 아니다.
 *
 * `sign`: `"auto"`(기본 — 음수만 U+2212) · `"always"`(양수 · 0 은 `+`, 음수는 `−`) · `"none"`(절댓값 — ▲ ▼ 화살표가 방향을 말하는 자리).
 * 반올림해서 0.00 이 되는 음수는 `−0.00%` 가 아니라 `0.00%` 다. 유한하지 않은 값은 `—`.
 */
export function formatChangeRate(
  pct: number,
  { sign = "auto" }: { sign?: "auto" | "always" | "none" } = {},
): string {
  if (!Number.isFinite(pct)) return "—";
  const body = Math.abs(pct).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const zero = Number(body.replace(/,/g, "")) === 0;
  const prefix =
    sign === "none" || zero
      ? sign === "always" && zero
        ? "+"
        : ""
      : pct < 0
        ? MINUS
        : sign === "always"
          ? "+"
          : "";
  return `${prefix}${body}%`;
}

/**
 * 퍼센트는 **뜻이 셋**이고 자리수가 뜻을 따른다(사용자 결정 2026-11-07 B3 1A) — 자리마다 정하지 말고 이 함수 하나로 쓴다.
 *
 * - `share` 비중(구성 · 카테고리 · 종목 · 고정 대 변동 등 "전체 중 몫") — 소수 첫째 자리, **늘 한 자리**(`30.0%`).
 *   0 보다 크고 0.05% 미만이면 `0.1% 미만`(영어 `<0.1%`) — 반올림하면 `0.0%` 로 사라지는 것을 막는다.
 * - `progress` 진행률(예산 이행 · 사용 · 저축 달성 · 저축률 · 할인율) — 정수(`76%`). 막대 · 말풍선 · 범례 · 낭독이 같은 값.
 *   100 경계는 99.6 → `99%` · 100.3 → `101%` · 정확히 100 만 `100%`(웹 · 앱 같게).
 * - `change` 등락률 · 수익률 — 둘째 자리. [formatChangeRate] 를 그대로 부른다(합치지 않는다: 부호 · 화살표 규칙이 따로 있다).
 *
 * 값은 0~100 단위 퍼센트다(0.3 = 0.3%). 유한하지 않은 값은 `—`.
 */
export function formatPercent(pct: number, kind: "share" | "progress"): string;
export function formatPercent(
  pct: number,
  kind: "change",
  opts?: { sign?: "auto" | "always" | "none" },
): string;
export function formatPercent(
  pct: number,
  kind: "share" | "progress" | "change",
  opts: { sign?: "auto" | "always" | "none" } = {},
): string {
  if (kind === "change") return formatChangeRate(pct, opts);
  if (!Number.isFinite(pct)) return "—";
  // 음수는 U+2212(차트 · 금액과 같은 빼기 기호)
  if (pct < 0) {
    // 반올림해서 0 이 되면 부호 없이 0(−0% · −0.0% 를 내지 않는다 — formatChangeRate 와 같다)
    if (Math.round(-pct * (kind === "progress" ? 1 : 10)) === 0)
      return kind === "progress" ? "0%" : "0.0%";
    return `${MINUS}${formatPercent(-pct, kind)}`;
  }
  if (kind === "progress") {
    // 100 을 넘나드는 상태가 글에서 사라지지 않게 — 반올림하면 100 이 되는 99.5 ~ 99.99 는 내림(99%),
    // 100.01 ~ 100.49 는 올림(101%). 정확히 100 만 "100%", 그 밖은 정수 반올림.
    const r = Math.round(pct);
    if (r === 100 && pct !== 100) return `${pct < 100 ? 99 : 101}%`;
    return `${r}%`;
  }
  if (pct > 0 && pct < 0.05) return i18n.t("common:percentBelowShare");
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
}

/**
 * **크기만** 들고 있는 값(총 부채·지출처럼 절대값으로 오는 값) 앞에 붙일 부호.
 * `−{KRW(v)}` 처럼 마이너스를 문자로 박아 두던 자리를 이걸로 바꾼다.
 *
 * - `0` → 부호 없음. 빈 계정에서 `−0원` 으로 보이던 걸 `0원` 으로(QA #1).
 * - 음수 → `+`. 총 부채는 선결제한 카드 때문에 음수가 될 수 있는데(QA #21 이후
 *   서버가 유형 기준으로 세면 `totalDebt < 0`), 그대로 두면 `−-356,800` 이 된다.
 *
 * 값은 반드시 `KRW(Math.abs(v))` 와 같이 절대값으로 넘겨라.
 */
export const minusOf = (n: number): string =>
  n > 0 ? MINUS : n < 0 ? "+" : "";

/**
 * [minusOf] 의 거울 — **크기만** 들고 있는 값 중 **버는 쪽**(수입) 앞에 붙일 부호.
 * `+{KRW(v)}` 처럼 플러스를 문자로 박아 두던 자리를 이걸로 바꾼다.
 *
 * - `0` → 부호 없음. 반복 수입이 하나도 없는 계정에서 `+0` 으로 보이던 걸 `0` 으로.
 *   QA #1 이 지적한 `−0` 과 **같은 결함**이다 — 지출 쪽만 고치면 같은 카드 안에서
 *   한쪽은 `0`, 옆칸은 `+0` 이 된다.
 * - 음수 → `−`. 부호를 문자로 박아 두면 `+-1,000` 처럼 겹쳐 찍힌다.
 *
 * 값은 반드시 `KRW(Math.abs(v))` 와 같이 절대값으로 넘겨라.
 * 앱 `porest-desk-app/lib/core/format/krw.dart` 와 **같은 글자를 내야 한다** —
 * 반복 거래 관리는 같은 화면을 두 플랫폼이 그린다.
 */
export const plusOf = (n: number): string => (n > 0 ? "+" : n < 0 ? MINUS : "");

export const KRW = (
  n: number,
  { sign = false, abs = false }: { sign?: boolean; abs?: boolean } = {},
): string => {
  const v = abs ? Math.abs(n) : n;
  // 음수는 U+2212 + 절댓값 — 기본 toLocaleString 은 ASCII 하이픈을 낸다(I-31, 스펙 chart.md "빼기는 U+2212").
  const s =
    v < 0
      ? `${MINUS}${(-v).toLocaleString("ko-KR")}`
      : v.toLocaleString("ko-KR");
  if (sign && n > 0) return `+${s}`;
  return s;
};

/**
 * 통화 표기 — ko `10,000원`(기존 `${KRW(n)}원`과 100% 동일) / en `₩10,000`.
 * KRW 숫자부(부호·abs 포함)를 재사용하고, en 은 선행 부호 뒤에 ₩ 삽입(`−₩10,000`(U+2212)).
 * ko 회귀0: ko 분기는 `${KRW(n, opts)}원` 그대로.
 */
export const money = (
  n: number,
  opts: { sign?: boolean; abs?: boolean } = {},
): string => {
  const s = KRW(n, opts);
  if (!isEn()) return `${s}원`;
  const m = /^([+\-\u2212]?)(.*)$/.exec(s);
  return m ? `${m[1]}₩${m[2]}` : `₩${s}`;
};

/**
 * 영어 금액 접두 — en `₩`, ko 는 빈 글(ko 는 글(CSV)의 "원" 접미가 맡는다).
 * 접두를 CSV 에 박으면 값이 없어 "—" 가 올 때 "₩—" 가 된다 — 값이 있는 호출처만 `${wonPrefix()}${KRW(n)}` 로 붙인다.
 */
export const wonPrefix = (): string => (isEn() ? "₩" : "");

/** 소수 첫째 자리까지 반올림. 단위를 올릴지 판단할 때도 이 값으로 본다. */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * 금액 축약 — ko 조/억/만 / en `Intl.NumberFormat(compact)`(120M·52K).
 * 음수도 부호 prepend. App `core/format/krw.dart` formatChartAxis 와 정합.
 *
 * **축약하는 자리는 전부 이 함수 하나를 쓴다** — 차트 Y축, 도넛 중앙, 통계 추이 틱.
 * 통계 추이 축만 쓰던 `formatChartAmount` 가 따로 있었는데(만은 정수, 억은 고정
 * `.0` — `5.0억`·`10000.0억`) 같은 화면 안에서 도넛 중앙(`5억`·`1.2조`)과 글자가
 * 갈렸다. 축약 규칙이 자리마다 다르면 같은 값이 두 글자로 보인다. 하나만 남긴다.
 *
 * **전 구간이 같은 규칙이다**(QA #73) — 소수 첫째 자리까지 반올림하고 `.0` 은 뗀다.
 * 예전엔 구간마다 정밀도가 달랐다("10억 위는 정수 억", "1만~10만만 소수 한 자리").
 * 한 축 위에서 눈금마다 규칙이 바뀌면 `5.0만` 옆에 `25만` 이 서고, 읽는 사람은
 * 어느 쪽이 반올림된 값인지 알 수 없다. 자릿수는 단위가 이미 줄여 주므로
 * 정밀도까지 구간별로 깎을 이유가 없다.
 *
 *   ~1만   5,000 · 9,999          1만~   1만 · 1.2만 · 1,230.5만
 *   1억~   1억 · 1.2억 · 9,999억   1조~   1조 · 1.2조
 */
export const formatChartAxis = (v: number): string => {
  const n = Math.abs(v);
  if (isEn()) {
    // en 도 빼기는 U+2212 (I-31) — 앱 formatChartAxis(en) 과 같은 글자.
    return `${v < 0 ? MINUS : ""}${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
  }
  const sign = v < 0 ? MINUS : "";
  if (n < 10_000) return `${sign}${n.toLocaleString("ko-KR")}`;
  // 반올림한 값이 다음 단위에 닿으면 그 단위로 올린다 — 99,999,999 는 `10,000만` 이
  // 아니라 `1억`, 999,999,999,999 는 `10,000억` 이 아니라 `1조` 다.
  let scaled = n / 10_000;
  let unit = "만";
  for (const bigger of ["억", "조"]) {
    if (round1(scaled) < 10_000) break;
    scaled /= 10_000;
    unit = bigger;
  }
  // `.0` 은 떼고 정수부엔 천단위 콤마 — 1,230.5만 · 1,230만.
  const digits = round1(scaled).toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  });
  return `${sign}${digits}${unit}`;
};

export const formatDay = (dStr: string) => {
  const parts = dStr.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(y, m - 1, d);
  return { md: formatMonthDay(dt), dow: weekdayShort(dt), dt };
};

/**
 * Returns ISO_LOCAL_DATE_TIME string "YYYY-MM-DDTHH:mm:ss" based on local time.
 * Safe to send to a Java LocalDateTime endpoint (no timezone suffix).
 */
export const toLocalIso = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
