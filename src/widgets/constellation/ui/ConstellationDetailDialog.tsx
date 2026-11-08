import { useTranslation } from "react-i18next";
import { progressPercentValue } from "@/shared/lib/percent";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { List, ListItem } from "@/shared/ds/list";
import {
  constellationDesc,
  constellationName,
  type CollectionEntry,
  type ConstellationToday,
} from "@/features/constellation";
import { ProgressBar } from "@/shared/ds/progress";
import { useDsText } from "@/shared/ds/i18n";
import { SKY_BG } from "../lib/sky";
import { ConstellationSVG } from "./ConstellationSVG";
import { cn } from "@/shared/lib/cn";

/**
 * 별자리 상세(I-11 23, D09 · Q2-A) — ds Responsive Dialog **조회**(1280 이상 대화상자 480 · 미만 Bottom Sheet). 제목 = 별자리 이름,
 * 하늘 패널(높이 240 · 모서리 16 · 별자리 그림 180) + 설명 + 키-값 줄 둘("별 개수" · "수집"). 바깥 누름 · 끌어내림으로 닫히고 바닥 버튼이 없다.
 * 잔별 · 선 · 점등 별은 `aria-hidden` 장식이라 투명도를 남기고(하늘 그림 8 과 같은 규칙), 못 모은 별자리의 안내 글만 `fg-neutral-inverted` 불투명이다.
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
];

export function ConstellationDetailDialog({
  entry,
  today,
  collectKnown = true,
  onClose,
}: {
  entry: CollectionEntry;
  /** 도감을 아직 못 받았거나 실패하면 false — 수집 줄을 뺀다(모은 별자리를 "미수집"으로 거짓 말하지 않는다, 앱 `showCollectRow` 와 같다) */
  collectKnown?: boolean;
  /** 오늘의 목표 별자리면 하늘 카드 · 도감이 같은 값을 넘긴다 — 켠 별 + 고리 · 진행 막대(10-29 결정 2 · 3) */
  today?: ConstellationToday;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("constellation");
  const dsT = useDsText();
  const isToday =
    !!today &&
    today.constellation.constellationKey ===
      entry.constellation.constellationKey;
  // 그림 켜기 — 오늘의 목표면 켠 별 + 남은 별 고리, 아니면 모은 별자리는 전부 · 못 모은 별자리는 빈 고리
  const lightsUp = entry.collectCount > 0 || isToday;
  // 수집 줄 값은 따로 — 오늘의 목표여도 한 번도 못 모았으면 "미수집"(그림 mock.html:132 · 지시서 23)
  const collected = entry.collectCount > 0;
  const litNow = isToday ? Math.min(today.points, today.goal) : undefined;
  const pct = isToday
    ? Math.min(
        100,
        progressPercentValue((litNow! / Math.max(1, today.goal)) * 100),
      )
    : 0;
  // 목표에 닿으면 오른쪽 글은 "달성"(progress.yaml:74-80 · progress.md:56) — fg-neutral · 700
  const reached = isToday && litNow! >= today.goal;
  const pctText = reached
    ? dsT("progress.reached")
    : t("detail.todayPct", { pct });
  const name = constellationName(entry.constellation, i18n.language);
  const description = constellationDesc(entry.constellation, i18n.language);

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={name}
        description={isToday ? t("hero.todayTarget") : undefined}
      >
        <ResponsiveDialogBody>
          {/* 하늘 패널 — 역할 색 그라디언트(8 과 같다). 그림은 이름 붙은 img, 안내 글은 그 밖의 글이다 */}
          <div
            className={cn(
              "relative flex h-[240px] items-center justify-center overflow-hidden rounded-r4 text-fg-neutral-inverted",
              SKY_BG,
            )}
          >
            <div
              role="img"
              aria-label={t("detail.skyName", { name })}
              className="absolute inset-0 flex items-center justify-center"
            >
              {SKY_DIM_STARS.map(([x, y], i) => (
                <span
                  key={i}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: `${y}%`,
                    width: i % 3 === 0 ? 2.5 : 1.5,
                    height: i % 3 === 0 ? 2.5 : 1.5,
                    borderRadius: 999,
                    background:
                      "color-mix(in srgb, var(--color-fg-neutral-inverted) 30%, transparent)",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}
              <div
                aria-hidden
                style={{
                  color: lightsUp
                    ? "var(--color-fg-neutral-inverted)"
                    : "color-mix(in srgb, var(--color-fg-neutral-inverted) 40%, transparent)",
                }}
              >
                <ConstellationSVG
                  starMap={entry.constellation.starMap}
                  lit={isToday ? litNow : lightsUp ? undefined : 0}
                  glow={isToday ? litNow! > 0 : lightsUp}
                  size={180}
                />
              </div>
            </div>
            {!lightsUp && (
              <p className="absolute inset-x-0 bottom-x3_5 m-0 text-center text-t3 text-fg-neutral-inverted">
                {t("detail.notMet")}
              </p>
            )}
          </div>
          {isToday && (
            <div className="pt-x4">
              <div
                aria-hidden
                className="flex items-baseline justify-between gap-x2"
              >
                <span className="min-w-0 text-t4 font-medium text-fg-neutral">
                  {t("detail.todayProgress")}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-t3 tabular-nums",
                    reached
                      ? "font-bold text-fg-neutral"
                      : "text-fg-neutral-subtle",
                  )}
                >
                  {pctText}
                </span>
              </div>
              <ProgressBar
                className="mt-x1_5"
                value={litNow!}
                max={today.goal}
                meaning="goal"
                aria-label={dsT("progress.label", {
                  label: t("detail.todayProgress"),
                  max: today.goal,
                  current: litNow!,
                })}
                aria-valuetext={pctText}
              />
              <p
                aria-hidden
                className="m-0 mt-x1_5 text-t2 tabular-nums text-fg-neutral-subtle"
              >
                {today.goal - litNow! > 0
                  ? t("detail.todayCount", {
                      lit: litNow,
                      goal: today.goal,
                      left: today.goal - litNow!,
                    })
                  : t("hero.starlightCount", { lit: litNow, goal: today.goal })}
              </p>
            </div>
          )}
          <p className="m-0 break-keep pb-x1 pt-x4 text-t5 text-fg-neutral-muted [overflow-wrap:break-word]">
            {description}
          </p>
          {/* 줄이 제 좌우 24 를 갖는다 — 본문 여백 24 를 풀어 화면 끝까지 */}
          <List className="-mx-x6 w-[calc(100%+var(--spacing-x12))]">
            <ListItem
              title={t("detail.starCountLabel")}
              suffix={t("detail.starCountValue", {
                count: entry.constellation.starCount,
              })}
            />
            {collectKnown && (
              <ListItem
                title={t("detail.collectLabel")}
                suffix={
                  collected
                    ? t("detail.collectValue", { count: entry.collectCount })
                    : t("collection.notCollected")
                }
              />
            )}
          </List>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
