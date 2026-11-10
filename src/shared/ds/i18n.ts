import { createElement, type ReactNode } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";

import koDs from "@/locales/ko/ds.json";

/*
 * ds 부품의 기본 글 — 로케일 문구(namespace `ds`, 키 `{부품}.{자리}`)와 Intl 포맷터.
 * 호출부가 prop 으로 준 글이 늘 이긴다(그 prop 의 기본값으로 이 글을 쓴다). 개발자 경고(console)는 번역하지 않는다.
 *
 * 앱이 i18n 을 초기화하지 않은 곳(테스트 · 카탈로그 밖 렌더)에서는 한국어 원본(ko/ds.json)으로 떨어진다 —
 * 부품이 키 이름을 그대로 화면에 내지 않게.
 */

type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) =>
  vars
    ? text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""))
    : text;

/** 지금 언어 — 초기화 전이면 한국어 */
export const dsLanguage = () => i18next.resolvedLanguage ?? "ko";

/** 렌더 밖(상수 · 헬퍼)에서 쓰는 글 — 언어가 바뀌면 다음에 부를 때 따라간다. 렌더 안에서는 `useDsText` 를 쓴다. */
export function dsText(key: string, vars?: Vars): string {
  // vars 를 함께 준다 — count 가 있으면 i18next 가 `{key}_one` · `{key}_other` 처럼 수에 맞는 꼴을 찾는다(복수형)
  if (i18next.isInitialized && i18next.exists(key, { ns: "ds", ...vars }))
    return i18next.t(key, { ns: "ds", ...vars }) as string;
  const ko = koDs as Record<string, string>;
  // 초기화 전 · 카탈로그 밖 — 한국어 원본에서도 수에 맞는 꼴을 고른다(한국어는 other 하나라 보통 `_one` 과 같은 글)
  const count = vars?.count;
  const plural =
    typeof count === "number"
      ? (ko[`${key}_${new Intl.PluralRules("ko").select(count)}`] ??
        ko[`${key}_other`])
      : undefined;
  return fill(plural ?? ko[key] ?? key, vars);
}

/** 렌더 안에서 쓰는 글 — 언어가 바뀌면 다시 그린다 */
export function useDsText() {
  // 언어 변경 구독(react-i18next) — 값은 dsText 가 읽는다
  useTranslation("ds");
  return dsText;
}

/** 숫자 · 날짜 포맷터의 로케일 — ko-KR / en-US */
export const dsLocale = () =>
  dsLanguage().startsWith("en") ? "en-US" : "ko-KR";

/** 돈 — 한국어 "1,234,567원", 영어 "₩1,234,567"(International Design v106). 빼기 기호는 부르는 쪽이 붙인다 */
export const dsMoney = (n: number) => {
  const v = Math.round(n);
  return dsLanguage().startsWith("en")
    ? `₩${v.toLocaleString("en-US")}`
    : `${v.toLocaleString("ko-KR")}원`;
};

/**
 * 금액 글을 쉼표 뒤에서만 줄을 바꿀 수 있게 한다(03-D 결정 2 B — Typography v114 의 예외). 세 자리 묶음 사이(숫자,숫자)의
 * 쉼표 뒤마다 `<wbr>` 을 넣는다 — 보이는 글에만이다. `<wbr>` 은 글자가 아니라서 읽는 이름 · 복사한 글에 남지 않는다.
 * 지표 · 순자산 · 목록 금액(ds 부품)은 글로 받은 금액에 이 함수를 스스로 건다. 상세 합계 · 옛 화면 금액(`money()`)은 화면 이관 때 쓴다.
 * 쉼표가 없으면(다섯 자리 이하 · 글 값) 글 그대로다. 묶음 하나가 칸보다 길 때만 칸 끝 끊기(overflow-wrap)가 남는다.
 */
export const withCommaBreaks = (text: ReactNode): ReactNode => {
  if (typeof text !== "string" || !/\d,\d/.test(text)) return text;
  return text
    .split(/(?<=\d,)(?=\d)/)
    .flatMap((part, i) =>
      i === 0 ? [part] : [createElement("wbr", { key: i }), part],
    );
};

/** 돈 — {@link dsMoney} 와 같은 글, 쉼표 뒤마다 줄바꿈 자리(`<wbr>`)를 넣어 돌려준다. 이름 · 복사에는 {@link dsMoney}(글)를 쓴다 */
export const dsMoneyText = (n: number): ReactNode =>
  withCommaBreaks(dsMoney(n));
