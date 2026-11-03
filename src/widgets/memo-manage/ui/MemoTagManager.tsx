import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Pencil, Plus, Tag, Tags, Trash2 } from "lucide-react";
import { SwipeActions, type SwipeAction } from "@/shared/ui/swipe-actions";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { settingsRowPadding } from "@/shared/ui/groo/manage-row-tokens";
import { ColorSwatchGroup } from "@/shared/ui/color-swatch";
import { ConfirmDialog, ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NameCounter } from "@/shared/ui/groo/name-counter";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { ManagerHead, ManagerShell } from "@/shared/ui/groo/manager-layout";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";
import {
  CAT_PALETTE,
  getPaletteByColor,
} from "@/shared/lib/groo/chart-palette";
import type { MemoTag } from "@/entities/memo-tag";
import {
  useCreateMemoTag,
  useDeleteMemoTag,
  useMemoTags,
  useUpdateMemoTag,
} from "@/features/memo-tag";

type EditingState = MemoTag | { kind: "new" } | null;

// 모바일 카드 다이어트 — 리스트 셸: 모바일은 카드 없이, 데스크톱은 Card (.m-subpage 정합).
function ListShell({
  mobile,
  children,
}: {
  mobile: boolean;
  children: React.ReactNode;
}) {
  // overflow hidden — 행 hover 배경이 카드 라운드 밖으로 새지 않게(첫·마지막 행 모서리).
  return mobile ? (
    <div>{children}</div>
  ) : (
    <Card style={{ overflow: "hidden" }}>
      <CardContent style={{ padding: 0 }}>{children}</CardContent>
    </Card>
  );
}

/**
 * 메모 태그 관리 — 이름 + 색(tone) + 사용 건수. 메모 화면의 태그 칩 필터·편집기 선택지에 쓰인다.
 *
 * 구조는 `TodoTagManager` 를 그대로 미러링한다(사용자 지시 2026-09-08 — 새로 설계하지 않는다).
 * 설정에서 두 화면이 나란히 놓이므로 다르게 생기면 그 자체가 결함으로 읽힌다.
 *
 * <p>한 군데만 다르다 — 삭제 확인 문구에 <b>사용 수를 양쪽 경로 모두</b> 넘긴다.
 * 할 일 쪽은 미는 경로(트레이 확인창)에 `count` 를 안 넘겨 `{{count}}` 가 글자 그대로
 * 보인다. 여기서 같은 실수를 베끼면 "N건" 안내가 모바일에서만 깨진다.
 */
