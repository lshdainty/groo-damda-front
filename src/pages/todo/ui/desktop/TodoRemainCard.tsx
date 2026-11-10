import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import { Card, CardHeader, CardTitle } from "@/shared/ds/card";
import { List, ListHeader, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import type { Todo } from "@/entities/todo";
import {
  PRIO_KEYS,
  remainByPrio,
  remainByTag,
} from "@/pages/todo/model/todo-ledger";

/**
 * 남은 할 일 카드 (I-10 32) — 옛 "태그별 분포" · "우선순위" 두 카드를 하나로. 머리 "남은 할 일" 아래 두 묶음("태그" · "우선순위"),
 * 둘 다 남은(안 끝낸) 할 일을 세므로 합이 같다. 달 · 거르기와 상관없이 전체를 센다.
 * 태그 줄: 그 태그 색 점(장식) + 이름(줄바꿈) + "7개". 남은 것이 0 인 태그는 줄을 두지 않고 "태그 없음" 은 그런 할 일이 있을 때 맨 뒤에.
 * 우선순위 줄: 우선순위 배지(그 글이 제목) + "9개". 셋 모두 늘 둔다(0 이어도 "0개"). 막대 · 비율은 두지 않는다.
 */
export function TodoRemainCard({
  todos,
  tagNames,
  tagColors,
  loading,
}: {
  todos: readonly Todo[];
  tagNames: readonly string[];
  /** 태그 이름 → 색 이름(설정 태그) — 없으면 기본 색 */
  tagColors: ReadonlyMap<string, string | null>;
  loading: boolean;
}) {
  const { t } = useTranslation("todo");
  const tagHead = useId();
  const prioHead = useId();
  const byTag = remainByTag(todos, tagNames);
  const byPrio = remainByPrio(todos);
  return (
    <Card body="list" data-slot="todo-remain-card">
      <CardHeader>
        <CardTitle>{t("remain.title")}</CardTitle>
      </CardHeader>
      {loading ? (
        <div aria-busy="true" className="px-x6 pb-x3 pt-x3">
          <Skeleton text="t4" className="w-12" />
          <Skeleton text="t5" className="mt-x3 w-full" />
          <Skeleton text="t5" className="mt-x3 w-full" />
        </div>
      ) : (
        <>
          {byTag.length === 0 ? (
            // 남은 것이 없으면 태그 묶음을 두지 않는다 — "태그 없음 0개" 같은 줄을 채우지 않는다(지시서 32)
            <p
              data-slot="todo-remain-empty"
              className="m-0 px-x6 py-x3 text-t4 text-fg-neutral-subtle"
            >
              {t("remain.none")}
            </p>
          ) : (
            <>
              <ListHeader as="h3" variant="boldSolid" id={tagHead}>
                {t("tag")}
              </ListHeader>
              <List aria-labelledby={tagHead}>
                {byTag.map(({ tag, count }) => (
                  <ListItem
                    key={tag || "__none"}
                    title={
                      <span className="flex items-start gap-x2">
                        <i
                          aria-hidden
                          data-slot="todo-tag-dot"
                          // 제목 첫 줄(22)의 가운데에 점(8)을 세운다 — 이름이 여러 줄이어도 첫 줄에 붙는다
                          className="mt-[calc((1lh-var(--spacing-x2))/2)] size-x2 shrink-0 rounded-full"
                          style={{
                            background: tag
                              ? getPaletteByColor(tagColors.get(tag)).color
                              : "var(--color-chart-gray)",
                          }}
                        />
                        <span className="[overflow-wrap:anywhere]">
                          {tag || t("noTag")}
                        </span>
                      </span>
                    }
                    suffixText
                    suffix={
                      <b className="num whitespace-nowrap font-bold text-fg-neutral">
                        {t("remain.count", { count })}
                      </b>
                    }
                  />
                ))}
              </List>
            </>
          )}
          <ListHeader as="h3" variant="boldSolid" id={prioHead}>
            {t("form.priority")}
          </ListHeader>
          <List aria-labelledby={prioHead}>
            {PRIO_KEYS.map((k) => (
              <ListItem
                key={k}
                title={
                  <Badge
                    variant="weak"
                    tone={k === "HIGH" ? "critical" : "neutral"}
                  >
                    {t(`prio.${k}`)}
                  </Badge>
                }
                suffixText
                suffix={
                  <b className="num whitespace-nowrap font-bold text-fg-neutral">
                    {t("remain.count", { count: byPrio[k] })}
                  </b>
                }
              />
            ))}
          </List>
        </>
      )}
    </Card>
  );
}
