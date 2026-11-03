import {
  useCreateMemoTag,
  useDeleteMemoTag,
  useMemoTags,
  useUpdateMemoTag,
} from "@/features/memo-tag";
import { TagSettings } from "@/shared/ui/groo/tag-settings";

/**
 * 메모 태그 설정 본문(I-15 20 ~ 24) — 할 일 태그와 한 부품(`TagSettings`)을 쓴다. 글 키만 다르다(`memo:tags.*`).
 * 설정 틀(폰 머리 · `ManagerHead` 자체 · 왼쪽 목록)은 범위 밖이고, 본문 · 머리에 넘기는 글 · 버튼만 이쪽이다.
 *
 * 삭제 확인 문구에 **사용 수를 양쪽 경로(밀기 · 메뉴) 모두** 넘긴다 — 한 경로가 `count` 를 빠뜨리면 "N건" 안내가 깨진다(QA #104).
 * 요청은 `silent` — 실패 안내는 서버 글이 아니라 화면의 고정 글이다.
 */
export function MemoTagManager({ mobile }: { mobile: boolean }) {
  const tagsQ = useMemoTags({ silent: true });
  const createMut = useCreateMemoTag({ silent: true });
  const updateMut = useUpdateMemoTag({ silent: true });
  const deleteMut = useDeleteMemoTag({ silent: true });
  return (
    <TagSettings
      ns="memo"
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
