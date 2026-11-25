// 가린 금액의 점은 어디서나 4개 — 공용 상수 하나만 쓴다(2026-11-25 사용자 결정). 예외는 가계부 달력 칸(아주 좁은 칸)의 2개뿐.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HIDE_AMOUNTS_MASK,
  HIDE_AMOUNTS_MASK_NARROW,
} from "@/shared/lib/groo/hide-amounts-core";

const SRC = path.resolve(__dirname, "../../..");
const CORE = path.join("shared", "lib", "groo", "hide-amounts-core.ts");

/** src 아래 제품 코드(시험 파일 제외) */
const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test(-utils)?\.tsx?$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(path.join(SRC, f), "utf8") }));

describe("가린 금액 점(공용 상수)", () => {
  it("기본은 4개, 좁은 칸 예외는 2개", () => {
    expect(HIDE_AMOUNTS_MASK).toBe("••••");
    expect(HIDE_AMOUNTS_MASK_NARROW).toBe("••");
  });

  it("점 두 개 이상을 직접 쓴 곳이 없다 — 상수 정의 파일만", () => {
    const hits = sources
      .filter(
        ({ file, text }) =>
          file !== CORE && /•{2,}|(\\u2022){2,}|(&bull;){2,}/.test(text),
      )
      .map(({ file }) => file);
    expect(hits).toEqual([]);
  });

  it("좁은 칸 예외는 가계부 달력 칸에서만 쓴다", () => {
    const users = sources
      .filter(
        ({ file, text }) =>
          file !== CORE && text.includes("HIDE_AMOUNTS_MASK_NARROW"),
      )
      .map(({ file }) => file);
    expect(users).toEqual([
      path.join("pages", "expense", "ui", "ExpenseMobile.tsx"),
    ]);
  });

  it("가리면 점만 — 부호 · 단위를 가림 밖에 붙인 코드가 없다", () => {
    // `MINUS + m(…)` · `${sign}${mask(…)}` · `${m(…)}원` 처럼 붙이면 가린 금액 앞뒤에 부호 · 단위가 남는다
    const outside =
      /(MINUS|sign|"[+−]")\s*\+\s*(m|mask|masked)\(|\$\{(MINUS|sign)\}\$\{(m|mask|masked)\(|\b(m|mask|masked)\([^()]*(\([^()]*\))?[^()]*\)\}(원|₩)/;
    const hits = sources
      .flatMap(({ file, text }) =>
        text.split("\n").map((line, i) => ({ file, i, line })),
      )
      .filter(({ line }) => outside.test(line))
      .map(({ file, i, line }) => `${file}:${i + 1}: ${line.trim()}`);
    expect(hits).toEqual([]);
  });

  it("단위를 자리표시자 옆에 둔 문장은 가린 값을 받지 않는 것뿐이다", () => {
    // 가린 값이 들어가는 문장은 단위를 값 안에 담아 넘긴다(가리면 점만 — "••••원" · "₩••••" 이 되지 않게).
    // 아래는 가리지 않는 자리(입력 폼 · 카드 상품 정보 · 문장째 가리는 오늘 변동)다. 새 문장이 여기 걸리면 값에 단위를 담을 것.
    const csv = readFileSync(
      path.resolve(SRC, "../i18n/translations.csv"),
      "utf8",
    );
    const keys = csv
      .split("\n")
      .filter((l) => /\{\{\w+\}\}원|₩\{\{/.test(l))
      .map((l) => l.split(",").slice(0, 2).join(":"));
    expect(keys).toEqual([
      "asset:editDialog.annualFeeValue",
      "card:benefit.annualFeeAmount",
      "card:benefit.performanceAmount",
      "card:benefit.annualFeeDomestic",
      "card:benefit.performanceAtLeast",
      "category:overBudgetMessage",
      "expense:addTx.installmentHint",
      "expense:addTx.fxHint",
      "expense:addTx.interestSplit",
      "expense:addTx.splitDiffOver",
      "expense:addTx.splitDiffShort",
      "expense:addTx.splitMismatchBody",
      "subscription:pricePerMonthNote",
      "asset:holdings.avgPriceInline",
      "asset:holdings.todayChange",
      "asset:holdings.editSummary_one",
      "asset:holdings.editSummary_other",
    ]);
  });
});
