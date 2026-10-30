import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Info, Pencil, Plus, Tag, Tags, Trash2 } from "lucide-react";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Card } from "@/shared/ds/card";
import {
  ColorSwatchGroup,
  firstUnusedColor,
  type ColorSwatchValue,
} from "@/shared/ds/color-swatch";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { List, ListButtonItem, ListHeader, ListTile } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import {
  CHART_PAIRS,
  chartColorOf,
  getPaletteByColor,
} from "@/shared/lib/groo/chart-palette";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";

/**
 * 태그 설정 본문 — 메모 태그 · 할 일 태그가 한 부품을 쓴다(I-15 20 ~ 24 · I-10 33 ~ 37 · 열린 질문 Q4 B).
 * 글은 두 화면 네임스페이스의 같은 키(`tags.*`)를 `ns` 로 읽는다 — 키만 다르고 구조는 같다.
 *
 * 폰(`mobile`): 흰 면 하나 — 안내 Callout(informative · 제목 없음) → 목록 제목 "… 태그 · N" + 글 버튼 "태그 추가" → 색 타일 40 줄.
 * 줄 누름 = 수정 폼, 밀기 = [수정, 삭제]. 줄 끝 ⋮ 는 두지 않는다(좁은 목록 줄 — 10-25).
 * 데스크톱 · 태블릿: 머리 설명(안내 상자는 두지 않는다 — 같은 말을 두 번 하지 않는다) + 오른쪽 [태그 추가] + 카드 하나, 줄 끝 ⋮ 는 두지 않는다(list.md "목록 줄 끝에는 ⋮ 를 두지 않는다") — 줄 누름 → 수정 폼 → 바닥 [삭제] 가 길이다.
 *
 * 실패 안내는 서버 원문이 아니라 고정 글이다 — 저장 실패는 폼 안 Callout, 삭제 실패는 확인창을 닫고 critical 스낵바 + [다시 시도].
 * 부르는 쪽은 요청을 `silent` 로 보낸다.
 */

export interface TagLike {
  rowId: number;
  tagName: string;
  color: string | null | undefined;
  usageCount?: number;
}

export type TagValues = { tagName: string; color: string };

const BASE_OF = Object.fromEntries(CHART_PAIRS.map((p) => [p.key, p.base]));
const NAME_MAX = 12;

type Ns = "memo" | "todo";

/** 태그 타일 40 · 모서리 12 · 옅은 바탕 + 아이콘 20 */
function TagTile({ color }: { color: string | null | undefined }) {
  const palette = getPaletteByColor(color);
  return (
    <ListTile style={{ background: palette.bg, color: palette.color }}>
      <Tag />
    </ListTile>
  );
}

