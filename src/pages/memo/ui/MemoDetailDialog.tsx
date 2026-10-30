import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import type { Memo } from "@/entities/memo";
import { formatMemoStamp, memoSwatch } from "../lib/memo-view";
import { MemoDeleteConfirm } from "./MemoDeleteConfirm";

/**
 * 메모 상세(I-15 14) — 읽기 시트 · 1280 이상 Dialog 480(조회). 바깥 누름 · 끌어내림으로 닫힌다.
 * 머리 제목 = 메모 제목(줄바꿈, 비면 "제목 없음"). 본문 맨 위 메타 = 색 점 8 + "{태그 또는 태그 없음} · {수정 시각} 수정 · 고정"
 * (고정일 때만 마지막 조각), 그 아래 본문 t5 줄바꿈 그대로(비면 "내용 없음"). 색 히어로 카드 · 테두리 본문 상자 · 핀 배지는 없다.
 * 바닥은 [삭제] ghost critical(왼쪽) + [수정] neutralSolid — [삭제] 는 확인창(ds Alert Dialog)을 먼저 연다.
 */
export function MemoDetailDialog({
  memo,
  remove,
  onClose,
  onEdit,
}: {
  memo: Memo;
  remove: (memo: Memo) => Promise<boolean>;
  onClose: () => void;
  onEdit: (memo: Memo) => void;
}) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stamp = formatMemoStamp(memo.modifyAt);

  const del = (
    <Button
      variant="ghost"
      ghostColor="critical"
      size={wide ? undefined : "large"}
      className={wide ? "mr-auto" : "shrink-0"}
      onClick={() => setConfirmDelete(true)}
    >
      {tc("delete")}
    </Button>
  );
  const edit = (
    <Button
      variant="neutralSolid"
      size={wide ? undefined : "large"}
      className={wide ? undefined : "flex-1"}
      onClick={() => onEdit(memo)}
    >
      {tc("edit")}
    </Button>
  );

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <ResponsiveDialogContent
          title={memo.title || t("untitled")}
          aria-describedby={undefined}
        >
          <ResponsiveDialogBody>
            <div className="flex items-start gap-x2 pb-x3">
              <span
                aria-hidden
                data-slot="memo-dot"
                className="mt-[5px] block size-[8px] shrink-0 rounded-full"
                style={{ background: memoSwatch(memo.color) }}
              />
              <TagGroup size="t3">
                <TagGroupItem>{memo.tag || t("noTag")}</TagGroupItem>
                {stamp ? (
                  <TagGroupItem>
                    {t("modifiedAt", { time: stamp })}
                  </TagGroupItem>
                ) : null}
                {memo.isPinned ? <TagGroupItem>{t("pin")}</TagGroupItem> : null}
              </TagGroup>
            </div>
            {memo.content ? (
              <p className="m-0 whitespace-pre-wrap pb-x2 font-sans text-t5 font-normal text-fg-neutral [overflow-wrap:anywhere]">
                {memo.content}
              </p>
            ) : (
              <p className="m-0 pb-x2 font-sans text-t5 font-normal text-fg-neutral-subtle">
                {t("detail.noContent")}
              </p>
            )}
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            {wide ? (
              <>
                {del}
                {edit}
              </>
            ) : (
              <div className="flex w-full items-center gap-x2">
                {del}
                {edit}
              </div>
            )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {confirmDelete && (
        <MemoDeleteConfirm
          memo={memo}
          remove={remove}
          onClose={() => setConfirmDelete(false)}
          onDeleted={onClose}
        />
      )}
    </>
  );
}
