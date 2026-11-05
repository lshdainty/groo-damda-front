import { describe, expect, it } from "vitest";
import { groupByDay } from "./groupByDay";
import type { Notification } from "../model/types";

const n = (rowId: number, createAt: string): Notification => ({
  rowId,
  userRowId: 1,
  notificationType: "SYSTEM",
  title: `알림 ${rowId}`,
  message: "",
  referenceType: null,
  referenceId: null,
  isRead: false,
  readAt: null,
  createAt,
});

describe("groupByDay", () => {
  it("서버 차례를 지키며 같은 달력 날끼리 묶는다", () => {
    // 로컬 시각으로 만들어 시간대와 상관없이 같은 날 둘 · 다른 날 하나가 된다
    const d = (day: number, h: number) =>
      new Date(2026, 9, day, h, 0, 0).toISOString();
    const groups = groupByDay([
      n(1, d(23, 15)),
      n(2, d(23, 9)),
      n(3, d(22, 20)),
    ]);
    expect(groups.map((g) => g.items.map((i) => i.rowId))).toEqual([
      [1, 2],
      [3],
    ]);
  });

  it("빈 목록은 묶음이 없다", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
