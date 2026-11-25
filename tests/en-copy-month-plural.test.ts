// 영어 문구의 달 · 개수 — QA "Month 11 total budget" · "1 categories" · "1 people" 의 회귀 시험.
// ① 달은 숫자가 아니라 달 이름이다(International Design "날짜" — 영어 달은 늘 줄임 `MMM`: "Sep 30" · "Wednesday, Sep 30").
// ② 개수는 1 이면 단수다 — i18next 복수형(`_one` · `_other`)에 count 를 숫자로 넘긴다(문자열이면 복수형을 고르지 않는다).
// 한국어는 그대로다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/shared/i18n/config";
import { formatMonthShort } from "@/shared/lib/date";
import {
  cycleSentence,
  endPiece,
  endSentence,
} from "@/features/recurring-transaction/lib/recurring-format";
import type { RecurringTransaction } from "@/entities/recurring-transaction";

const ROOT = path.join(__dirname, "..");

// namespace,key,ko,en — 쉼표가 든 값은 큰따옴표로 감싼다
const parse = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
};

const rows = readFileSync(path.join(ROOT, "i18n/translations.csv"), "utf8")
  .split("\n")
  .slice(1)
  .filter((l) => l.trim())
  .map(parse);

const tf = (lng: "en" | "ko") => i18n.getFixedT(lng);

afterEach(async () => {
  await i18n.changeLanguage("ko");
});

describe("달 — 영어는 달 이름(Nov), 한국어는 그대로(11월)", () => {
  it("QA — 총 예산 제목", async () => {
    await i18n.changeLanguage("en");
    const opts = { month: 11, monthName: formatMonthShort(11) };
    expect(tf("en")("budget:monthlyCap", opts)).toBe("Nov total budget");
    expect(tf("en")("budget:manager.monthlyTotal", opts)).toBe(
      "Nov Total Budget",
    );
    expect(tf("en")("budget:edit.totalTitle", opts)).toBe("Nov total budget");
    expect(tf("en")("budget:emptyMonthTitle", opts)).toBe(
      "No budget for Nov yet",
    );
    await i18n.changeLanguage("ko");
    expect(
      tf("ko")("budget:monthlyCap", {
        month: 11,
        monthName: formatMonthShort(11),
      }),
    ).toBe("11월 총 예산");
  });

  it("홈 · 카드 실적 · 할 일", async () => {
    await i18n.changeLanguage("en");
    const opts = { month: 11, monthName: formatMonthShort(11) };
    expect(tf("en")("dashboard:summary.monthExpenseN", opts)).toBe(
      "Nov expense",
    );
    expect(
      tf("en")("dashboard:chart.categoryName", { ...opts, total: "₩1,000" }),
    ).toBe("Nov spending by category, total ₩1,000");
    expect(tf("en")("asset:assetDetail.perfTitle", opts)).toBe("Nov target");
    expect(tf("en")("todo:tdm.emptyMonth", opts)).toBe("No todos in Nov");
  });

  it("반복 거래 — 매년 · 끝 달은 숫자 '11/5' · '12/2027' 가 아니다", async () => {
    const it = {
      frequency: "YEARLY",
      startDate: "2026-11-05",
      endDate: "2027-12-31",
      maxOccurrences: null,
      executedCount: 0,
    } as unknown as RecurringTransaction;
    await i18n.changeLanguage("en");
    const tr = i18n.getFixedT("en", "recurring");
    expect(cycleSentence(it, tr)).toBe("Yearly on Nov 5");
    expect(endPiece(it, tr)).toBe("Until Dec 2027");
    await i18n.changeLanguage("ko");
    const trKo = i18n.getFixedT("ko", "recurring");
    expect(cycleSentence(it, trKo)).toBe("매년 11월 5일");
    expect(endPiece(it, trKo)).toBe("2027년 12월까지");
  });

  it("지킴 — 한국어가 `{{month}}월` 인 문구의 영어는 숫자 달(`{{month}}`)을 쓰지 않는다", () => {
    const bad = rows
      .filter(([, , ko]) => /\{\{month\}\}월/.test(ko ?? ""))
      .filter(([, , , en]) => /\{\{month\}\}/.test(en ?? ""))
      .map(([ns, key, , en]) => `${ns}:${key} → ${en}`);
    expect(bad).toEqual([]);
  });
});

