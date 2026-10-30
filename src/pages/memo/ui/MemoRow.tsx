import { useTranslation } from "react-i18next";
import { ListButtonItem } from "@/shared/ds/list";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { cn } from "@/shared/lib/cn";
import type { Memo } from "@/entities/memo";
import { formatMemoStamp, memoSwatch } from "../lib/memo-view";

/**
 * 메모 줄(I-15 9) — ds List 누르는 줄. 위 맞춤(제목이 두 줄을 넘는다) · 앞 색 점 8(위 7 — 제목 첫 줄 가운데) ·
 * 제목 t5 줄바꿈(말줄임 없음, 비면 "제목 없음") · 본문 한 줄(t4 muted, 한 줄 말줄임, 비면 줄을 두지 않는다) ·
 * 메타 Tag Group t3 한 줄 말줄임 "{태그 또는 태그 없음} · {수정 시각}"(시각이 비면 조각을 뺀다).
 * 줄 안 고정 표시 · 줄 사이 선 · 줄 끝 ⋮ 는 두지 않는다 — 고정은 묶음 제목 "고정 · N" 이 말하고,
 * 고정 / 수정 / 삭제는 밀기 · 상세 · 폼이 맡는다(좁은 목록 줄에는 ⋮ 를 두지 않는다 — 10-25).
 */
export function MemoRow({
  memo,
  onOpen,
}: {
  memo: Memo;
  onOpen: (memo: Memo) => void;
}) {
  const { t } = useTranslation("memo");
  const stamp = formatMemoStamp(memo.modifyAt);
  return (
    <ListButtonItem
      align="top"
      onClick={() => onOpen(memo)}
      prefix={
        <span
          aria-hidden
          data-slot="memo-dot"
          className="mt-[7px] block size-[8px] rounded-full"
          style={{ background: memoSwatch(memo.color) }}
        />
      }
      title={
        <span className={cn(!memo.title && "text-fg-neutral-subtle")}>
          {memo.title || t("untitled")}
        </span>
      }
      detail={
        <>
          {memo.content ? (
            <span
              data-slot="memo-body"
              className="block truncate text-t4 text-fg-neutral-muted"
            >
              {memo.content}
            </span>
          ) : null}
          <TagGroup size="t3" truncate>
            <TagGroupItem>{memo.tag || t("noTag")}</TagGroupItem>
            {stamp ? <TagGroupItem>{stamp}</TagGroupItem> : null}
          </TagGroup>
        </>
      }
    />
  );
}