export function MemoTagManager({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const { data: tags, isLoading } = useMemoTags();
  const createMut = useCreateMemoTag();
  const updateMut = useUpdateMemoTag();
  const deleteMut = useDeleteMemoTag();

  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmDelete, setConfirmDelete] = useState<MemoTag | null>(null);

  const list = useMemo(() => tags ?? [], [tags]);
  const submitting = createMut.isPending || updateMut.isPending;

  const onSave = (values: { tagName: string; color: string }) => {
    if (editing && "rowId" in editing) {
      updateMut.mutate(
        { id: editing.rowId, data: values },
        { onSuccess: () => setEditing(null) },
      );
    } else {
      createMut.mutate(values, { onSuccess: () => setEditing(null) });
    }
  };
  const onDelete = (tag: MemoTag) => {
    deleteMut.mutate(tag.rowId, { onSuccess: () => setConfirmDelete(null) });
  };

  return (
    <>
      <ManagerShell className="!gap-[var(--spacing-2xl)]">
        {!mobile && (
          <ManagerHead title={t("tags.title")} description={t("tags.desc")} />
        )}

        {/* 안내 카드 — 앱 PCard brand 정합 */}
        <Card variant="brand">
          <CardContent>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-brand)",
                  color: "var(--fg-on-brand)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Tags size={18} strokeWidth={1.9} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-label-sm)",
                    fontWeight: "700",
                    color: "var(--fg-primary)",
                  }}
                >
                  {t("tags.title")}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-caption)",
                    color: "var(--fg-secondary)",
                    marginTop: 2,
                    lineHeight: "1.5",
                  }}
                >
                  {t("tags.desc")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 태그 리스트 — label + list 한 묶음, 사이 간격 모바일 0 / 데스크톱 8. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: mobile ? 0 : 12,
          }}
        >
          {/* 라벨행 우측 텍스트(accent) 추가 버튼 — 프리셋 정합(사용자 결정, filled 헤더 버튼 폐기) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-label-sm)",
                fontWeight: "700",
                color: "var(--fg-primary)",
              }}
            >
              {t("tags.title")} · {list.length}
            </div>
            <Button
              type="button"
              variant="accent"
              style={{ padding: "7px 12px", fontSize: "var(--text-label-sm)" }}
              onClick={() => setEditing({ kind: "new" })}
            >
              <Plus size={14} /> {t("tags.new")}
            </Button>
          </div>
          <ListShell mobile={mobile}>
            {isLoading ? (
              <TagListSkeleton mobile={mobile} />
            ) : list.length === 0 ? (
              <div
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  color: "var(--fg-tertiary)",
                }}
              >
                <Tags
                  size={28}
                  strokeWidth={1.6}
                  style={{ opacity: 0.5, margin: "0 auto" }}
                />
                <div
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "600",
                    marginTop: 8,
                    color: "var(--fg-primary)",
                  }}
                >
                  {t("tags.empty")}
                </div>
                <div style={{ fontSize: "var(--text-caption)", marginTop: 4 }}>
                  {t("tags.emptyHint", { label: `"${t("tags.new")}"` })}
                </div>
              </div>
            ) : (
              list.map((tag, i) => {
                const palette = getPaletteByColor(tag.color);
                const count = tag.usageCount ?? 0; // 서버 GROUP BY 집계(미배포 시 0)
                // 밀면 수정·삭제. 모바일은 행의 🗑·> 를 걷었으므로 탭(편집)이
                // 비제스처 경로다(spec swipe-actions.md · WCAG 2.1.1).
                const swipeActions: SwipeAction[] = [
                  {
                    label: tc("edit"),
                    icon: <Pencil />,
                    kind: "primary",
                    onSelect: () => setEditing(tag),
                  },
                  {
                    label: tc("delete"),
                    icon: <Trash2 />,
                    kind: "destructive",
                    confirm: {
                      // count 를 여기서도 넘긴다 — 안 넘기면 i18next 가 자리표시자를
                      // 그대로 두어 "메모 {{count}}건" 이 보인다(할 일 쪽 미수정 버그).
                      title: t("tags.deleteTitle"),
                      message: t("tags.deleteMessage", {
                        name: tag.tagName,
                        count,
                      }),
                    },
                    // 스와이프가 위 confirm 으로 이미 물었다 — 여기서 확인창을 또 열면 두 번 묻는다(QA 30 15).
                    onSelect: () => deleteMut.mutateAsync(tag.rowId),
                  },
                ];
                return (
                  <SwipeActions
                    key={tag.rowId}
                    rowId={`memo-tag-${tag.rowId}`}
                    groupTag="memo-tag-list"
                    rowLabel={tag.tagName}
                    enabled={mobile}
                    actions={swipeActions}
                  >
                    <div
                      onClick={() => setEditing(tag)}
                      className="hover:bg-[var(--bg-muted)]"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: settingsRowPadding(mobile),
                        borderTop:
                          i === 0 ? "none" : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        transition:
                          "background var(--motion-duration-fast) var(--motion-ease-out)",
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--radius-md)",
                          background: palette.bg,
                          color: palette.color,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Tag size={16} strokeWidth={2} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--text-body-sm)",
                            fontWeight: "600",
                            color: "var(--fg-primary)",
                            letterSpacing: "-0.01em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tag.tagName}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--text-caption)",
                            color: "var(--fg-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          {t("tags.usage", { count })}
                        </div>
                      </div>
                      {/* 모바일은 🗑·> 를 두지 않는다 — 밀면 수정·삭제, 탭하면 편집이라
                        화살표가 있으면 '들어가서 보는 상세'가 따로 있는 것처럼 읽힌다
                        (사용자 결정). 데스크톱은 그대로. */}
                      {!mobile && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="!text-[var(--color-fg-critical)]"
                            aria-label={tc("delete")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(tag);
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                          <ChevronRight
                            size={15}
                            style={{ color: "var(--fg-tertiary)" }}
                          />
                        </div>
                      )}
                    </div>
                  </SwipeActions>
                );
              })
            )}
          </ListShell>
        </div>
      </ManagerShell>

      {editing && (
        <TagEditDialog
          tag={editing && "rowId" in editing ? editing : null}
          existing={list}
          onClose={() => setEditing(null)}
          onSave={onSave}
          mobile={mobile}
          submitting={submitting}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={t("tags.deleteTitle")}
          message={t("tags.deleteMessage", {
            name: confirmDelete.tagName,
            count: confirmDelete.usageCount ?? 0,
          })}
          confirmLabel={tc("delete")}
          danger
          loading={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => onDelete(confirmDelete)}
        />
      )}
    </>
  );
}

