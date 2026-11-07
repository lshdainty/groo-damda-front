import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Target, Trash2 } from "lucide-react";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import { DynamicIcon } from "lucide-react/dynamic";
import { isIconName } from "@/shared/lib";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { formatPercent } from "@/shared/lib/groo/format";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import { useDeleteSavingGoal, useSavingGoals } from "@/features/savingGoal";
import type { SavingGoal } from "@/entities/savingGoal";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Card, CardContent } from "@/shared/ds/card";
import { List, ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { useSnackbar } from "@/shared/ds/snackbar";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { ManagerHead, ManagerShell } from "@/shared/ui/groo/manager-layout";
import {
  BandEmpty,
  BarredItem,
  BandFailure,
  ListTitle,
  MeterBar,
} from "@/shared/ui/groo/band-parts";
import { SavingGoalAddDialog } from "./SavingGoalAddDialog";
import { formatYearMonthDot, parseLocalDate } from "@/shared/lib/date";

const formatDeadline = (deadline: string | null): string | null => {
  const d = parseLocalDate(deadline);
  if (!d) return null;
  return formatYearMonthDot(d);
};

function GoalRow({
  goal,
  mobile,
  onEdit,
  onDelete,
}: {
  goal: SavingGoal;
  mobile: boolean;
  onEdit: (g: SavingGoal) => void;
  /** 확인창을 연다 — 데스크톱 삭제 버튼 · 스와이프의 삭제 모두(밀기의 옛 확인 메시지는 걷었다) */
  onDelete: (g: SavingGoal) => void;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  const mask = useMasked("asset.savingGoals");
  const pct =
    goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  // 다크에서 light variant 로 스왑되도록 팔레트 헬퍼를 통과시킨다(타일 바탕 · 아이콘 색만 목표 색, 막대 · % 는 fg-brand 한 색).
  const palette = getPaletteByColor(goal.color);
  // 저장된 이름이 lucide 카탈로그에 없을 수 있다(API 로 이모지도 들어온다) — 검사 없이 넘기면 렌더마다 console.error 가 쌓인다(QA #95).
  const iconName =
    goal.icon && goal.icon.trim().length > 0 ? goal.icon : "piggy-bank";
  const common = {
    prefix: (
      <ListTile style={{ background: palette.bg, color: palette.color }}>
        {isIconName(iconName) ? (
          <DynamicIcon name={iconName} size={20} />
        ) : (
          <Target size={20} />
        )}
      </ListTile>
    ),
    // 달성 배지가 이름 뒤에 함께 줄바꿈된다
    title: (
      <>
        {goal.title}
        {goal.isAchieved === "Y" && (
          <>
            {" "}
            <Badge variant="weak" tone="positive" size="medium">
              {t("achieved")}
            </Badge>
          </>
        )}
      </>
    ),
    detail: formatDeadline(goal.deadlineDate) ?? t("savingGoal.noDeadline"),
  };
  return (
    // 모바일 = 줄을 누르면 수정, 밀면 수정 · 삭제(지름길). 데스크톱 = 줄 끝 수정 · 삭제 아이콘.
    <BarredItem
      className="pt-0"
      wrap={(inner) => (
        <SwipeActions
          rowLabel={goal.title}
          enabled={mobile}
          actions={[
            {
              label: tc("edit"),
              icon: <Pencil />,
              kind: "primary",
              onSelect: () => onEdit(goal),
            },
            {
              label: tc("delete"),
              icon: <Trash2 />,
              kind: "destructive",
              // ds 밀기는 묻지 않는다 — 화면이 ds Alert Dialog 를 띄운다(삭제 버튼 · 수정 폼의 [삭제] 와 같은 확인창)
              onSelect: () => onDelete(goal),
            },
          ]}
        >
          {inner}
        </SwipeActions>
      )}
      row={
        mobile ? (
          <ListButtonItem
            as="div"
            align="top"
            {...common}
            onClick={() => onEdit(goal)}
          />
        ) : (
          <ListItem
            as="div"
            align="top"
            {...common}
            suffix={
              <span className="inline-flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  layout="iconOnly"
                  size="small"
                  aria-label={t("savingGoal.editNamed", {
                    name: goal.title,
                  })}
                  onClick={() => onEdit(goal)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  layout="iconOnly"
                  size="small"
                  ghostColor="critical"
                  aria-label={t("savingGoal.deleteNamed", {
                    name: goal.title,
                  })}
                  onClick={() => onDelete(goal)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </span>
            }
          />
        )
      }
      bar={
        <>
          {/* 줄 아래 12 에 한 줄(좌우 24) — 왼쪽 금액(줄바꿈 허용), 오른쪽 %. 그 아래 6 에 막대 8 */}
          <div className="flex items-baseline justify-between gap-x3">
            <span className="min-w-0 text-t3 font-medium tabular-nums text-fg-neutral-subtle">
              {withCommaBreaks(mask(won(goal.currentAmount)))} /{" "}
              {withCommaBreaks(mask(won(goal.targetAmount)))}
            </span>
            <span className="shrink-0 text-t4 font-bold tabular-nums text-fg-brand">
              {formatPercent(pct, "progress")}
            </span>
          </div>
          <MeterBar
            className="mt-x1_5"
            meaning="goal"
            label={goal.title}
            value={goal.currentAmount}
            max={goal.targetAmount}
            formatValue={(n) => mask(won(n))}
          />
        </>
      }
    />
  );
}

function GoalsSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="flex items-center gap-x3 px-x6 py-x3">
            <Skeleton radius="12" className="size-x10 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
              <Skeleton text="t5" className="w-1/2" />
              <Skeleton text="t3" className="w-1/4" />
            </div>
          </div>
          <div className="px-x6 pb-x3 pt-x1">
            <Skeleton text="t3" className="w-1/2" />
            <Skeleton className="mt-x1_5 h-2 w-full" radius="full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 전체 진행률 — 라벨 t3 · 500 · subtle, 아래 4 에 큰 숫자 + 오른쪽 끝 % (t9 · 700 · fg-brand). 막대 없음 */
function SummaryArea({
  mobile,
  totalCurrent,
  totalTarget,
  totalPct,
}: {
  mobile: boolean;
  totalCurrent: number;
  totalTarget: number;
  totalPct: number;
}) {
  const { t } = useTranslation("asset");
  const mask = useMasked("asset.savingGoals");
  const inner = (
    <>
      <p className="m-0 text-t3 font-medium text-fg-neutral-subtle">
        {t("savingGoal.overallProgress")}
      </p>
      <div className="mt-x1 flex items-baseline justify-between gap-x3">
        <p className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-x1_5">
          <span className="min-w-0 text-t9 font-bold tabular-nums text-fg-neutral">
            {withCommaBreaks(mask(won(totalCurrent)))}
          </span>
          <span className="text-t4 tabular-nums text-fg-neutral-subtle">
            / {withCommaBreaks(mask(won(totalTarget)))}
          </span>
        </p>
        <span className="shrink-0 text-t9 font-bold tabular-nums text-fg-brand">
          {formatPercent(totalPct, "progress")}
        </span>
      </div>
    </>
  );
  // 위 20(띠 안 위 4 + 16) · 아래 24
  if (mobile) return <section className="px-x6 pb-x6 pt-x5">{inner}</section>;
  return (
    <Card>
      <CardContent className="gap-0">{inner}</CardContent>
    </Card>
  );
}

/**
 * 저축 목표 관리 (설정 > 저축 목표) — design GoalManager SoT.
 * 전체 진행률 요약(keep 카드) + 목표 목록(추가·편집·삭제). 자산 화면은 조회 전용.
 */
export function SavingGoalManager({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("asset");
  const { t: tSettings } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const goalsQ = useSavingGoals();
  const deleteMut = useDeleteSavingGoal();
  const snackbar = useSnackbar();
  // 실패는 확인창을 닫고 Snackbar 로 — "다시 시도" 는 같은 삭제를 다시 한다
  const deleteFailed = (goal: SavingGoal) =>
    snackbar.show({
      message: t("savingGoal.deleteFailed"),
      tone: "critical",
      action: {
        label: tCommon("retry"),
        onClick: () => {
          deleteMut.mutateAsync(goal.rowId).catch(() => deleteFailed(goal));
        },
      },
    });

  const [editing, setEditing] = useState<SavingGoal | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavingGoal | null>(null);

  const goals = goalsQ.data?.goals ?? [];
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  const failed = goalsQ.isError && goalsQ.data === undefined;
  const loading = goalsQ.data === undefined && !goalsQ.isError;
  const title = (
    <ListTitle
      id="saving-goal-list-title"
      first={!mobile || goals.length === 0}
      action={{
        label: t("addGoal"),
        onClick: () => setEditing("new"),
      }}
    >
      {t("savingGoal.goalCount", { n: goals.length })}
    </ListTitle>
  );
  const list = loading ? (
    <GoalsSkeleton />
  ) : goals.length === 0 ? (
    // 빈 목록 — R9 가운데 한 줄. 버튼은 목록 제목의 "목표 추가" 가 있어 두지 않는다
    <div className="px-x6 pb-x3">
      <BandEmpty>{t("savingGoal.emptyManager")}</BandEmpty>
    </div>
  ) : (
    <List aria-labelledby="saving-goal-list-title">
      {goals.map((g) => (
        <GoalRow
          key={g.rowId}
          goal={g}
          mobile={mobile}
          onEdit={setEditing}
          onDelete={setConfirmDelete}
        />
      ))}
    </List>
  );
  const summary =
    !failed && !loading && goals.length > 0 ? (
      <SummaryArea
        mobile={mobile}
        totalCurrent={totalCurrent}
        totalTarget={totalTarget}
        totalPct={totalPct}
      />
    ) : null;

  const content = failed ? (
    <div className={mobile ? "px-x6 pb-x6 pt-x2" : undefined}>
      <BandFailure
        title={t("savingGoal.loadFailed")}
        onRetry={() => void goalsQ.refetch()}
      />
    </div>
  ) : (
    <>
      {summary}
      {mobile ? (
        <section className="pb-x3">
          {title}
          {list}
        </section>
      ) : (
        <Card body="list">
          {title}
          {list}
        </Card>
      )}
    </>
  );

  return (
    <>
      {mobile ? (
        // 폰 — 흰 면 하나(I-08 24). 카드 · 줄 사이 선 없음, 구역 · 줄이 제 좌우 24 를 갖는다
        <div
          data-slot="saving-goal-phone"
          className={summary || failed ? undefined : "pt-x4"}
        >
          {content}
        </div>
      ) : (
        <ManagerShell>
          <ManagerHead
            title={t("savingGoals")}
            description={tSettings("sections.goals.managerDescription")}
          />
          {content}
        </ManagerShell>
      )}

      {editing != null && (
        <SavingGoalAddDialog
          goal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            // 밀기의 [삭제] 와 같은 확인창 하나 — 수정 폼을 닫고 확인한다
            const goal = editing;
            setEditing(null);
            if (goal && goal !== "new") setConfirmDelete(goal);
          }}
        />
      )}
      {confirmDelete && (
        <AlertConfirm
          title={t("savingGoal.deleteTitle", { title: confirmDelete.title })}
          message={t("savingGoal.deleteConfirm")}
          confirmLabel={tCommon("delete")}
          onConfirm={() => deleteMut.mutateAsync(confirmDelete.rowId)}
          onError={() => deleteFailed(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
