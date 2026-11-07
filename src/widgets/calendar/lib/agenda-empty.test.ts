import { describe, expect, it } from "vitest";

import { agendaEmptyReason } from "./agenda-empty";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

const ev = (startDate: string, endDate = startDate) =>
  ({ startDate, endDate }) as IEvent;
const oct = new Date(2026, 9, 21);

describe("agendaEmptyReason", () => {
  it("달에 일정이 없고 캘린더가 보이면 month", () => {
    expect(agendaEmptyReason([], oct, [1, 2], () => true)).toBe("month");
  });
  it("다른 달 일정만 있으면 month", () => {
    expect(
      agendaEmptyReason([ev("2026-11-02T10:00:00")], oct, [1], () => true),
    ).toBe("month");
  });
  it("캘린더를 모두 숨겨 0건이면 filtered", () => {
    expect(agendaEmptyReason([], oct, [1, 2], () => false)).toBe("filtered");
  });
  it("일부만 보이는데 거른 목록이 0건이고 이 달 일정이 있으면 filtered", () => {
    expect(
      agendaEmptyReason(
        [ev("2026-10-05T10:00:00")],
        oct,
        [1, 2],
        (id) => id === 1,
      ),
    ).toBe("filtered");
  });
  it("달 경계를 걸친 여러 날 일정도 이 달 일정이다", () => {
    expect(
      agendaEmptyReason(
        [ev("2026-09-29T00:00:00", "2026-10-02T23:59:59")],
        oct,
        [1],
        () => true,
      ),
    ).toBe("filtered");
  });
  it("캘린더가 하나도 없으면(아직 못 받음) 숨긴 것이 아니다", () => {
    expect(agendaEmptyReason([], oct, [], () => false)).toBe("month");
  });
});
