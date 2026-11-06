import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toLocalDateKey, todayLocalKey } from "@/shared/lib/date";
import { Plus, Sparkles } from "lucide-react";
import {
  useTodos,
  useCreateTodo,
  useUpdateTodo,
  useToggleTodoStatus,
  useDeleteTodo,
} from "@/features/todo";
import { useTodoTags } from "@/features/todo-tag";
import {
  useConstellationSky,
  useConstellationToday,
} from "@/features/constellation";
import { NIGHT_SKY_PATH, REPORT_PATH } from "@/shared/config";
import { isDone } from "@/pages/todo/model/todo-ledger";
import { todoTagOptions } from "@/pages/todo/lib/todo-tags";
import { TodoMobileLedger } from "./TodoMobileLedger";
import { TodoDesktop } from "./TodoDesktop";
import { TodoDetailDialog } from "./TodoDetailDialog";
import { TodoFormDialog } from "./TodoFormDialog";
import type { Todo, TodoFormValues } from "@/entities/todo";
import { DOUBLE_CLICK_GUARD_MS } from "@/shared/ui/button";
import { FloatingActionButton } from "@/shared/ds/floating-action-button";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

/** TodoPage 진입 시 사용하는 useQuery 의 isLoading 집계. */
function useTodoPageData() {
  const todosQ = useTodos();
  return {
    isLoading: todosQ.isLoading,
    failed: todosQ.isError && !todosQ.data,
  };
}

export const TodoPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  const { isLoading, failed } = useTodoPageData();
  // 폰 · 넓은 화면 모두 틀(제목 · 달력 · 카드)은 그리고 데이터 자리만 기다린다(I-10 18 · 29)
  return <TodoPageInner mobile={mobile} loading={isLoading} failed={failed} />;
};

