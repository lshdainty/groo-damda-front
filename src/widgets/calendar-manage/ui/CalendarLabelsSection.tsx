import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Tag, Trash2 } from "lucide-react";
import { Button as DsButton } from "@/shared/ds/button";
import { Card as DsCard } from "@/shared/ds/card";
import { List, ListButtonItem, ListTile } from "@/shared/ds/list";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import type { EventLabel } from "@/entities/event-label";
import { useDeleteEventLabel, useEventLabels } from "@/features/event-label";
import {
  ManageEmpty,
  ManageIntro,
  ManageRowsSkeleton,
  ManageSection,
} from "./manage-list-parts";
import { LabelFormDialog } from "./LabelFormDialog";

type EditingState = EventLabel | { kind: "new" } | null;

export function CalendarLabelsSection({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  // 실패는 화면 안 Result Section 한 벌로 말한다 — 전역 서버 원문 토스트와 겹치지 않게 silent (49)
  const labelsQ = useEventLabels({ silent: true });
  const { data: labels, isLoading } = labelsQ;
  const failed = labelsQ.isError && !labels;
  const deleteMut = useDeleteEventLabel();
  const confirmFail = useConfirmFail();
  const uid = useId();

  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventLabel | null>(null);

  const list = useMemo(() => labels ?? [], [labels]);

  const listId = `${uid}-labels`;

  const rowFor = (label: EventLabel) => {
    const palette = getPaletteByColor(label.color);
    const row = (
      // 누르면 라벨 수정 폼(I-09b 39) — 화면을 옮기지 않는 줄이라 꺾쇠 없음(list.md:122)
      <ListButtonItem
        key={label.rowId}
        onClick={() => setEditing(label)}
        prefix={
          <ListTile
            aria-hidden
            style={{ background: palette.bg, color: palette.color }}
          >
            <Tag />
          </ListTile>
        }
        title={label.labelName}
        detail={t("labels.usage", { count: label.usageCount ?? 0 })}
      />
    );
    if (!mobile) return row;
    // 폰은 밀기(수정 · 삭제)를 지름길로 남긴다 — 삭제는 확인창부터
    return (
      <SwipeActions
        key={label.rowId}
        rowLabel={label.labelName}
        enabled
        actions={[
          {
            label: tc("edit"),
            icon: <Pencil />,
            kind: "primary",
            onSelect: () => setEditing(label),
          },
          {
            label: tc("delete"),
            icon: <Trash2 />,
            kind: "destructive",
            onSelect: () => setConfirmDelete(label),
          },
        ]}
      >
        <List>{row}</List>
      </SwipeActions>
    );
  };

  let body: React.ReactNode;
  if (failed) {
    const failure = (
      <BandFailure
        title={t("labelsSection.loadFailed")}
        onRetry={() => void labelsQ.refetch()}
        band={mobile}
        size="medium"
        as="h2"
      />
    );
    body = mobile ? failure : <DsCard body="list">{failure}</DsCard>;
  } else {
    const rows = isLoading ? (
      <ManageRowsSkeleton rows={3} />
    ) : list.length === 0 ? (
      <ManageEmpty
        title={t("noLabels")}
        hint={t("labelsSection.emptyHint", { label: t("newLabel") })}
      />
    ) : mobile ? (
      <div role="group" aria-labelledby={listId}>
        {list.map(rowFor)}
      </div>
    ) : (
      <List aria-labelledby={listId}>{list.map(rowFor)}</List>
    );
    const section = (
      <ManageSection
        id={listId}
        title={
          isLoading
            ? t("labelsSection.allLabels")
            : `${t("labelsSection.allLabels")} · ${list.length}`
        }
        action={
          <DsButton
            type="button"
            variant="ghost"
            ghostColor="neutralMuted"
            size="small"
            onClick={() => setEditing({ kind: "new" })}
          >
            {t("newLabel")}
          </DsButton>
        }
        first
        mobile={mobile}
      >
        {rows}
      </ManageSection>
    );
    body = mobile ? section : <DsCard body="list">{section}</DsCard>;
  }

  return (
    <>
      {!mobile && (
        <ManagerHead
          title={t("labelsSection.title")}
          description={t("labelsSection.description")}
        />
      )}
      <div className={mobile ? "flex flex-col pb-x6" : "flex flex-col gap-x2"}>
        {mobile && (
          <ManageIntro mobile>{t("labelsSection.infoDesc")}</ManageIntro>
        )}
        {body}
      </div>

      {editing && (
        <LabelFormDialog
          label={editing && "rowId" in editing ? editing : null}
          existing={list}
          onClose={() => setEditing(null)}
          onRequestDelete={(l) => {
            // 편집 대화상자는 닫고 확인창부터 — 지우기는 확인창 한 벌(밀기와 같다)
            setEditing(null);
            setConfirmDelete(l);
          }}
        />
      )}
      {confirmDelete && (
        <AlertConfirm
          title={t("labelsSection.deleteTitle")}
          message={t("labelsSection.deleteMessage", {
            name: confirmDelete.labelName,
          })}
          onConfirm={() => deleteMut.mutateAsync(confirmDelete.rowId)}
          onError={(error) =>
            confirmFail({
              error,
              message: t("labelsSection.deleteFailed"),
              retry: () => deleteMut.mutateAsync(confirmDelete.rowId),
            })
          }
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
