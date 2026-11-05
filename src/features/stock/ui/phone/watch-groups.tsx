import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EllipsisVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { List, ListButtonItem, ListHeader } from "@/shared/ds/list";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { ResultSection } from "@/shared/ds/result-section";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { cn } from "@/shared/lib/cn";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import type { WatchGroup } from "../../api/stockApi";
import {
  useCreateWatchGroup,
  useDeleteWatchGroup,
  useRenameWatchGroup,
} from "../../api/watchlistApi";
import type { RowQuote } from "../../model/useWatchQuotes";
import { amountText } from "../../lib/amount-text";
import { LineSkeletons, StockLine } from "./phone-parts";

/*
 * 관심 탭(I-13 13 ~ 16, 4G-나) — 모든 그룹을 "{그룹} · {개수}" 목록 제목 아래 차례로, 제목 끝 ⋮(이름 바꾸기 · 그룹 삭제),
 * 목록 맨 끝 "그룹 추가" 줄. 그룹 묶음마다 `track` 으로 화면에 들어왔는지 본다(보이는 그룹만 시세를 부른다 — 22).
 */

export function WatchGroups({
  groups,
  loading,
  failed,
  onRetry,
  priceOf,
  track,
  onOpen,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
}: {
  groups: WatchGroup[];
  loading?: boolean;
  failed?: boolean;
  onRetry: () => void;
  priceOf: (symbol: string) => RowQuote;
  track: (id: number) => (el: HTMLElement | null) => void;
  onOpen: (symbol: string) => void;
  onAddGroup: () => void;
  onRenameGroup: (g: WatchGroup) => void;
  onDeleteGroup: (g: WatchGroup) => void;
}) {
  const { t } = useTranslation("stocks");
  if (failed)
    return (
      <BandFailure
        band
        title={t("watch.failTitle")}
        onRetry={onRetry}
        className="pb-x6"
      />
    );
  if (loading)
    return (
      <>
        <ListHeader as="div" variant="boldSolid" className="mt-x2">
          <span className="sr-only">{t("watch.loading")}</span>
        </ListHeader>
        <LineSkeletons rows={3} label={t("watch.loading")} />
      </>
    );
  if (groups.length === 0)
    return (
      <ResultSection
        kind="empty"
        size="medium"
        as="h3"
        icon={<Plus aria-hidden />}
        title={t("watch.emptyTitle")}
        description={t("watch.emptyDesc")}
        className="px-x6"
      />
    );
  return (
    <div data-slot="watch-groups">
      {groups.map((g, idx) => (
        <section
          key={g.rowId}
          ref={track(g.rowId)}
          aria-labelledby={`watch-group-${g.rowId}`}
        >
          <ListHeader
            as="div"
            variant="boldSolid"
            className={idx === 0 ? "mt-x2" : "mt-x4"}
          >
            <h3
              id={`watch-group-${g.rowId}`}
              className="m-0 tracking-normal [font:inherit]"
            >
              {t("watch.groupTitle", {
                name: g.groupName,
                count: g.items.length,
              })}
            </h3>
            <GroupMenu
              group={g}
              onRename={() => onRenameGroup(g)}
              onDelete={() => onDeleteGroup(g)}
            />
          </ListHeader>
          {g.items.length === 0 ? (
            <p className="m-0 px-x6 pb-x3 pt-x1 text-t4 text-fg-neutral-subtle">
              {t("watch.groupEmpty")}
            </p>
          ) : (
            <List aria-labelledby={`watch-group-${g.rowId}`}>
              {g.items.map((i) => {
                const q = priceOf(i.symbol);
                return (
                  <StockLine
                    key={i.rowId}
                    name={i.nameKr}
                    detail={`${i.symbol} · ${t(`market.${i.marketCode}`, { defaultValue: i.marketCode })}`}
                    amount={
                      q.price != null ? amountText(q.price, i.currency) : null
                    }
                    pct={q.changePct}
                    onClick={() => onOpen(i.symbol)}
                  />
                );
              })}
            </List>
          )}
        </section>
      ))}
      <List className="mt-x2">
        <ListButtonItem
          prefix={<Plus aria-hidden className="size-6 text-fg-brand" />}
          title={
            <span className={cn("text-t5 font-bold text-fg-brand")}>
              {t("watch.groupAdd")}
            </span>
          }
          onClick={onAddGroup}
        />
      </List>
    </div>
  );
}

