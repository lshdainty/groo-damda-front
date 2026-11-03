import type { IEvent } from "@/widgets/calendar/model/interfaces";

/** 일정 한 건을 가리키는 키 — 반복은 회차(날)까지. 상세를 닫고 돌아올 때 그 줄로 초점을 돌리고, 저장 뒤 상세를 다시 찾을 때 쓴다 */
export const eventKey = (e: Pick<IEvent, "id" | "startDate">) =>
  `${e.id}|${e.startDate.slice(0, 10)}`;

export type EventRef = { id: number; day: string };

/** 키로 쓴 (id, 날) — 반복 일정은 같은 id 의 회차들 가운데 그 날 것, 반복이 아니면 id 만 본다 */
export function findEvent(events: IEvent[], ref: EventRef): IEvent | undefined {
  const same = events.filter(
    (e) => e.sourceType === "calendar" && e.id === ref.id,
  );
  return (
    same.find((e) => e.startDate.slice(0, 10) === ref.day) ??
    (same.length === 1 && !same[0]!.rrule ? same[0] : undefined)
  );
}

export const refOf = (e: Pick<IEvent, "id" | "startDate">): EventRef => ({
  id: e.id,
  day: e.startDate.slice(0, 10),
});