const TodoPageInner = ({
  mobile,
  loading,
  failed,
}: {
  mobile: boolean;
  loading: boolean;
  failed: boolean;
}) => {
  const { t } = useTranslation("todo");
  const todosQ = useTodos();
  // 저장 실패는 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글), 삭제는 확인창을 닫고 스낵바 + [다시 시도]
  const createTodo = useCreateTodo({ silent: true });
  const updateTodo = useUpdateTodo({ silent: true });
  const toggleStatus = useToggleTodoStatus();
  const deleteTodo = useDeleteTodo({ silent: true });
  const todoTagsQ = useTodoTags({ reference: true });

  const todos: Todo[] = useMemo(() => todosQ.data ?? [], [todosQ.data]);
  const today = useMemo(() => todayLocalKey(), []);

  // ── 별자리 게이미피케이션 — 할일 화면엔 스트립/토글 진입점만, 상세는 밤하늘 화면 ──
  const constellationTodayQ = useConstellationToday({ reference: true });
  // 모바일 원장 캘린더 마크(수집★/구름)용 — 이번 달 커버 확보(45일)
  const skyQ = useConstellationSky(45, { reference: true });
  // 오늘 완료 건수 — 완료 이벤트(completedAt) 기준 (히어로 캡션용)
  // completedAt 은 서버가 주는 `[UTC]` 라 로컬 날짜로 바꿔서 비교한다. 문자열을 자르면
  // UTC 날짜라, KST 새벽 0~9시에 끝낸 할일이 전날로 빠진다(today 는 로컬 날짜다).
  const doneToday = useMemo(
    () =>
      todos.filter(
        (td) => isDone(td) && toLocalDateKey(td.completedAt) === today,
      ).length,
    [todos, today],
  );

  // 태그 목록 — TodoTag(설정 관리) + 기존 할 일에 남은 카테고리 union. 둘 다 비면 빈 목록.
  const tagNames = todoTagOptions(todoTagsQ.data, todos);
  // 태그 이름 → 색(남은 할 일 카드의 점) — 설정 태그만 색이 있다
  const tagColors = useMemo(
    () =>
      new Map((todoTagsQ.data ?? []).map((tag) => [tag.tagName, tag.color])),
    [todoTagsQ.data],
  );

  // editing: Todo(편집) | { _new: true }(신규) | null(닫힘)
  const [editing, setEditing] = useState<Todo | { _new: true } | null>(null);
  // viewing: 행 클릭 → 읽기 전용 상세 (수정 버튼으로 editing 전환)
  const [viewing, setViewing] = useState<Todo | null>(null);
  // 밤하늘 · 관측 리포트는 주소로 열린다 — 덮개 · 대화상자가 아니라 화면(I-11 3)
  const navigate = useNavigate();
  const openNightSky = () => navigate(NIGHT_SKY_PATH);
  const openReport = () => navigate(REPORT_PATH);
  // 별빛 획득 토스트 — 완료 시 "+N · 수집까지 N별"
  const [starToast, setStarToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 같은 행을 따닥 눌러도 토글은 한 번만 나간다. `pendingIds` 잠금은 요청이 끝나면
  // 풀리는데(통신이 빠르면 100ms 남짓) 두 번째 탭이 그 뒤에 올 수 있고, 완료 원은
  // 공용 Button 이 아니라 원시 <button> 이라 거기 든 더블클릭 방어도 안 걸린다.
  const lastToggleAt = useRef(new Map<number, number>());

  // 완료 토글 + 별빛 토스트 — 서버가 돌려준 실제 적립량(earnedStarlight)으로만 띄운다.
  // 낙관적으로 계산하면 평생 1회 정책에 걸려 적립이 0 이어도 "+N" 이 떠서 거짓말이 된다.
  const onToggleTodo = (td: Todo) => {
    const now = Date.now();
    if (now - (lastToggleAt.current.get(td.rowId) ?? 0) < DOUBLE_CLICK_GUARD_MS)
      return;
    lastToggleAt.current.set(td.rowId, now);
    toggleStatus.mutate(td.rowId, {
      onSuccess: (updated) => {
        const gain = updated.earnedStarlight ?? 0;
        const sky = constellationTodayQ.data;
        if (gain <= 0 || !sky || sky.collected) return;
        const left = Math.max(0, sky.goal - (sky.points + gain));
        setStarToast(
          left === 0
            ? t("starToast.collected", { gain })
            : t("starToast.progress", { gain, left }),
        );
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setStarToast(null), 2200);
      },
    });
  };

  const saveFailed = createTodo.isError || updateTodo.isError;
  const saveError = createTodo.error ?? updateTodo.error ?? undefined;
  const clearSaveError = () => {
    createTodo.reset();
    updateTodo.reset();
  };
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면(성공 · 실패) 끈다
  const savingRef = useRef(false);
  const settle = {
    onSettled: () => {
      savingRef.current = false;
    },
    onSuccess: () => setEditing(null),
  };
  const onSave = (values: TodoFormValues, id?: number) => {
    if (savingRef.current) return;
    savingRef.current = true;
    clearSaveError();
    if (id != null) updateTodo.mutate({ id, data: values }, settle);
    else createTodo.mutate(values, settle);
  };

  const overlays = (
    <>
      {starToast && (
        <div className="star-toast">
          <Sparkles size={14} /> {starToast}
        </div>
      )}
    </>
  );

  const dialog = (
    <>
      {viewing != null && (
        <TodoDetailDialog
          todo={viewing}
          today={today}
          onClose={() => setViewing(null)}
          onEdit={(td) => {
            setViewing(null);
            setEditing(td);
          }}
          onDelete={(id) =>
            deleteTodo.mutateAsync(id).then(() => setViewing(null))
          }
        />
      )}
      {editing != null && (
        <TodoFormDialog
          todo={"_new" in editing ? null : editing}
          today={today}
          tags={tagNames}
          onClose={() => {
            clearSaveError();
            setEditing(null);
          }}
          onSave={onSave}
          submitting={createTodo.isPending || updateTodo.isPending}
          saveFailed={saveFailed}
          saveError={saveError}
        />
      )}
    </>
  );

  // 폭으로 갈리는 건 몸통(폰 원장 · 넓은 화면)뿐이다 — 상세 · 폼 · 토스트는 갈림 밖 한 자리에 둔다.
  // 두 return 에 따로 두면 폭이 768 을 넘나들 때 창은 열린 채 다시 붙으며 쓰던 값이 빈다(I-wrap-b1 ε 9)
  const body = mobile ? (
    // ── 모바일 — 흰 면 하나: 상단 바 + 원장(머리 · 선 · 날짜 묶음) + 떠 있는 [+] ──────
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/more" />
        <TopNavigationTitle>{t("pageTitle")}</TopNavigationTitle>
      </TopNavigation>
      {/* 목록이 짧아도 흰 면이 화면 아래 끝까지 닿는다 — 아래 96 은 [+] 가 마지막 줄을 가리지 않게 하는 흰 면 안 여백 */}
      <div className="relative flex-1 bg-bg-layer-default pb-[96px]">
        <TodoMobileLedger
          todos={todos}
          tags={tagNames}
          constellationToday={constellationTodayQ.data}
          sky={skyQ.data ?? []}
          doneToday={doneToday}
          pinTop={56}
          loading={loading}
          failed={failed}
          onRetry={() => void todosQ.refetch()}
          onToggle={onToggleTodo}
          holdIds={toggleStatus.holdIds}
          onRowClick={setViewing}
          // 밀기 액션 — 상세 footer 의 수정·삭제와 같은 목적지·같은 뮤테이션.
          onEdit={setEditing}
          onDelete={(td) => deleteTodo.mutateAsync(td.rowId)}
          openNightSky={openNightSky}
          openReport={openReport}
        />
        <FloatingActionButton
          icon={<Plus />}
          aria-label={t("addTodoLabel")}
          onClick={() => setEditing({ _new: true })}
        />
      </div>
    </>
  ) : (
    // ── 데스크톱 · 태블릿 ─────────────────────────────────────────────────────
    <TodoDesktop
      todos={todos}
      tagNames={tagNames}
      tagColors={tagColors}
      today={today}
      holdIds={toggleStatus.holdIds}
      loading={loading}
      failed={failed}
      onRetry={() => void todosQ.refetch()}
      onToggle={onToggleTodo}
      onOpen={setViewing}
      onAdd={() => setEditing({ _new: true })}
      sky={skyQ.data ?? []}
      constellationToday={constellationTodayQ.data}
      doneToday={doneToday}
      openNightSky={openNightSky}
      openReport={openReport}
    />
  );

  return (
    <>
      {body}
      {dialog}
      {overlays}
    </>
  );
};