function TagListSkeleton({ mobile }: { mobile?: boolean }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: settingsRowPadding(mobile),
            borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
          }}
        >
          <SkeletonBase className="h-8 w-8 rounded-md shrink-0" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonBase className="h-4 w-24" />
            {/* 사용 건수 — 실렌더 caption, marginTop 2 */}
            <SkeletonBase className="h-3 w-20" style={{ marginTop: 2 }} />
          </div>
          {/* 삭제 버튼(icon h-9) + 편집 chevron 한 묶음 */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <SkeletonBase className="h-9 w-9 rounded-md" />
            <SkeletonBase className="h-4 w-4 ml-1" />
          </div>
        </div>
      ))}
    </>
  );
}

function TagEditDialog({
  tag,
  existing,
  onClose,
  onSave,
  mobile,
  submitting,
}: {
  tag: MemoTag | null;
  existing: MemoTag[];
  onClose: () => void;
  onSave: (values: { tagName: string; color: string }) => void;
  mobile: boolean;
  submitting?: boolean;
}) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const isNew = !tag;
  const [name, setName] = useState(tag?.tagName ?? "");
  const [paletteIdx, setPaletteIdx] = useState(() => {
    if (!tag?.color) return 0;
    const idx = CAT_PALETTE.findIndex((p) => p.baseHex === tag.color);
    return idx >= 0 ? idx : 0;
  });
  const [touched, setTouched] = useState(false);

  const palette = CAT_PALETTE[paletteIdx]!;
  const nameTrim = name.trim();
  // 라벨과 같은 이유 — 서버 409 는 나는데 다이얼로그가 조용했다(QA #55).
  const issue = nameIssue(
    name,
    12,
    existing.filter((x) => x.rowId !== tag?.rowId).map((x) => x.tagName),
  );
  const valid = issue == null;
  const err =
    touched && issue
      ? issue === "required"
        ? t("tags.nameRequired")
        : issue === "tooLong"
          ? t("tags.nameTooLong")
          : t("tags.nameDuplicate")
      : null;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ tagName: nameTrim, color: palette.baseHex });
  };

  const Footer = (
    <ModalFooter
      onSave={save}
      saveLabel={isNew ? t("tags.new") : tc("save")}
      saving={submitting}
      saveDisabled={touched && !valid}
      onCancel={onClose}
    />
  );

  return (
    <ModalShell
      title={isNew ? t("tags.new") : t("tags.editTitle")}
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
            {t("tags.preview")}
          </div>
          <div
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "700",
              color: "var(--fg-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {nameTrim || t("tags.new")}
          </div>
        </div>
      </div>

      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("tags.name")}</FieldLabel>
        <Input
          aria-invalid={!!err}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setTouched(true);
          }}
          placeholder={t("tags.namePlaceholder")}
          maxLength={14}
          autoFocus={isNew}
        />
        <NameCounter len={nameTrim.length} max={12} err={err} />
      </Field>

      <Field>
        <FieldLabel>{t("tags.color")}</FieldLabel>
        <ColorSwatchGroup
          columns={5}
          value={String(paletteIdx)}
          onValueChange={(v) => setPaletteIdx(Number(v))}
          options={CAT_PALETTE.map((p, i) => ({
            value: String(i),
            bg: p.bg,
            fg: p.color,
            label: t("tags.colorN", { n: i + 1 }),
          }))}
        />
      </Field>
    </ModalShell>
  );
}
