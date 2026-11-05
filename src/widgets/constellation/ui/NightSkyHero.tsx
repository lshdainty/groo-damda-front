import { useId, useMemo, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Cloud, Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { SKY_BG } from "../lib/sky";
import {
  constellationName,
  parseStarMap,
  useConstellationCollection,
  type CollectionEntry,
  type ConstellationToday,
} from "@/features/constellation";
import { ConstellationDetailDialog } from "./ConstellationDetailDialog";

/**
 * 밤하늘 하늘 카드(I-11 8 · 10-29 결정 1 = P2) — 오늘의 목표 별자리가 별빛만큼 점등된다.
 * 하늘 바탕은 역할 색 그라디언트(01-033 C — `SKY_BG`), 글은 흐르는 차례로 쌓아 겹치지 않고, 글 · 아이콘 색은 `fg-neutral-inverted` 하나다 —
 * 불투명도로 흐리지 않는다(달빛 · 잔별 · 그림 같은 장식 `aria-hidden` 만 투명도를 남긴다).
 * 배경 층 별자리는 걷고, 오른쪽 위에 별자리 썸네일 88(켠 별 밝게 · 남은 별 고리)을 둔다. 카드 전체(썸네일 포함)를 누르면 상세 시트.
 * 폰 · 원장 펼침은 안 여백 20, 데스크톱 카드(`wide`)는 24.
 */
const SKY_DIM_STARS: [number, number][] = [
  [5, 18],
  [11, 72],
  [17, 30],
  [22, 84],
  [28, 12],
  [33, 52],
  [38, 88],
  [45, 8],
  [55, 90],
  [62, 10],
  [68, 86],
  [75, 20],
  [83, 78],
  [90, 14],
  [95, 52],
  [8, 48],
  [92, 82],
  [60, 30],
  [20, 58],
  [86, 44],
];

const SIZE = 88;

/** 썸네일 — 정비율 88 안에 별자리(켠 별 + 글로 · 남은 별 고리 · 켠 별끼리만 점선). 장식이라 읽지 않는다 */
function HeroFigure({
  starMap,
  lit,
  done,
}: {
  starMap: string;
  lit: number;
  done: boolean;
}) {
  const map = useMemo(() => parseStarMap(starMap), [starMap]);
  const k = 100 / SIZE;
  const lineColor = done
    ? "color-mix(in srgb, var(--color-fg-neutral-inverted) 85%, transparent)"
    : "color-mix(in srgb, var(--color-fg-neutral-inverted) 50%, transparent)";
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={SIZE}
      height={SIZE}
      className="block shrink-0 overflow-visible"
    >
      {map.edges.map(([a, b], i) => {
        const pa = map.pts[a];
        const pb = map.pts[b];
        if (!pa || !pb || a >= lit || b >= lit) return null;
        return (
          <line
            key={i}
            x1={pa[0]}
            y1={pa[1]}
            x2={pb[0]}
            y2={pb[1]}
            stroke={lineColor}
            strokeWidth={1 * k}
            strokeLinecap="round"
            strokeDasharray={done ? "none" : `${3 * k} ${4 * k}`}
          />
        );
      })}
      {map.pts.map(([x, y], i) =>
        i < lit ? (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.5 * k}
            fill="var(--color-fg-neutral-inverted)"
            style={{
              filter:
                "drop-shadow(0 0 3px color-mix(in srgb, var(--color-fg-neutral-inverted) 55%, transparent))",
            }}
          />
        ) : (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={1.8 * k}
            fill="none"
            stroke="color-mix(in srgb, var(--color-fg-neutral-inverted) 45%, transparent)"
            strokeWidth={1 * k}
          />
        ),
      )}
    </svg>
  );
}

/** 상세 시트 — 도감은 시트를 열 때만 받는다(할 일 화면이 도감 86줄을 미리 받지 않게). 도감이 아직 없거나 실패하면 수집 줄을 뺀다 */
function TodaySkyDetail({
  today,
  onClose,
}: {
  today: ConstellationToday;
  onClose: () => void;
}) {
  const collectionQ = useConstellationCollection({ reference: true });
  const entry: CollectionEntry = useMemo(
    () =>
      collectionQ.data?.entries.find(
        (e) =>
          e.constellation.constellationKey ===
          today.constellation.constellationKey,
      ) ?? {
        constellation: today.constellation,
        collectCount: 0,
        lastCollectedDate: null,
      },
    [collectionQ.data, today.constellation],
  );
  return (
    <ConstellationDetailDialog
      entry={entry}
      today={today}
      collectKnown={!!collectionQ.data}
      onClose={onClose}
    />
  );
}

