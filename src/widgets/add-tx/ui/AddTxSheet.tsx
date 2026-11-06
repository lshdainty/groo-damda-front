import { useTxForm, type TxFormProps } from "../model/use-tx-form";
import { useTxSheetParts } from "./use-tx-sheet-parts";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { SheetStepDone } from "@/widgets/calendar/ui/event-form/step-header";

export function AddTxSheet(props: TxFormProps) {
  // 열린 거래가 바뀌면 칸 값 · 단계를 새로 쌓는다 — 제목이 같은 다른 거래의 값이 남지 않게(09b-1 의 isSyncedWith 교훈)
  const key =
    props.expense?.rowId ??
    props.editTransfer?.rowId ??
    props.rewrite?.of.rowId ??
    "new";
  return <AddTxSheetBody key={key} {...props} />;
}

function AddTxSheetBody(props: TxFormProps) {
  const f = useTxForm(props);
  const p = useTxSheetParts(f, {
    mobile: props.mobile,
    embedded: false,
    onClose: props.onClose,
  });
  const { t, tc } = f;
  const { sub, wide, isNew, twoOfTwo, showSubDone, subDone, leave } = p;

  // [고쳐 쓰기] — 이 시트를 새 거래 모드 시트로 갈아 끼운다(D13)
  if (f.rewriting && props.expense) {
    return (
      <AddTxSheet
        mobile={props.mobile}
        onClose={props.onClose}
        rewrite={{ of: props.expense, splits: f.serverSplitForms }}
        onReplaced={props.onReplaced}
      />
    );
  }

  const { title, body, footer, bodyRef, contentRef, back } = p;

  return (
    <>
      <ResponsiveDialog
        open
        form
        // 단계 안에서는 ← 가 묻는다 — 시트 전체를 닫는 물음은 단계 밖에서만
        dirty={f.dirty && !sub}
        // 저장하는 동안은 닫지 않는다 — 닫기 · 뒤로 가기 · Esc 를 표면이 받지 않는다(칸은 다시 쌓는다)
        busy={f.submitting}
        onOpenChange={(next) => {
          if (next) return;
          if (sub) {
            void leave.request();
            return;
          }
          props.onClose();
        }}
      >
        <ResponsiveDialogContent
          ref={contentRef}
          title={title}
          // 값 하나를 치는 단계는 닫기 원 자리에 "완료" 가 들어온다(I-09 29) — 닫기 원을 숨긴다
          className={
            [
              !wide && showSubDone
                ? "[&_[data-slot=bottom-sheet-close]]:hidden"
                : "",
              // 제목 위 작은 글("2 / 2단계")이 있으면 ← 는 제목 첫 줄 가운데에 선다 — 작은 글 한 줄(t3 줄 높이)만큼 내린다(bottom-sheet.md:61)
              twoOfTwo
                ? "[&_[data-slot=bottom-sheet-back]]:mt-[var(--text-t3--line-height)] [&_[data-slot=dialog-back]]:mt-[var(--text-t3--line-height)]"
                : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onBack={sub || twoOfTwo ? () => void back() : undefined}
          onOpenAutoFocus={(e) => {
            // 금액 칸이 열자마자 초점(숫자 키보드) — 표면 기본 초점을 막고 직접 준다
            if (f.main === "1" && !sub && isNew) {
              e.preventDefault();
              f.fieldRefs.current.entry?.focus({ preventScroll: true });
            }
          }}
        >
          {leave.node}
          {!wide && showSubDone && <SheetStepDone onClick={subDone} />}
          <ResponsiveDialogBody ref={bodyRef} scrollFog>
            {f.saveFailed && !sub && f.main === "2" && (
              <div className="pb-x3">
                <Callout tone="critical" role="alert">
                  {f.listsFailed
                    ? tc("query.referenceSaveFailed")
                    : f.saveUnconfirmed
                      ? tc("query.saveUnconfirmed")
                      : t("addTx.saveFailed")}
                </Callout>
              </div>
            )}
            <div className="-mx-x6">{body}</div>
          </ResponsiveDialogBody>
          {p.above}
          {(footer || wide) && (
            <ResponsiveDialogFooter>
              {wide && sub ? (
                <>
                  <Button
                    variant="neutralWeak"
                    onClick={() => void leave.request()}
                  >
                    {tc("cancel")}
                  </Button>
                  {showSubDone && (
                    <Button onClick={subDone}>{tc("done")}</Button>
                  )}
                  {!showSubDone && footer}
                </>
              ) : (
                <>
                  <ResponsiveDialogCancel>
                    {tc("cancel")}
                  </ResponsiveDialogCancel>
                  {footer}
                </>
              )}
            </ResponsiveDialogFooter>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {p.overlays}
    </>
  );
}
