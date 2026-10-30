import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateMemo,
  useDeleteMemo,
  useMemos,
  useToggleMemoPin,
  useUpdateMemo,
} from "@/features/memo";
import { useMemoTags } from "@/features/memo-tag";
import { useSnackbar } from "@/shared/ds/snackbar";
import type { Memo, MemoFormValues } from "@/entities/memo";
import { memoTagOptions } from "../lib/memo-tags";
import { filterMemos, memoTagChips } from "./memo-list";

/** 열린 편집 — 있는 메모(편집) · `{ _new: true }`(새 메모) · null(닫힘) */
export type MemoEditing = Memo | { _new: true } | null;

/**
 * 메모 화면의 셈과 동작 — 폰 · 데스크톱이 같은 것을 쓴다(I-15 4).
 * 검색 · 태그 거르기 · 정렬(고정 먼저 → 수정 시각 내림) · 고정 / 나머지 나누기 · 태그별 건수 · 저장 뒤 고정 맞추기.
 *
 * 실패 안내는 전역 서버 원문 토스트가 아니라 여기서 고정 글로 한다(요청은 `silent`) — 저장은 폼 안 Callout(`saveError`),
 * 삭제 · 고정은 critical 스낵바 + [다시 시도]. 저장 · 삭제는 목록을 다시 받은 뒤에 끝난다.
 */
export function useMemoScreen() {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const snackbar = useSnackbar();
  const memosQ = useMemos(undefined, { silent: true });
  const memoTagsQ = useMemoTags({ silent: true });
  const createMemo = useCreateMemo({ silent: true });
  const updateMemo = useUpdateMemo({ silent: true });
  const togglePin = useToggleMemoPin({ silent: true });
  const deleteMemo = useDeleteMemo({ silent: true });

  const memos: Memo[] = memosQ.data ?? [];
  // 편집기 선택지 — 서버 태그 ∪ 기존 메모에 남은 이름. 둘 다 비면 빈 목록이다.
  const tagNames = memoTagOptions(memoTagsQ.data, memos);

  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [editing, setEditing] = useState<MemoEditing>(null);
  const [viewing, setViewing] = useState<Memo | null>(null);
  // 저장이 실패했다 — 폼 맨 위 Callout(고정 글). 폼은 열려 있고 입력값은 그대로다
  const [saveError, setSaveError] = useState(false);

  const chips = memoTagChips(memos, memoTagsQ.data);
  const filtered = filterMemos(memos, query, tagFilter);
  const pinned = filtered.filter((m) => m.isPinned);
  const others = filtered.filter((m) => !m.isPinned);

  const openEditor = (target: Exclude<MemoEditing, null>) => {
    setSaveError(false);
    setEditing(target);
  };

  /** 고정 토글 — 실패하면 critical 스낵바 + [다시 시도]. 끝났으면 true */
  const pinOf = async (memo: Memo): Promise<boolean> => {
    try {
      await togglePin.mutateAsync(memo.rowId);
      return true;
    } catch {
      snackbar.show({
        message: t("pinFailed"),
        tone: "critical",
        action: { label: tc("retry"), onClick: () => void pinOf(memo) },
      });
      return false;
    }
  };

  /** 삭제 — 실패하면 critical 스낵바 + [다시 시도](다시 묻지 않고 같은 삭제를 바로). 지웠으면 true */
  const remove = async (memo: Memo): Promise<boolean> => {
    try {
      await deleteMemo.mutateAsync(memo.rowId);
      return true;
    } catch {
      snackbar.show({
        message: t("deleteFailed"),
        tone: "critical",
        action: { label: tc("retry"), onClick: () => void remove(memo) },
      });
      return false;
    }
  };

  /**
   * 저장 — 고정은 저장 본문에 칸이 없고 `PATCH /memo/{id}/pin` 하나로만 바뀐다. 그래서 폼의 '상단에 고정' 이
   * 지금과 다르면 저장 뒤 그 경로를 한 번 부른다(QA 30 8). 저장이 끝나고 목록을 다시 받은 뒤에 폼을 닫는다.
   */
  const save = async (
    values: MemoFormValues,
    id: number | undefined,
    pin: boolean,
  ): Promise<void> => {
    setSaveError(false);
    const wasPinned =
      id != null && memos.find((m) => m.rowId === id)?.isPinned === true;
    let saved: Memo;
    try {
      saved =
        id != null
          ? await updateMemo.mutateAsync({ id, data: values })
          : await createMemo.mutateAsync(values);
    } catch {
      setSaveError(true);
      return;
    }
    setEditing(null);
    if (pin !== wasPinned) {
      await pinOf({ ...saved, isPinned: wasPinned });
    }
  };

  return {
    memosQ,
    memos,
    tagNames,
    query,
    setQuery,
    tagFilter,
    setTagFilter,
    chips,
    filtered,
    pinned,
    others,
    editing,
    openEditor,
    closeEditor: () => setEditing(null),
    viewing,
    setViewing,
    saveError,
    saving: createMemo.isPending || updateMemo.isPending,
    save,
    remove,
    pinOf,
    pinPending: togglePin.pendingIds,
    loading: memosQ.isLoading,
    failed: memosQ.isError && !memosQ.data,
  };
}

export type MemoScreen = ReturnType<typeof useMemoScreen>;
