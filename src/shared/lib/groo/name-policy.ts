import { countGraphemes } from "@/shared/ds/field";

/**
 * 이름 칸 공통 정책 — 길이 상한과 중복.
 *
 * 카테고리·라벨·태그에만 있던 규칙을 계좌 별칭·저축 목표·프리셋까지 넓히면서(QA
 * #16·#52·#54·#55) 화면마다 세 줄짜리 삼항을 복제하는 대신 여기로 모았다. 화면은
 * 이 결과를 자기 i18n 키로 번역만 한다 — 문구는 화면마다 다르지만("라벨"·"프리셋")
 * 판정은 같아야 한다.
 */

/** 이름 칸에서 날 수 있는 문제. `null` 이면 통과. */
export type NameIssue = "required" | "tooLong" | "duplicate" | null;

/**
 * 이름 판정. `taken` 에는 **자기 자신을 뺀** 기존 이름을 넘겨라(수정할 때 자기
 * 이름과 부딪히면 저장이 영영 막힌다).
 *
 * 비교는 trim 후 완전 일치다 — 서버 중복 판정(라벨 `existsActiveByUserAndName`)이
 * 대소문자를 어떻게 보는지 확인 전이라 여기서 더 넓게 잡으면 **거짓 차단**이 된다.
 * 서버가 더 넓게 막는 경우는 409 + 전역 토스트가 받는다.
 */
export function nameIssue(
  raw: string,
  max: number,
  taken: readonly string[] = [],
): NameIssue {
  const name = raw.trim();
  if (name.length === 0) return "required";
  if (countGraphemes(name) > max) return "tooLong";
  if (taken.some((t) => (t ?? "").trim() === name)) return "duplicate";
  return null;
}
