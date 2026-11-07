import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 한국어 문구의 띄어쓰기 규범을 CSV 한 곳에서 지킨다.
 *
 * 디자인 시스템 Writing(DESIGN.md "띄어쓰기")은 보조 용언을 **붙인다** — `해주세요` · `해보세요`.
 * 예전엔 `해 주세요` 로 모으는 규범이었으나(QA #128, 사용자 결정이 아니었다) 스펙이 붙임으로 정해
 * 2026-10-23 문구 PR 에서 뒤집었다. 목적은 그대로다 — 한 화면 안에서 글자가 갈리지 않게 한다.
 *
 * 번역 원본은 CSV 하나다(`src/locales/**` 는 생성물). 그래서 여기만 본다.
 */
const CSV = "i18n/translations.csv";

/** 띄어 쓴 보조용언 — 한글 바로 뒤에 띄운 `주세요` · `보세요` · `주시` · `줘요`. */
const SPACED_AUXILIARY = /[가-힣] (주세요|보세요|주시|줘요)/;

describe("한국어 문구 띄어쓰기", () => {
  it("보조용언은 붙여 쓴다 — `해 주세요` 가 아니라 `해주세요`", () => {
    const lines = readFileSync(CSV, "utf-8").split("\n");
    const offenders = lines
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => SPACED_AUXILIARY.test(line))
      .map(({ line, no }) => `${CSV}:${no}  ${line.slice(0, 90)}`);

    expect(offenders).toEqual([]);
  });

  /**
   * 가운뎃점은 앞뒤를 띄운다 — "계좌 · 카드". DESIGN.desk.md Writing 가운뎃점(11-07): 항목을 나열하는 가운뎃점은 글자에
   * 붙이지 않는다. ko · en 칸 모두. 고유명 안의 가운뎃점은 CSV 에 없다(있으면 허용 목록에 이유와 함께).
   */
  it("가운뎃점은 앞뒤를 띄운다 — `계좌·카드` 가 아니라 `계좌 · 카드`", () => {
    const offenders = findOffenders(/\S·\S/);
    expect(offenders).toEqual([]);
  });

  /**
   * 구간 기호는 앞뒤를 붙인다 — 한국어 `9월 1일~9월 30일`, 영어 `Sep 1–30`. 구간 기호는 로케일 문구
   * (`ds` datePicker.rangeSeparator)에 두고 코드에 직접 쓰지 않는다. 띄운 ` ~ ` 와 ` – ` 를 막는다.
   */
  it("구간 기호 `~` · `–` 는 띄우지 않는다", () => {
    const offenders = findOffenders(/ [~–] /);
    expect(offenders).toEqual([]);
  });

  /**
   * 합니다체를 쓰지 않는다 — 안내는 해요체(DESIGN.desk.md 말투: `~니다` 는 보안 알림 · 처리방침 · 약관에만).
   * 허용: `user.withdrawn.body` 의 "감사했습니다" — 2026-09-22 사용자 결정(인사는 "감사했습니다")이고
   * withdraw-copy.test.ts 가 잠근다. 해요체와 한 문구에 섞이지만 사용자 결정이라 그대로 둔다.
   */
  it("합니다체 · `~하세요` 를 쓰지 않는다 — 해요체로", () => {
    const ALLOWED = new Set(["user,withdrawn.body,"]);
    const offenders = findOffenders(
      /(습니다|합니다|됩니다|입니다|십시오|습니까|시겠|하세요)/,
      (line) => [...ALLOWED].some((a) => line.startsWith(a)),
    );
    expect(offenders).toEqual([]);
  });
});

function findOffenders(
  pattern: RegExp,
  allowed: (line: string) => boolean = () => false,
): string[] {
  return readFileSync(CSV, "utf-8")
    .split("\n")
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => i18nRow(line) && pattern.test(line))
    .filter(({ line }) => !allowed(line))
    .map(({ line, no }) => `${CSV}:${no}  ${line.slice(0, 90)}`);
}

/** 머리 줄이 아닌 데이터 줄 */
function i18nRow(line: string): boolean {
  return line !== "" && !line.startsWith("namespace,");
}
