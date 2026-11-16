import { useTranslation } from "react-i18next";

import { eventBadgeTone } from "@/widgets/calendar/lib/helpers";
import { cn } from "@/shared/lib/cn";

import type { ChipSlot } from "./month-model";

/**
 * 월 격자 칸 안의 글자 칩 (I-09 10 · 16) — 일정 색의 옅은 바탕(`chart-{색}-weak`) + 그 위 글(`-contrast`).
 * 폰은 높이 18 · 좌우 3, 데스크톱 · 태블릿은 높이 20 · 좌우 6. t2 12 · 500 · 한 줄 · 끝 말줄임.
 * 글자가 커지면 높이가 따라 커진다(최소 높이 + 줄 높이). 이어지는 일정은 지금 모양 그대로 — 첫 · 사이 · 끝 조각이
 * 이웃 칸으로 이어지고 제목은 행마다 한 번 띠 가운데에 그린다.
 */
export type ChipDensity = "phone" | "wide";

/** 이어지는 띠가 칸 사이를 건너는 폭 — 칸 안쪽 여백(+ 데스크톱은 칸 선 1) */
const BRIDGE: Record<ChipDensity, number> = { phone: 1, wide: 5 };

const BOX: Record<ChipDensity, string> = {
  phone: "min-h-x4_5 px-[3px] py-px",
  wide: "min-h-x5 px-x1_5 py-x0_5",
};

export function MonthChip({
  slot,
  density,
  onClick,
  className,
}: {
  slot: ChipSlot;
  density: ChipDensity;
  /** 주면 누르는 칩(role=button) — 폰은 칸 전체가 누르는 자리라 주지 않는다 */
  onClick?: (event: ChipSlot["event"], el: HTMLElement) => void;
  className?: string;
}) {
  const { event, part, labelDays } = slot;
  const tone = eventBadgeTone(event);
  const bridge = BRIDGE[density];
  const host = labelDays > 0;
  const interactive = onClick != null;

  return (
    <div
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onClick: (e: React.MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              onClick(event, e.currentTarget);
            },
            onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(event, e.currentTarget);
              }
            },
          }
        : { "aria-hidden": true })}
      data-slot="month-chip"
      data-part={part}
      className={cn(
        "relative block select-none whitespace-nowrap rounded-r1 text-t2 font-medium",
        BOX[density],
        part === "none" && "truncate",
        part === "first" && "z-10 rounded-r-none",
        part === "middle" && "z-10 rounded-none",
        part === "last" && "z-10 rounded-l-none",
        // 제목을 그리는 조각만 넘침을 열고 이웃 조각(z-10)보다 위로 — 아니면 제목이 이웃 조각 아래 깔린다
        host ? "z-20 overflow-visible" : part !== "none" && "overflow-hidden",
        interactive &&
          "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
        className,
      )}
      style={{
        background: tone.bg,
        color: tone.fg,
        marginLeft: part === "middle" || part === "last" ? -bridge : undefined,
        marginRight:
          part === "middle" || part === "first" ? -bridge : undefined,
      }}
    >
      {part === "none" ? (
        event.title
      ) : (
        // 띠 칸: 칩 높이만 지킨다. 제목은 행 조각 전체 폭에 걸쳐 가운데(넘치면 왼쪽 맞춤 + 말줄임) — 사용자 결정
        <>
          <span aria-hidden className="invisible">
            &nbsp;
          </span>
          {host && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden"
              style={{ width: `${labelDays * 100}%` }}
            >
              <span className="block w-full truncate px-x1 text-center">
                {event.title}
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** 비어 있는 줄 — 띠가 줄을 맞추려고 남긴 자리. 칩과 같은 높이(글자 크기를 따른다)를 차지한다 */
export function MonthChipSpacer({ density }: { density: ChipDensity }) {
  return (
    <div
      aria-hidden
      data-slot="month-chip-spacer"
      className={cn("invisible block text-t2 font-medium", BOX[density])}
    >
      &nbsp;
    </div>
  );
}

/** 접힌 일정 수 "+N개" — t2 12/16 · 700 · fg-neutral-muted. 폰은 좌우 3, 데스크톱은 왼쪽 10 · 위 2 */
export function MonthMore({
  count,
  density,
}: {
  count: number;
  density: ChipDensity;
}) {
  const { t } = useTranslation("calendar");
  return (
    <div
      aria-hidden
      data-slot="month-more"
      className={cn(
        "whitespace-nowrap text-t2 font-bold text-fg-neutral-muted",
        // 폰 칸은 좁아 큰 글자에서 "+N개" 가 칸보다 넓을 수 있다 — 말줄임("+…")으로 수를 잃지 않고 이웃 칸으로 살짝 넘긴다
        density === "phone" ? "px-[3px]" : "truncate px-x2_5 pt-x0_5",
      )}
    >
      {t("monthView.moreCount", { count })}
    </div>
  );
}