export function TagSettings<T extends TagLike>({
  ns,
  mobile,
  tags,
  loading,
  failed,
  onRetry,
  create,
  update,
  remove,
}: {
  ns: Ns;
  mobile: boolean;
  tags: readonly T[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  create: (values: TagValues) => Promise<unknown>;
  update: (id: number, values: TagValues) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
}) {
  const { t } = useTranslation(ns);
  const { t: tc } = useTranslation("common");
  const snackbar = useSnackbar();
  const [editing, setEditing] = useState<T | { kind: "new" } | null>(null);
  const [askDelete, setAskDelete] = useState<T | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorSeq, setSaveErrorSeq] = useState(0);

  const openEditor = (target: T | { kind: "new" }) => {
    setSaveError(false);
    setEditing(target);
  };

  const onSave = async (values: TagValues) => {
    setSaving(true);
    setSaveError(false);
    try {
      if (editing && "rowId" in editing) await update(editing.rowId, values);
      else await create(values);
      setEditing(null);
    } catch {
      setSaveError(true);
      setSaveErrorSeq((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  /** 지운다 — 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도](다시 묻지 않고 같은 삭제를 바로) */
  const doDelete = async (tag: T) => {
    try {
      await remove(tag.rowId);
    } catch {
      snackbar.show({
        message: t("tags.deleteFailed"),
        tone: "critical",
        action: { label: tc("retry"), onClick: () => void doDelete(tag) },
      });
    }
  };
  const runDelete = async () => {
    if (!askDelete) return;
    setRunning(true);
    await doDelete(askDelete);
    setRunning(false);
    setAskDelete(null);
  };

  const row = (tag: T) => (
    <ListButtonItem
      key={tag.rowId}
      title={tag.tagName}
      detail={t("tags.usage", { count: tag.usageCount ?? 0 })}
      prefix={<TagTile color={tag.color} />}
      onClick={() => openEditor(tag)}
    />
  );

  let body: ReactNode;
  if (failed) {
    body = (
      <ResultSection
        kind="failure"
        title={t("tags.loadFailed")}
        description={t("tags.loadFailedDesc")}
        primaryAction={{ label: tc("retry"), onClick: onRetry }}
      />
    );
  } else if (loading) {
    body = (
      <div aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
            <Skeleton className="size-x10 shrink-0" radius="12" />
            <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
              <Skeleton text="t5" className="w-28" />
              <Skeleton text="t3" className="w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (tags.length === 0) {
    body = (
      <ResultSection
        size="medium"
        icon={<Tags />}
        title={t("tags.empty")}
        description={t("tags.emptyHint", { label: `"${t("tags.new")}"` })}
      />
    );
  } else if (mobile) {
    body = tags.map((tag) => (
      <SwipeActions
        key={tag.rowId}
        rowLabel={tag.tagName}
        enabled
        actions={[
          {
            label: tc("edit"),
            icon: <Pencil />,
            kind: "primary",
            onSelect: () => openEditor(tag),
          },
          {
            label: tc("delete"),
            icon: <Trash2 />,
            kind: "destructive",
            onSelect: () => setAskDelete(tag),
          },
        ]}
      >
        <List>{row(tag)}</List>
      </SwipeActions>
    ));
  } else {
    body = <List aria-label={t("tags.title")}>{tags.map(row)}</List>;
  }

  const addButton = (
    <Button
      variant="neutralOutline"
      size="small"
      onClick={() => openEditor({ kind: "new" })}
    >
      <Plus aria-hidden />
      {t("tags.new")}
    </Button>
  );

  return (
    <>
      {mobile ? (
        <div className="pb-x6">
          {/* 안내 — 흰 면 위 예외. 위 16 · 아래 8 */}
          <div className="px-global-gutter pb-x2 pt-x4">
            <Callout tone="informative" icon={<Info />}>
              {t("tags.desc")}
            </Callout>
          </div>
          <ListHeader as="div" variant="boldSolid" className="mt-x4">
            <h2 className="m-0 font-[inherit] text-[length:inherit]">
              {t("tags.title")}
              {/* 수는 불러온 목록에서만 — 불러오는 동안은 Skeleton, 실패하면 수를 쓰지 않는다 */}
              {failed ? null : loading ? (
                <>
                  {" · "}
                  <Skeleton
                    text="t4"
                    className="inline-block w-x4 align-middle"
                  />
                </>
              ) : (
                ` · ${tags.length}`
              )}
            </h2>
            <Button
              variant="ghost"
              ghostColor="neutralMuted"
              size="small"
              onClick={() => openEditor({ kind: "new" })}
            >
              {t("tags.new")}
            </Button>
          </ListHeader>
          {body}
        </div>
      ) : (
        <>
          <ManagerHead
            title={t("tags.title")}
            description={t("tags.desc")}
            actions={addButton}
          />
          <Card body="list">{body}</Card>
        </>
      )}

      {editing && (
        <TagEditDialog
          ns={ns}
          tag={"rowId" in editing ? editing : null}
          existing={tags}
          saveError={saveError}
          saveErrorSeq={saveErrorSeq}
          submitting={saving}
          onClose={() => setEditing(null)}
          onSave={(values) => void onSave(values)}
          onDelete={
            "rowId" in editing
              ? () => {
                  setAskDelete(editing);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
      {askDelete && (
        <ConfirmDialog
          title={t("tags.deleteTitle")}
          // count 를 넘긴다 — 안 넘기면 자리표시자가 그대로 보인다(QA #104)
          message={t("tags.deleteMessage", {
            name: askDelete.tagName,
            count: askDelete.usageCount ?? 0,
          })}
          confirmLabel={tc("delete")}
          danger
          loading={running}
          onCancel={() => {
            if (!running) setAskDelete(null);
          }}
          onConfirm={() => void runDelete()}
        />
      )}
    </>
  );
}

/**
 * 태그 추가 · 수정 폼(I-15 23 · I-10 37) — ds Responsive Dialog 입력 폼(1280 이상 대화상자 · 미만 Bottom Sheet).
 * 미리보기(타일 + 이름) → 이름(필수 · 12자 · 겹침 검사, 글자 수는 칸 아래) → 색상(ds Color Swatch 5 × 2, 칸 이름 = 색 이름).
 * 저장된 색이 팔레트 밖이면 격자 앞 "지금 색" 칸이 골라져 열리고, 고르지 않으면 바꾸지 않는다.
 * 값이 바뀐 채 닫으면 "작성한 내용이 사라져요" 를 묻고 바깥을 눌러도 닫히지 않는다. 바닥 주 버튼은 [저장] 하나(수정이면 왼쪽 [삭제]).
 */
export function TagEditDialog<T extends TagLike>({
  ns,
  tag,
  existing,
  saveError,
  saveErrorSeq,
  submitting,
  onClose,
  onSave,
  onDelete,
}: {
  ns: Ns;
  tag: T | null;
  existing: readonly T[];
  saveError: boolean;
  /** 저장이 실패할 때마다 늘어난다 — 실패 Callout 을 화면에 들이는 신호 */
  saveErrorSeq: number;
  submitting?: boolean;
  onClose: () => void;
  onSave: (values: TagValues) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation(ns);
  const { t: tc } = useTranslation("common");
  const isNew = !tag;
  const errorRef = useScrollToError<HTMLDivElement>(saveError, saveErrorSeq);
  const [initial] = useState(() => ({
    name: tag?.tagName ?? "",
    // 새 태그는 안 쓴 첫 색 — 늘 빨강으로 시작하지 않는다. 고치는 태그는 저장된 색 그대로(팔레트 밖이어도 바꾸지 않는다)
    color:
      tag?.color ??
      BASE_OF[firstUnusedColor(existing.map((x) => chartColorOf(x.color)))]!,
  }));
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [touched, setTouched] = useState(false);

  const key = chartColorOf(color);
  const selected: ColorSwatchValue = key ?? "current";
  // 처음 저장된 색이 팔레트 밖이면 "지금 색" 칸을 끝까지 둔다 — 격자 색을 골라도 칸이 남아 다시 고르면 저장 값 그대로(color-swatch.md, L4)
  const storedOutside = chartColorOf(initial.color) == null;
  const palette = getPaletteByColor(color);
  const nameTrim = name.trim();
  const issue = nameIssue(
    name,
    NAME_MAX,
    existing.filter((x) => x.rowId !== tag?.rowId).map((x) => x.tagName),
  );
  const err =
    touched && issue
      ? issue === "required"
        ? t("tags.nameRequired")
        : issue === "tooLong"
          ? t("tags.nameTooLong")
          : t("tags.nameDuplicate")
      : null;
  const dirty = name !== initial.name || color !== initial.color;

  const save = () => {
    setTouched(true);
    if (issue || submitting) return;
    onSave({ tagName: nameTrim, color });
  };

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={isNew ? t("tags.new") : t("tags.editTitle")}
        aria-describedby={undefined}
      >
        <ResponsiveDialogBody>
          <div className="flex flex-col gap-x4 pb-x2">
            {saveError && (
              <div ref={errorRef}>
                <Callout tone="critical" role="alert">
                  {t("tags.saveFailed")}
                </Callout>
              </div>
            )}
            {/* 미리보기 */}
            <div
              className="flex items-center gap-x3 rounded-r3 p-x3_5"
              style={{ background: palette.bg }}
            >
              <span
                className="inline-flex size-x10 shrink-0 items-center justify-center rounded-r3 text-static-white"
                style={{ background: palette.color }}
                aria-hidden
              >
                <Tag size={20} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <div className="font-sans text-t2 font-medium text-fg-neutral-subtle">
                  {t("tags.preview")}
                </div>
                <div className="font-sans text-t5 font-bold text-fg-neutral [overflow-wrap:anywhere]">
                  {nameTrim || t("tags.new")}
                </div>
              </div>
            </div>
            <Field
              label={t("tags.name")}
              showRequiredIndicator
              maxGraphemeCount={NAME_MAX}
              invalid={err != null}
              errorMessage={err}
            >
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setTouched(true);
                }}
                placeholder={t("tags.namePlaceholder")}
                autoComplete="off"
              />
            </Field>
            <Field label={t("tags.color")}>
              <ColorSwatchGroup
                value={selected}
                currentColor={storedOutside ? initial.color : undefined}
                onValueChange={(v) => {
                  // "지금 색" 칸을 고르면 저장 값 그대로 — 몰래 바꾸지 않는다
                  setColor(v === "current" ? initial.color : BASE_OF[v]!);
                }}
              />
            </Field>
          </div>
        </ResponsiveDialogBody>
        <FormFooter
          cancelLabel={tc("cancel")}
          submitLabel={tc("save")}
          onSubmit={save}
          loading={submitting}
          deleteLabel={tc("delete")}
          onDelete={isNew ? undefined : onDelete}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
