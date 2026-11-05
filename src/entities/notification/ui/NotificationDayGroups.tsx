import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { List, ListHeader } from "@/shared/ds/list";
import { formatMonthDayDow } from "@/shared/lib/date";
import { groupByDay } from "../lib/groupByDay";
import type { Notification } from "../model/types";

/**
 * 날짜 묶음 목록(I-15 43) — 날짜 머리(List Header mediumWeak · h2 "10월 23일 (금) · 오늘") + 줄.
 * 머리 위 16 · 첫 머리 8. 알림 화면과 벨 팝오버 · 시트가 같은 부품을 쓴다.
 * `now` 는 줄의 상대시각과 같은 기준점(useNow)이다.
 */
export function NotificationDayGroups({
  items,
  now,
  renderRow,
  headingAs = "h2",
}: {
  items: readonly Notification[];
  now: number;
  renderRow: (n: Notification) => ReactNode;
  /** 카드 · 시트 · 팝오버 안이면 h3 */
  headingAs?: "h2" | "h3";
}) {
  const { t } = useTranslation("date");
  const { t: tn } = useTranslation("notification");
  const uid = useId();
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = keyOf(today);
  const yesterdayKey = keyOf(yesterday);

  return (
    <>
      {groupByDay(items).map((g, i) => {
        if (!g.date)
          return (
            <section key="unknown">
              <List aria-label={tn("title")}>{g.items.map(renderRow)}</List>
            </section>
          );
        const day = formatMonthDayDow(g.date);
        const label =
          g.key === todayKey
            ? `${day} · ${t("today")}`
            : g.key === yesterdayKey
              ? `${day} · ${t("yesterday")}`
              : day;
        const hid = `${uid}-${g.key}`;
        return (
          <section key={g.key}>
            <ListHeader
              as={headingAs}
              id={hid}
              className={i === 0 ? "pt-x2" : "pt-x4"}
            >
              {label}
            </ListHeader>
            <List aria-labelledby={hid}>{g.items.map(renderRow)}</List>
          </section>
        );
      })}
    </>
  );
}
