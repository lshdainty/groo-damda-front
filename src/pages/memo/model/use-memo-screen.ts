import { useRef, useState } from "react";
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
  // 편집기 선택지 — 서버 태그 목록(앱과 같다). 지금 메모의 태그가 목록에 없으면 폼이 그 값만 더 지킨다.
  const tagNames = (memoTagsQ.data ?? []).map((tag) => tag.tagName);
  // 태그 목록을 받았다 — 로딩 · 실패 중에는 "태그가 없다" 안내를 하지 않는다
  const tagsReady = !memoTagsQ.isLoading && !memoTagsQ.isError;

  const [query, setQuery] = useState("");
  const [pickedFilter, setTagFilter] = useState<string>("all");
  const [editing, setEditing] = useState<MemoEditing>(null);
  const [viewingRaw, setViewing] = useState<Memo | null>(null);
  // 저장이 실패했다 — 폼 맨 위 Callout(고정 글). 폼은 열려 있고 입력값은 그대로다. seq 는 실패마다 늘어 화면에 들이는 신호가 된다
  const [saveError, setSaveError] = useState(false);
  const [saveErrorSeq, setSaveErrorSeq] = useState(0);
  // 폼을 연 차례 — 저장 중 닫았거나 다른 폼을 열었는지 안다(L8). 고정 요청이 도는 메모(연타 방지, L6)
  const session = useRef(0);
  const pinning = useRef(new Set<number>());

  const chips = memoTagChips(memos, memoTagsQ.data);
  // 거르던 태그의 마지막 메모가 사라지면 전체로 돌아간다(앱과 같다 — M4). 불러오는 중에는 그대로 둔다
  const tagFilter =
    pickedFilter === "all" ||
    memosQ.isLoading ||
    chips.some((c) => c.key === pickedFilter)
      ? pickedFilter
      : "all";
  // 상세는 목록의 최신 값으로 그린다 — 지워졌으면(다시 시도로 지운 경우 포함) 닫는다(M1)
  const viewing = viewingRaw
    ? (memos.find((m) => m.rowId === viewingRaw.rowId) ?? null)
    : null;
  const filtered = filterMemos(memos, query, tagFilter);
  const pinned = filtered.filter((m) => m.isPinned);
  const others = filtered.filter((m) => !m.isPinned);

  const openEditor = (target: Exclude<MemoEditing, null>) => {
    session.current += 1;
    setSaveError(false);
    setEditing(target);
  };
  const closeEditor = () => {
    session.current += 1;
    setEditing(null);
  };

  /** 고정 토글 — 실패하면 critical 스낵바 + [다시 시도]. 끝났으면 true */
  const pinOf = async (memo: Memo): Promise<boolean> => {
    // 요청이 도는 동안 같은 메모의 고정을 다시 누르면 토글이 두 번 나가 제자리로 돌아간다 — 막는다(L6)
    if (pinning.current.has(memo.rowId)) return false;
    pinning.current.add(memo.rowId);
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
    } finally {
      pinning.current.delete(memo.rowId);
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
   * **폼을 열 때 값**(`wasPinned`)과 다르면 저장 뒤 그 경로를 한 번 부른다(QA 30 8 — 앱과 같은 기준. 폼을 연 사이 다른 기기가
   * 바꾼 값에 끌려 토글되지 않는다, L7). 저장이 끝나고 목록을 다시 받은 뒤에 폼을 닫는다.
   * 저장 중 ✕ 로 닫았다면(다른 폼을 열었다면) 성공은 그 폼을 건드리지 않고 실패는 스낵바 + 다시 시도로 알린다(L8).
   */
  const save = async (
    values: MemoFormValues,
    id: number | undefined,
    pin: boolean,
    wasPinned: boolean,
  ): Promise<void> => {
    const mine = session.current;
    setSaveError(false);
    let saved: Memo;
    try {
      saved =
        id != null
          ? await updateMemo.mutateAsync({ id, data: values })
          : await createMemo.mutateAsync(values);
    } catch {
      if (session.current === mine) {
        setSaveError(true);
        setSaveErrorSeq((n) => n + 1);
      } else {
        snackbar.show({
          message: t("saveFailed"),
          tone: "critical",
          action: {
            label: tc("retry"),
            onClick: () => void save(values, id, pin, wasPinned),
          },
        });
      }
      return;
    }
    if (session.current === mine) closeEditor();
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
    closeEditor,
    viewing,
    setViewing,
    saveError,
    saveErrorSeq,
    tagsReady,
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
