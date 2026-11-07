// 달력에서 고른 기간 → 보기(월 · 분기 · 년 · 직접) — 옛 시트의 월 · 분기 · 년 탭이 하던 일
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "i18next";
import "@/shared/i18n/config";
import {
  monthRangeOf,
  periodLabel,
  previousRange,
  rangeSegModeOf,
  relativeNames,
  quarterRangeOf,
  yearRangeOf,
  type RangeState,
} from "./stats-range";

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const oct: RangeState = monthRangeOf(D(2026, 10, 29));

describe("rangeSegModeOf", () => {
  it("지금 기간 그대로면 보기를 지킨다", () => {
    expect(rangeSegModeOf(oct.from, oct.to, oct)).toBe("m");
    const custom: RangeState = { ...oct, segMode: "custom" };
    expect(rangeSegModeOf(oct.from, oct.to, custom)).toBe("custom");
  });
  it("한 달 · 한 분기 · 한 해를 정확히 채우면 그 보기", () => {
    expect(rangeSegModeOf(D(2026, 9, 1), D(2026, 9, 30), oct)).toBe("m");
    expect(rangeSegModeOf(D(2026, 2, 1), D(2026, 2, 28), oct)).toBe("m");
    expect(rangeSegModeOf(D(2026, 7, 1), D(2026, 9, 30), oct)).toBe("q");
    expect(rangeSegModeOf(D(2026, 1, 1), D(2026, 12, 31), oct)).toBe("y");
  });
  it("직접 7/1 ~ 9/30 → 분기 보기, 이전 기간은 4/1 ~ 6/30 (오늘이 든 분기가 아니어도)", () => {
    const from = D(2026, 7, 1);
    const to = D(2026, 9, 30);
    const segMode = rangeSegModeOf(from, to, oct);
    expect(segMode).toBe("q");
    const prev = previousRange({ from, to, segMode });
    expect(prev.from).toEqual(D(2026, 4, 1));
    expect(prev.to).toEqual(D(2026, 6, 30));
  });
  it("지난 달 → 월 보기, 비교는 그 전달", () => {
    const from = D(2026, 9, 1);
    const to = D(2026, 9, 30);
    const segMode = rangeSegModeOf(from, to, oct);
    expect(segMode).toBe("m");
    expect(previousRange({ from, to, segMode })).toEqual({
      from: D(2026, 8, 1),
      to: D(2026, 8, 31),
    });
  });
  it("그 밖은 직접", () => {
    expect(rangeSegModeOf(D(2026, 7, 1), D(2026, 10, 31), oct)).toBe("custom");
    expect(rangeSegModeOf(D(2026, 10, 1), D(2026, 10, 30), oct)).toBe("custom");
    expect(rangeSegModeOf(D(2026, 10, 12), D(2026, 10, 12), oct)).toBe(
      "custom",
    );
  });
});

// 상대 말 글 규칙 — 오늘을 품은 월 · 분기 · 해는 지금 글, 아니면 실제 이름, 직접은 그대로(고정 시계: 2026-10-29)
const KO: Record<string, string> = {
  "period.m.now": "이번 달",
  "period.m.prev": "지난 달",
  "period.q.now": "이번 분기",
  "period.q.prev": "지난 분기",
  "period.y.now": "올해",
  "period.y.prev": "작년",
  "period.custom.now": "선택 기간",
  "period.custom.prev": "이전 기간",
};
const tKo = (k: string) => KO[k] ?? k;
const TODAY = D(2026, 10, 29);
beforeAll(async () => {
  await i18n.changeLanguage("ko");
});

describe("relativeNames — 영문 문장 안 이름", () => {
  const tEn = (k: string) =>
    ({
      "period.m.now": "This month",
      "period.m.prev": "Last month",
      "period.y.now": "This year",
      "period.y.prev": "Last year",
    })[k] ?? k;
  it("상대 말은 문장 안에서 소문자, 맨 앞용은 그대로", () => {
    expect(relativeNames(monthRangeOf(TODAY), TODAY, tEn)).toEqual({
      now: "This month",
      prev: "Last month",
      nowInline: "this month",
      prevInline: "last month",
    });
    const y = relativeNames(yearRangeOf(TODAY), TODAY, tEn);
    expect([y.prev, y.prevInline]).toEqual(["Last year", "last year"]);
  });
});

describe("relativeNames", () => {
  it("오늘을 품은 달 · 분기 · 해는 지금 글 그대로", () => {
    expect(relativeNames(monthRangeOf(TODAY), TODAY, tKo)).toMatchObject({
      now: "이번 달",
      prev: "지난 달",
    });
    expect(relativeNames(quarterRangeOf(TODAY), TODAY, tKo)).toMatchObject({
      now: "이번 분기",
      prev: "지난 분기",
    });
    expect(relativeNames(yearRangeOf(TODAY), TODAY, tKo)).toMatchObject({
      now: "올해",
      prev: "작년",
    });
  });
  it("오늘을 품지 않으면 실제 이름 — 지난 달 → 2026년 9월 / 2026년 8월", () => {
    const sep = {
      from: D(2026, 9, 1),
      to: D(2026, 9, 30),
      segMode: "m" as const,
    };
    expect(relativeNames(sep, TODAY, tKo)).toMatchObject({
      now: "2026년 9월",
      prev: "2026년 8월",
    });
  });
  it("7/1 ~ 9/30 → 2026년 3분기 / 2026년 2분기, 2025년 / 2024년", () => {
    const q3 = {
      from: D(2026, 7, 1),
      to: D(2026, 9, 30),
      segMode: rangeSegModeOf(D(2026, 7, 1), D(2026, 9, 30), oct),
    };
    expect(relativeNames(q3, TODAY, tKo)).toMatchObject({
      now: "2026년 3분기",
      prev: "2026년 2분기",
    });
    expect(relativeNames(yearRangeOf(D(2025, 5, 5)), TODAY, tKo)).toMatchObject(
      {
        now: "2025년",
        prev: "2024년",
      },
    );
  });
  it("직접은 그대로 — 선택 기간 / 이전 기간", () => {
    const custom = {
      from: D(2026, 8, 1),
      to: D(2026, 10, 31),
      segMode: "custom" as const,
    };
    expect(relativeNames(custom, TODAY, tKo)).toMatchObject({
      now: "선택 기간",
      prev: "이전 기간",
    });
  });
});

describe("periodLabel — 직접 기간은 날짜 규칙의 기간 줄(앞뒤 붙인 구간 기호)", () => {
  const y = new Date().getFullYear();
  it("올해 안이면 줄임", () => {
    expect(
      periodLabel({ from: D(y, 8, 1), to: D(y, 10, 31), segMode: "custom" }),
    ).toBe("8월 1일~10월 31일");
  });
  it("다른 해가 끼면 양끝 연도(ISO 가 아니다)", () => {
    expect(
      periodLabel({
        from: D(y - 1, 12, 29),
        to: D(y, 1, 4),
        segMode: "custom",
      }),
    ).toBe(`${y - 1}년 12월 29일~${y}년 1월 4일`);
  });
});
