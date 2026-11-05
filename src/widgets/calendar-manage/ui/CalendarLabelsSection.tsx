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
import { ColorSwatchGroup } from "@/shared/ui/color-swatch";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NameCounter } from "@/shared/ui/groo/name-counter";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import {
  CAT_PALETTE,
  getPaletteByColor,
} from "@/shared/lib/groo/chart-palette";
import type { EventLabel } from "@/entities/event-label";
import {
  useCreateEventLabel,
  useDeleteEventLabel,
  useEventLabels,
  useUpdateEventLabel,
} from "@/features/event-label";
import {
  ManageEmpty,
  ManageIntro,
  ManageRowsSkeleton,
  ManageSection,
} from "./manage-list-parts";

type EditingState = EventLabel | { kind: "new" } | null;

export function CalendarLabelsSection({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  // 실패는 화면 안 Result Section 한 벌로 말한다 — 전역 서버 원문 토스트와 겹치지 않게 silent (49)
  const labelsQ = useEventLabels({ silent: true });
  const { data: labels, isLoading } = labelsQ;
  const failed = labelsQ.isError && !labels;
  const createMut = useCreateEventLabel();
  const updateMut = useUpdateEventLabel();
  const deleteMut = useDeleteEventLabel();
  const confirmFail = useConfirmFail();
  const uid = useId();

  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventLabel | null>(null);

  const list = useMemo(() => labels ?? [], [labels]);
  const submitting = createMut.isPending || updateMut.isPending;

  const onSave = (values: { labelName: string; color: string }) => {
    if (editing && "rowId" in editing) {
      updateMut.mutate(
        { id: editing.rowId, data: values },
        { onSuccess: () => setEditing(null) },
      );
    } else {
      createMut.mutate(values, { onSuccess: () => setEditing(null) });
    }
  };

  const listId = `${uid}-labels`;

  const rowFor = (label: EventLabel) => {
    const palette = getPaletteByColor(label.color);
    const row = (
      // 누르면 지금의 라벨 편집 대화상자 — 화면을 옮기지 않는 줄이라 꺾쇠 없음(list.md:122)
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
        <LabelEditDialog
          label={editing && "rowId" in editing ? editing : null}
          existing={list}
          onClose={() => setEditing(null)}
          onSave={onSave}
          mobile={mobile}
          submitting={submitting}
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
          onError={() =>
            confirmFail({
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

function LabelEditDialog({
  label,
  existing,
  onClose,
  onSave,
  mobile,
  submitting,
  onRequestDelete,
}: {
  label: EventLabel | null;
  /** 수정 폼일 때만 바닥 왼쪽 [삭제] — 이 길이 데스크톱 · 폰 모두의 지우기다(09b-2 가 폼을 새로 짤 때 옮긴다) */
  onRequestDelete?: (label: EventLabel) => void;
  existing: EventLabel[];
  onClose: () => void;
  onSave: (values: { labelName: string; color: string }) => void;
  mobile: boolean;
  submitting?: boolean;
}) {
  const { t } = useTranslation("calendar");
  const { t: tCommon } = useTranslation("common");
  const isNew = !label;
  const [name, setName] = useState(label?.labelName ?? "");
  const [paletteIdx, setPaletteIdx] = useState(() => {
    if (!label?.color) return 0;
    const idx = CAT_PALETTE.findIndex((p) => p.baseHex === label.color);
    return idx >= 0 ? idx : 0;
  });
  const [touched, setTouched] = useState(false);

  const palette = CAT_PALETTE[paletteIdx]!;
  const nameTrim = name.trim();
  // 중복은 서버가 409 로 막지만 다이얼로그엔 아무 표시도 없어 '버튼이 안 먹는' 것처럼
  // 보였다(QA #55). 카테고리와 같이 보내기 전에 이 자리에서 알려 준다.
  const issue = nameIssue(
    name,
    12,
    existing.filter((l) => l.rowId !== label?.rowId).map((l) => l.labelName),
  );
  const valid = issue == null;
  const err =
    touched && issue
      ? issue === "required"
        ? t("labelsSection.nameRequired")
        : issue === "tooLong"
          ? t("labelsSection.nameTooLong")
          : t("labelsSection.nameDuplicate")
      : null;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ labelName: nameTrim, color: palette.baseHex });
  };

  const Footer = (
    <ModalFooter
      onSave={save}
      saveLabel={isNew ? t("add") : tCommon("save")}
      saving={submitting}
      saveDisabled={touched && !valid}
      onCancel={onClose}
      leftSlot={
        label && onRequestDelete ? (
          <DsButton
            type="button"
            variant="ghost"
            ghostColor="critical"
            size="small"
            onClick={() => onRequestDelete(label)}
          >
            {tCommon("delete")}
          </DsButton>
        ) : undefined
      }
    />
  );

  return (
    <ModalShell
      title={isNew ? t("newLabel") : t("editLabel")}
      onClose={onClose}
      size="md"
      footer={Footer}
      mobile={mobile}
    >
      {/* 미리보기 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 14,
          background: palette.bg,
          borderRadius: "var(--radius-tile)",
          marginBottom: 20,
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: palette.color,
            color: "var(--fg-on-brand)",
          }}
        >
          <Tag size={18} strokeWidth={2} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-badge)",
              color: "var(--fg-tertiary)",
              fontWeight: "600",
              letterSpacing: "0.02em",
            }}
          >
            {t("preview")}
          </div>
          <div
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "700",
              color: "var(--fg-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {nameTrim || t("newLabel")}
          </div>
        </div>
      </div>

      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("name")}</FieldLabel>
        <Input
          aria-invalid={!!err}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setTouched(true);
          }}
          placeholder={t("labelsSection.namePlaceholder")}
          maxLength={14}
          autoFocus={!label}
        />
        <NameCounter len={nameTrim.length} max={12} err={err} />
      </Field>

      <Field>
        <FieldLabel>{t("form.color")}</FieldLabel>
        <ColorSwatchGroup
          columns={5}
          value={String(paletteIdx)}
          onValueChange={(v) => setPaletteIdx(Number(v))}
          options={CAT_PALETTE.map((p, i) => ({
            value: String(i),
            bg: p.bg,
            fg: p.color,
            label: t("labelsSection.colorN", { n: i + 1 }),
          }))}
        />
      </Field>
    </ModalShell>
  );
}
