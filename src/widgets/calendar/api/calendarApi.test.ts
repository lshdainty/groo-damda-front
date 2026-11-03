// 일정 수정(PUT)은 **종류(eventType)를 싣지 않는다.**
//
// 수정 폼에는 종류를 고르는 칸이 없다. 그런데도 본문에 값이 실려 나갔고, 그 값은
// 화면이 지어낸 "PERSONAL" 이었다 — 업무·생일 일정을 한 번 수정하면 개인 일정이
// 됐다(QA #89). 서버는 값이 없으면 기존 종류를 그대로 둔다.
//
// 값을 되싣는 대신 아예 빼는 쪽을 골랐다. 되실으면 화면이 읽어 온 종류가 어느
// 경로에서든 한 번 흐트러지는 순간 다시 덮어쓰기가 된다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventFormValues } from "@/entities/calendar";

const { put, post, del } = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  apiClient: { put, post, get: vi.fn(), delete: del },
}));

const { calendarApi } = await import("./calendarApi");

const workEvent: CalendarEventFormValues = {
  title: "주간회의",
  eventType: "WORK",
  color: "#2c70bf",
  startDate: "2026-09-07",
  endDate: "2026-09-07",
  isAllDay: true,
};

beforeEach(() => {
  put.mockReset().mockResolvedValue({ data: {} });
  del.mockReset().mockResolvedValue({ data: null });
  post.mockReset().mockResolvedValue({ data: {} });
});

const bodyOf = (fn: typeof put) =>
  fn.mock.calls[0]![1] as Record<string, unknown>;

describe("일정 수정 PUT 본문", () => {
  it("eventType 을 담지 않는다 — 담으면 업무 일정이 개인으로 덮인다(QA #89)", async () => {
    await calendarApi.updateEvent(7, workEvent);

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0]![0]).toBe("/v1/calendar/event/7");
    expect(bodyOf(put)).not.toHaveProperty("eventType");
  });

  it("폼이 개인 일정을 들고 있어도 마찬가지다 — 값을 보고 거르지 않는다", async () => {
    await calendarApi.updateEvent(7, { ...workEvent, eventType: "PERSONAL" });

    expect(bodyOf(put)).not.toHaveProperty("eventType");
  });

  it("나머지 값은 그대로 간다 — 종류만 빼는 것이지 본문을 줄이는 게 아니다", async () => {
    await calendarApi.updateEvent(7, workEvent);

    expect(bodyOf(put)).toMatchObject({
      title: "주간회의",
      color: "#2c70bf",
      isAllDay: "Y",
      startDate: "2026-09-07T00:00:00",
      endDate: "2026-09-07T23:59:59",
    });
  });
});

describe("반복 일정 수정 — 연 회차의 원래 시작(QA 30 2)", () => {
  it("occurrenceStartDate 를 조회가 준 모양 그대로 싣는다", async () => {
    await calendarApi.updateEvent(7, {
      ...workEvent,
      isAllDay: false,
      startDate: "2026-09-21T10:00",
      endDate: "2026-09-21T11:00",
      rrule: "FREQ=WEEKLY",
      occurrenceStartDate: "2026-09-21T10:00:00",
    });

    expect(bodyOf(put)).toMatchObject({
      startDate: "2026-09-21T10:00:00",
      occurrenceStartDate: "2026-09-21T10:00:00",
    });
  });

  it("안 실은 수정은 키가 없다 — 서버가 보낸 날짜를 그대로 새 시작으로 쓴다", async () => {
    await calendarApi.updateEvent(7, workEvent);

    expect(bodyOf(put)).not.toHaveProperty("occurrenceStartDate");
  });
});

describe("일정 생성 POST 본문", () => {
  // 생성은 반대다 — 아직 종류가 없는 행이라 화면이 정해 줘야 한다.
  // 서버도 값이 없으면 PERSONAL 로 채운다(CalendarEvent.createEvent).
  it("eventType 을 그대로 싣는다", async () => {
    await calendarApi.createEvent({ ...workEvent, eventType: "PERSONAL" });

    expect(bodyOf(post)).toMatchObject({ eventType: "PERSONAL" });
  });
});

// silent 는 호출처 옵션이다 — 옵션이 없으면 요청 설정 자체를 넘기지 않아 전역 토스트가 그대로 난다
describe("silent 옵션", () => {
  it("옵션이 없으면 설정을 넘기지 않는다(생성 · 수정)", async () => {
    await calendarApi.createEvent(workEvent);
    await calendarApi.updateEvent(7, workEvent);
    expect(post.mock.calls[0]![2]).toBeUndefined();
    expect(put.mock.calls[0]![2]).toBeUndefined();
  });

  it("silent: true 면 { silent: true } 를 싣는다(생성 · 수정)", async () => {
    await calendarApi.createEvent(workEvent, { silent: true });
    await calendarApi.updateEvent(7, workEvent, { silent: true });
    expect(post.mock.calls[0]![2]).toEqual({ silent: true });
    expect(put.mock.calls[0]![2]).toEqual({ silent: true });
  });
});

describe("삭제의 silent 옵션 (I-09b W8)", () => {
  it("옵션이 없으면 설정을 넘기지 않고, silent: true 면 { silent: true } 를 싣는다", async () => {
    await calendarApi.deleteEvent(7);
    await calendarApi.deleteEvent(7, { silent: true });
    expect(del.mock.calls[0]![0]).toBe("/v1/calendar/event/7");
    expect(del.mock.calls[0]![1]).toBeUndefined();
    expect(del.mock.calls[1]![1]).toEqual({ silent: true });
  });
});