/** 그룹 제목 끝 ⋮ — 1280 미만 Menu Sheet · 이상 Menu. [이름 바꾸기, 그룹 삭제(critical)] */
function GroupMenu({
  group,
  onRename,
  onDelete,
}: {
  group: WatchGroup;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("stocks");
  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          ghostColor="neutralSubtle"
          layout="iconOnly"
          size="medium"
          aria-label={t("watch.groupMore", { name: group.groupName })}
        >
          <EllipsisVertical aria-hidden />
        </Button>
      </ResponsiveMenuTrigger>
      <ResponsiveMenuContent title={group.groupName} align="end">
        <ResponsiveMenuGroup>
          <ResponsiveMenuItem
            label={t("watch.groupRenameItem")}
            icon={<Pencil aria-hidden />}
            onSelect={onRename}
          />
        </ResponsiveMenuGroup>
        <ResponsiveMenuGroup>
          <ResponsiveMenuItem
            label={t("watch.groupDelete")}
            icon={<Trash2 aria-hidden />}
            tone="critical"
            onSelect={onDelete}
          />
        </ResponsiveMenuGroup>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  );
}

/**
 * 그룹 추가 · 이름 바꾸기 폼 — 1280 미만 Bottom Sheet · 이상 Dialog 480. 폼이라 바깥 누름 · 끌기로 닫히지 않고,
 * 바뀐 값이 있으면 닫기 전에 "작성한 내용이 사라져요" 를 묻는다(dirty). 삭제는 여기에 없다 — 제목 ⋮ 에서만.
 */
export function WatchGroupForm({
  group,
  onClose,
}: {
  group: WatchGroup | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("stocks");
  const { t: tc } = useTranslation("common");
  const initial = group?.groupName ?? "";
  const [name, setName] = useState(initial);
  const nameRef = useRef<HTMLInputElement>(null);
  // 저장 실패는 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글) — 요청은 silent, 폼은 열린 채 · 쓴 이름 그대로
  const createMut = useCreateWatchGroup({ silent: true });
  const renameMut = useRenameWatchGroup({ silent: true });
  const busy = createMut.isPending || renameMut.isPending;
  const canSave = name.trim().length > 0 && !busy;
  const saveFailed = createMut.isError || renameMut.isError;
  const errorRef = useScrollToError<HTMLDivElement>(
    saveFailed,
    createMut.error ?? renameMut.error,
  );
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면 끈다
  const savingRef = useRef(false);

  const save = () => {
    // Enter 연타 · 따닥 — 요청이 나가 있으면 다시 안 보낸다
    if (busy || savingRef.current) return;
    const groupName = name.trim();
    if (!groupName) return;
    savingRef.current = true;
    createMut.reset();
    renameMut.reset();
    const settle = {
      onSuccess: onClose,
      onSettled: () => {
        savingRef.current = false;
      },
    };
    if (group) renameMut.mutate({ groupId: group.rowId, groupName }, settle);
    else createMut.mutate(groupName, settle);
  };

  return (
    <ResponsiveDialog
      open
      form
      dirty={name !== initial}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={group ? t("watch.groupRename") : t("watch.groupAdd")}
        // 열리면 이름 칸에 초점 — 폰에서 키보드가 바로 올라온다(옛 autoFocus. 검수 M11)
        // 이름을 바꿀 때(group 있음)는 주지 않는다 — 표면이 받는다
        onOpenAutoFocus={(e) => {
          if (group) return;
          e.preventDefault();
          nameRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          {saveFailed && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("watch.groupSaveFail")}
              </Callout>
            </div>
          )}
          <Field label={t("watch.groupNameLabel")}>
            <Input
              ref={nameRef}
              value={name}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) {
                  e.preventDefault();
                  save();
                }
              }}
            />
          </Field>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button disabled={!canSave} loading={busy} onClick={save}>
            {tc("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** 그룹 삭제 확인 — ds Alert Dialog. 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도] */
export function WatchGroupDeleteConfirm({
  group,
  onClose,
}: {
  group: WatchGroup;
  onClose: () => void;
}) {
  const { t } = useTranslation("stocks");
  const deleteMut = useDeleteWatchGroup({ silent: true });
  const confirmFail = useConfirmFail();
  const count = group.items.length;
  return (
    <AlertConfirm
      title={t("watch.groupDelete")}
      message={
        count > 0
          ? t("watch.groupDeleteConfirm", { name: group.groupName, count })
          : t("watch.groupDeleteConfirmEmpty", { name: group.groupName })
      }
      confirmLabel={t("watch.groupDelete")}
      onConfirm={() => deleteMut.mutateAsync(group.rowId)}
      onError={() =>
        confirmFail({
          message: t("watch.groupDeleteFail"),
          retry: () => deleteMut.mutateAsync(group.rowId),
        })
      }
      onClose={onClose}
    />
  );
}
