import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 더보기 · 설정 항목 설명과 통계 부제 — 디자인시스템 확정(2026-11-07 B4 9번).
 * 지금 있는 기능만 " · " 로 2~3개. 통계 부제는 실제 탭 이름 그대로("인사이트" 는 탭이 아니다).
 */
const rows = new Map<string, string>();
for (const line of readFileSync("i18n/translations.csv", "utf-8").split("\n")) {
  const [ns, key, ko] = line.split(",");
  if (ns && key && ko !== undefined) rows.set(`${ns}:${key}`, ko);
}

describe("항목 설명 글", () => {
  it.each([
    ["stats:page.subtitle", "카테고리 · 추이 · 비교"],
    ["more:desc.accounts", "계좌 · 카드 관리"],
    ["settings:sections.accounts.desc", "계좌 · 카드 관리"],
    ["more:desc.budget", "월간 예산 · 카테고리별 한도"],
    ["settings:sections.budget.desc", "월간 예산 · 카테고리별 한도"],
    ["more:desc.notifications", "푸시 · 이메일 · 방해 금지"],
    [
      "stocks:search.hint",
      "종목 이름이나 코드 (국내 + 미국 · 중국 · 일본 · 홍콩 · 베트남)",
    ],
    ["asset:holdings.searchPlaceholder", "종목 이름이나 코드"],
  ])("%s", (id, ko) => {
    expect(rows.get(id)).toBe(ko);
  });
});
