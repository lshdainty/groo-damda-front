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
});