// 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) — Card 와 같다(그라디언트 면은 2px 축소만, card.yaml:184-186)
function measurePress(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}

export function NightSkyHero({
  today,
  doneToday,
  wide = false,
}: {
  today: ConstellationToday;
  doneToday: number;
  /** 데스크톱 카드 — 안 여백 24 (폰 20) */
  wide?: boolean;
}) {
  const { t, i18n } = useTranslation("constellation");
  const [open, setOpen] = useState(false);
  const lit = Math.min(today.points, today.goal);
  const done = today.collected;
  const name = constellationName(today.constellation, i18n.language);
  const ids = { desc: useId(), rows: useId() };

  const label = done ? t("hero.collectedBang", { name }) : name;
  const caption = done
    ? t("hero.captionDone")
    : doneToday > 0 || today.memoPoints > 0
      ? [
          t("hero.captionProgress", { count: doneToday }),
          today.memoPoints > 0
            ? t("hero.captionMemo", { count: today.memoPoints })
            : null,
          t("hero.captionRemain", { count: today.goal - lit }),
        ]
          .filter(Boolean)
          .join(" · ")
      : t("hero.captionEmpty");

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t("hero.label", { name, lit, goal: today.goal })}
        aria-describedby={`${ids.desc} ${ids.rows}`}
        onClick={() => setOpen(true)}
        onPointerDown={measurePress}
        data-slot="night-sky-hero"
        className={cn(
          "relative flex w-full min-h-[168px] cursor-pointer flex-col overflow-hidden rounded-r4 border-0 p-x5 text-left font-sans text-fg-neutral-inverted",
          "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] active:[scale:calc(1-2/var(--press-basis,200))] motion-reduce:active:[scale:1]",
          wide && "p-x6",
          SKY_BG,
        )}
      >
        {/* 장식 — 달빛 · 잔별(aria-hidden, 투명도 남김) */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -20,
              width: 180,
              height: 180,
              borderRadius: 999,
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-fg-neutral-inverted) 16%, transparent) 0%, transparent 65%)",
            }}
          />
          {SKY_DIM_STARS.map(([x, y], i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: i % 3 === 0 ? 2.5 : 1.5,
                height: i % 3 === 0 ? 2.5 : 1.5,
                borderRadius: 999,
                background:
                  "color-mix(in srgb, var(--color-fg-neutral-inverted) 32%, transparent)",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>

        {/* 글 왼쪽 · 썸네일 오른쪽 위(안 여백에서 −4, 글과 12) */}
        <span className="relative flex items-start gap-x3">
          <span className="min-w-0 flex-1">
            <span className="block text-t3 text-fg-neutral-inverted">
              {t("hero.todayTarget")}
            </span>
            <span className="mt-x0_5 flex flex-wrap items-baseline gap-x-x2">
              <span className="min-w-0 break-keep text-t8 font-bold text-fg-neutral-inverted [overflow-wrap:break-word]">
                {label.slice(0, -1)}
                <span className="whitespace-nowrap">
                  {label.slice(-1)}
                  <ChevronRight
                    aria-hidden
                    className="ml-x0_5 inline size-x5 align-[-3px]"
                  />
                </span>
              </span>
              <span className="whitespace-nowrap text-t4 font-bold tabular-nums text-fg-neutral-inverted">
                {t("hero.starlightCount", { lit, goal: today.goal })}
              </span>
            </span>
          </span>
          <span className="-mr-x1 -mt-x1">
            <HeroFigure
              starMap={today.constellation.starMap}
              lit={lit}
              done={done}
            />
          </span>
        </span>
        <span
          id={ids.desc}
          className="relative mt-auto block break-keep pt-x4 text-t3 text-fg-neutral-inverted [overflow-wrap:break-word]"
        >
          {caption}
        </span>
        <span
          id={ids.rows}
          className="relative mt-x2 flex flex-wrap items-center gap-x-x3 gap-y-x1_5 text-t3 text-fg-neutral-inverted"
        >
          <span className="inline-flex items-start gap-x1 font-bold">
            <span aria-hidden className="flex h-[1lh] items-center">
              <Sparkles className="size-x3_5 shrink-0" />
            </span>
            {t("hero.streak", { count: today.streak })}
          </span>
          <span className="inline-flex items-start gap-x1">
            <span aria-hidden className="flex h-[1lh] items-center">
              <Cloud className="size-x3_5 shrink-0" />
            </span>
            {t("hero.guardInfo", { count: today.guardCount })}
          </span>
        </span>
      </button>
      {open && <TodaySkyDetail today={today} onClose={() => setOpen(false)} />}
    </>
  );
}