describe("개수 — 영어는 1 이면 단수", () => {
  it("QA — 카테고리 · 사람", async () => {
    await i18n.changeLanguage("en");
    const t = tf("en");
    expect(t("budget:categoryCount", { count: 1 })).toBe("1 category");
    expect(t("budget:categoryCount", { count: 2 })).toBe("2 categories");
    expect(t("dutchPay:memberCount", { count: 1 })).toBe("1 person");
    expect(t("dutchPay:memberCount", { count: 2 })).toBe("2 people");
    expect(t("dutchPay:receivableFrom", { count: 1 })).toBe("From 1 person");
    await i18n.changeLanguage("ko");
    expect(tf("ko")("budget:categoryCount", { count: 1 })).toBe("1 카테고리");
    expect(tf("ko")("dutchPay:memberCount", { count: 1 })).toBe("1명");
  });

  it("대표 — 거래 · 주식 수 · 가져오기 · 반복 횟수 · 탈퇴 안내", async () => {
    await i18n.changeLanguage("en");
    const t = tf("en");
    expect(t("expense:list.count", { count: 1 })).toBe("1 transaction");
    expect(t("expense:list.count", { count: 3 })).toBe("3 transactions");
    // 보이는 수는 쉼표를 넣은 글(countText), 단 · 복수는 숫자 count 로 고른다
    expect(t("stocks:holding.sharesUnit", { count: 1, countText: "1" })).toBe(
      "1 share",
    );
    expect(
      t("stocks:holding.sharesUnit", { count: 1234, countText: "1,234" }),
    ).toBe("1,234 shares");
    expect(t("export:import.doneTitle", { count: 1, countText: "1" })).toBe(
      "Imported 1 transaction",
    );
    expect(t("user:impact.calendarsOwned", { count: 1 })).toBe(
      "1 calendar you created will be deleted",
    );
    const it = {
      maxOccurrences: 1,
      executedCount: 0,
    } as unknown as RecurringTransaction;
    expect(endSentence(it, i18n.getFixedT("en", "recurring"))).toBe(
      "repeats 1 time (0 done)",
    );
    await i18n.changeLanguage("ko");
    expect(
      i18n.getFixedT("ko")("export:import.doneTitle", {
        count: 1234,
        countText: "1,234",
      }),
    ).toBe("1,234건을 가져왔어요");
  });

  // 늘 2 이상인 자리 — 칩은 고른 게 둘 이상일 때만, "n days ago" 는 2 ~ 6일(International Design "지난 시간"),
  // 할부는 2개월부터(INSTALLMENT_MONTHS), 상한 · 처음 n건은 고정 값
  const ALWAYS_MANY = new Set([
    "expense:filter.chipPeriods",
    "expense:filter.chipCats",
    "expense:filter.chipAssets",
    "expense:addTx.installmentMonths",
    "expense:addTx.installmentHint",
    "date:daysAgo",
    "date:daysLater",
    "recurring:errCountMax",
    "export:import.failuresCapped",
    // 한 문장에 수가 둘(행 · 종류) — 복수형 하나로 못 맞춘다. 따로 다룬다
    "export:section.previewFooter",
  ]);

  it("지킴 — `{{수}} 명사s` 영어 문구는 복수형 키다", () => {
    const COUNT_PARAMS =
      /\{\{(count|countText|n|total|dup|rows)\}\}\s+(?:[a-z-]+\s+){0,2}[a-z]+s\b/;
    const NOT_NOUN = /\b(is|was|has|this|its|as)\b$/;
    const bad = rows
      .filter(([, key]) => !/_(one|other)$/.test(key ?? ""))
      .filter(([ns, key]) => !ALWAYS_MANY.has(`${ns}:${key}`))
      .filter(([, , , en]) => {
        const m = COUNT_PARAMS.exec(en ?? "");
        return m != null && !NOT_NOUN.test(m[0]);
      })
      .map(([ns, key, , en]) => `${ns}:${key} → ${en}`);
    expect(bad).toEqual([]);
  });

  it("지킴 — 복수형 키를 부르는 곳은 count 를 넘긴다, 달 · 수 글 자리도 넘긴다", () => {
    const plural = new Set(
      rows
        .filter(([, key]) => /_one$/.test(key ?? ""))
        .map(([, key]) => key!.replace(/_one$/, "")),
    );
    const needs = new Map<string, string[]>();
    for (const [, key, , en] of rows) {
      const k = (key ?? "").replace(/_(one|other)$/, "");
      const want = [
        ...(en ?? "").matchAll(
          /\{\{(monthName|monthDay|yearMonth|countText)\}\}/g,
        ),
      ].map((m) => m[1]!);
      if (plural.has(k)) want.push("count");
      if (want.length)
        needs.set(k, [...new Set([...(needs.get(k) ?? []), ...want])]);
    }
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(path.join(ROOT, "src"));
    const bad: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const [key, want] of needs) {
        const re = new RegExp(
          `\\bt\\(\\s*["']${key.replace(/\./g, "\\.")}["']`,
          "g",
        );
        for (const m of src.matchAll(re)) {
          // 부르는 괄호가 닫히는 데까지
          let depth = 0;
          let end = m.index!;
          for (let i = m.index! + 1; i < src.length; i++) {
            if (src[i] === "(") depth++;
            else if (src[i] === ")" && --depth === 0) {
              end = i;
              break;
            }
          }
          const call = src.slice(m.index!, end);
          for (const w of want)
            if (!new RegExp(`\\b${w}\\b`).test(call))
              bad.push(`${path.relative(ROOT, file)} ${key} — ${w} 없음`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
