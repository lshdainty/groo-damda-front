/**
 * 알림 type 별 비주얼(아이콘 + 차트 색) 공용 매핑 — 종류 타일 40 · 모서리 12 · 아이콘 20 의 색(I-15 43).
 * 바탕은 차트 색의 옅은 바탕(chart-{색}-weak), 아이콘은 그 색(list.md Prefix 타일).
 * - BUDGET_ALERT   → triangle-alert  / chart-orange
 * - TODO_REMINDER  → list-checks     / chart-blue
 * - EVENT_REMINDER → calendar-clock  / chart-green
 * - SYSTEM(기본)   → bell            / chart-gray
 */
import { AlertTriangle, Bell, CalendarClock, ListChecks } from "lucide-react";
import type { NotificationType } from "../model/types";

export interface NotificationVisual {
  /** lucide 아이콘 컴포넌트. */
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** 아이콘 칩 배경 토큰. */
  bg: string;
  /** 아이콘 전경(글자) 색 토큰. */
  fg: string;
}

/** 알림 type → { Icon, bg, fg } tone 비주얼 매핑. */
export function notificationVisual(type: NotificationType): NotificationVisual {
  switch (type) {
    case "BUDGET_ALERT":
      return {
        Icon: AlertTriangle,
        bg: "var(--color-chart-orange-weak)",
        fg: "var(--color-chart-orange)",
      };
    case "TODO_REMINDER":
      return {
        Icon: ListChecks,
        bg: "var(--color-chart-blue-weak)",
        fg: "var(--color-chart-blue)",
      };
    case "EVENT_REMINDER":
      return {
        Icon: CalendarClock,
        bg: "var(--color-chart-green-weak)",
        fg: "var(--color-chart-green)",
      };
    default:
      return {
        Icon: Bell,
        bg: "var(--color-chart-gray-weak)",
        fg: "var(--color-chart-gray)",
      };
  }
}
