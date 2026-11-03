import {
  useCreateTodoTag,
  useDeleteTodoTag,
  useTodoTags,
  useUpdateTodoTag,
} from "@/features/todo-tag";
import { TagSettings } from "@/shared/ui/groo/tag-settings";

/**
 * 할 일 태그 설정 본문 — 메모 태그와 한 부품(`TagSettings`)을 쓴다(I-10 33 ~ 37 · I-15 20 ~ 24, 열린 질문 Q4 B).
 * 폰은 흰 면 하나, 데스크톱 · 태블릿은 머리 설명 + 카드 하나 · 줄 끝 ⋮ 다. 글 키만 다르다(`todo:tags.*`).
 */
export function TodoTagManager({ mobile }: { mobile: boolean }) {
  const tagsQ = useTodoTags({ silent: true });
  const createMut = useCreateTodoTag({ silent: true });
  const updateMut = useUpdateTodoTag({ silent: true });
  const deleteMut = useDeleteTodoTag({ silent: true });
  return (
    <TagSettings
      ns="todo"
      mobile={mobile}
      tags={tagsQ.data ?? []}
      loading={tagsQ.isLoading}
      failed={tagsQ.isError && !tagsQ.data}
      onRetry={() => void tagsQ.refetch()}
      create={(values) => createMut.mutateAsync(values)}
      update={(id, values) => updateMut.mutateAsync({ id, data: values })}
      remove={(id) => deleteMut.mutateAsync(id)}
    />
  );
}
