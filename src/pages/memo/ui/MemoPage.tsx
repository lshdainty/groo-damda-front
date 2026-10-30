import { useOutletContext } from "react-router-dom";
import { useMemoScreen } from "../model/use-memo-screen";
import { MemoDesktop } from "./MemoDesktop";
import { MemoDetailDialog } from "./MemoDetailDialog";
import { MemoFormDialog } from "./MemoFormDialog";
import { MemoMobile } from "./MemoMobile";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

/**
 * 메모 — 폭으로 폰(768 미만) · 데스크톱 갈래를 고르는 자리만 남는다(I-15 4). 셈과 동작은 `useMemoScreen`,
 * 상세 · 추가 · 수정 폼은 두 갈래가 같은 부품을 쓴다(1280 미만 시트 · 이상 대화상자는 부품이 스스로 고른다).
 */
export const MemoPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  const screen = useMemoScreen();
  const { editing } = screen;
  // 상세는 목록의 최신 값으로 그린다 — 머리 ⋮ 로 고정을 바꾸면 메타 · 메뉴 글이 바로 따라간다
  const viewing =
    screen.viewing &&
    (screen.memos.find((m) => m.rowId === screen.viewing!.rowId) ??
      screen.viewing);

  return (
    <>
      {mobile ? (
        <MemoMobile screen={screen} />
      ) : (
        <MemoDesktop screen={screen} />
      )}
      {viewing != null && (
        <MemoDetailDialog
          memo={viewing}
          remove={screen.remove}
          pin={screen.pinOf}
          onClose={() => screen.setViewing(null)}
          onEdit={(m) => {
            screen.setViewing(null);
            screen.openEditor(m);
          }}
        />
      )}
      {editing != null && (
        <MemoFormDialog
          memo={"_new" in editing ? null : editing}
          tags={screen.tagNames}
          saveError={screen.saveError}
          submitting={screen.saving}
          onClose={screen.closeEditor}
          onSave={screen.save}
        />
      )}
    </>
  );
};
