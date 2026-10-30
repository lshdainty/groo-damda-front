import { useEffect, useRef } from "react";

import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import { useSnackbar } from "@/shared/ds/snackbar";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { SplitTxDialog } from "@/features/expense-split/ui/SplitTxDialog";
import { SheetStepDone } from "@/widgets/calendar/ui/event-form/step-header";
import { useStepBack } from "@/widgets/calendar/model/use-step-back";
import { useTxForm, type TxFormProps, type TxSub } from "../model/use-tx-form";
import { TxStep1 } from "./TxStep1";
import { TxStep2 } from "./TxStep2";
import { amountText } from "../lib/amount-format";
import {
  AmountSub,
  FeeSub,
  MemoSub,
  PresetAllSub,
  PresetAmountSub,
  PresetSaveSub,
  SmsSub,
} from "./TxSubs";

/**
 * 거래 추가 · 수정 (I-21 D 19 ~ 27) — 금액을 먼저 받는 두 단계(1-B).
 *
 * 새 거래는 ① 종류 칩 · 밑줄 금액 · 프리셋 · 결제 문자 → [다음] → ② 거래처 · 줄 칸 · 고정 스위치 → [추가].
 * 수정 · 고쳐 쓰기는 2단계로 바로 열리고 금액은 줄 › 한 단계다. 메모 · 수수료 · 이자 · 금액 · 결제 문자 · 프리셋 고르기 · 프리셋 저장은
 * 같은 시트(1280 이상은 같은 대화상자) 안의 한 단계다 — 겹친 시트 · 대화상자를 만들지 않는다.
 * 상태는 `useTxForm` 한 곳이 들고 있어 1280 을 넘나들어도 값 · 단계가 남는다.
 * 바깥 누르기 · 끌어내리기로는 닫히지 않고, 바뀐 값이 있으면 닫기 전에 "작성한 내용이 사라져요" 를 묻는다.
 * 저장 실패는 전역 서버 원문 토스트 대신 폼 맨 위 Callout(고정 문구)이 알린다.
 */
/**
 * 거래 상세 같은 호스트 시트 안에 한 단계로 끼울 때(I-21 7a) 호스트가 받는 조각. 호스트가 자기 표면(머리 · 본문 · 바닥)에 이것을
 * 그리고, 닫는 길(← · Esc · 기기 뒤로 가기)은 호스트가 맡아 `onBack` 을 부른다 — 단계 안에서는 들어올 때 값으로 되돌리고,
 * 수정 폼 자리에서는 상세로 돌아간다(`AddTxSheet` 의 `onBack`).
 */
export interface TxEmbedParts {
  title: React.ReactNode;
  body: React.ReactNode;
  /** 바닥 버튼들 — 시트는 large, 대화상자는 small([취소] 포함). 비면 null */
  footer: React.ReactNode;
  /** 지금 자리에서 ← 로 나가면 버려지는 값이 있다 — 호스트가 "작성한 내용이 사라져요" 를 먼저 묻는다 */
  dirty: boolean;
  /** 한 단계 뒤 — 호스트의 ← · Esc · 기기 뒤로 가기가 부른다(묻는 일은 호스트) */
  onBack: () => void;
  /** 단계 안에 있다(값 하나를 치는 단계 등) — 시트 머리의 닫기 원 자리에 "완료" 를 둘지 호스트가 정한다 */
  inSub: boolean;
  onDone: () => void;
  /** 표면 밖에 그릴 것(저장 확인창 · 맞추기 대화상자) */
  overlays: React.ReactNode;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}

export function AddTxSheet(
  props: TxFormProps & {
    /** 있으면 자기 표면을 그리지 않고 호스트 표면에 끼운다(7a) */
    embed?: (parts: TxEmbedParts) => React.ReactNode;
    /** 끼운 수정 폼에서 ← — 상세로 돌아간다 */
    onBack?: () => void;
  },
) {
  // 열린 거래가 바뀌면 칸 값 · 단계를 새로 쌓는다 — 제목이 같은 다른 거래의 값이 남지 않게(09b-1 의 isSyncedWith 교훈)
  const key =
    props.expense?.rowId ??
    props.editTransfer?.rowId ??
    props.rewrite?.of.rowId ??
    "new";
  return <AddTxSheetBody key={key} {...props} />;
}

function AddTxSheetBody(
  props: TxFormProps & {
    embed?: (parts: TxEmbedParts) => React.ReactNode;
    onBack?: () => void;
  },
) {
  const f = useTxForm(props);
  const { t, tc } = f;
  const wide = useWideSurface();
  const snackbar = useSnackbar();
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const smsRunRef = useRef<(() => void) | null>(null);
  const isNew = !f.isEdit && !f.isRewrite;
  const sub = f.sub;
  const twoOfTwo = isNew && f.main === "2" && !sub;

  // ← · 기기 뒤로 가기 — 단계 안에서는 들어올 때 값으로 되돌리고(바뀐 값이 있으면 먼저 묻는다), 새 거래 2단계는 1단계로
  const leave = useLeaveConfirm({
    dirty: f.subDirty,
    leave: () => f.leaveSub(true),
    contentRef,
  });
  const embedded = props.embed != null;
  const back = (): boolean => {
    if (sub) return leave.request();
    if (twoOfTwo) {
      f.setMain("1");
      return true;
    }
    return true;
  };
  useStepBack(!embedded && !wide && (sub != null || twoOfTwo), back);

  // Esc — 새 거래 2단계는 1단계로(닫기 단추는 시트를 닫는다). 위에 고르기 시트 · 확인창이 떠 있으면 그쪽이 먼저 받는다
  useEffect(() => {
    if (!twoOfTwo || embedded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const layers = document.querySelectorAll(
        '[role="dialog"],[role="alertdialog"]',
      );
      if (layers[layers.length - 1] !== contentRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      f.setMain("1");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [twoOfTwo, embedded, f]);

  // 저장이 실패하면 본문을 맨 위로 — 폼 맨 위 Callout 이 화면 밖에 있지 않게(모션 줄이기면 즉시)
  useEffect(() => {
    if (!f.saveFailed) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    bodyRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [f.saveFailed]);

  // [고쳐 쓰기] — 이 시트를 새 거래 모드 시트로 갈아 끼운다(D13)
  if (f.rewriting && props.expense) {
    return (
      <AddTxSheet
        mobile={props.mobile}
        onClose={props.onClose}
        rewrite={{ of: props.expense, splits: f.serverSplitForms }}
        onReplaced={props.onReplaced}
        embed={props.embed}
        onBack={props.onBack}
      />
    );
  }

  const typeLabel =
    f.type === "EXPENSE"
      ? t("expense")
      : f.type === "INCOME"
        ? t("income")
        : t("addTx.transfer");

  const subTitle: Record<TxSub, string> = {
    amount: t("addTx.amountStepTitle"),
    memo: t("addTx.memoStepTitle"),
    fee: t("addTx.feeStepTitle"),
    interest: t("addTx.interestStepTitle"),
    sms: t("sms.pasteOpen"),
    presetAll: t("addTx.presetAllTitle"),
    presetSave: t("savePreset.title"),
    presetAmount: t("addTx.amountStepTitle"),
  };

  const eyebrow = (text: string) => (
    <span className="block text-t3 font-normal text-fg-neutral-subtle">
      {text}
    </span>
  );
  let title: React.ReactNode;
  if (sub) title = subTitle[sub];
  else if (f.isRewrite) title = t("addTx.rewrite");
  else if (f.isEdit) title = t("addTx.editTitle");
  else if (f.main === "1")
    title = (
      <>
        {eyebrow(t("addTx.stepMeta", { current: 1, total: 2 }))}
        {t("addTx.newTitle")}
      </>
    );
  else
    title = (
      <>
        {eyebrow(t("addTx.stepMeta", { current: 2, total: 2 }))}
        {typeLabel} <MaskAmount>{amountText(f)}</MaskAmount>
      </>
    );

  const primaryLabel = f.splitMismatch
    ? t("addTx.saveSplitAndSave")
    : isNew
      ? t("addTx.add")
      : tc("save");

  // 시트 바닥 주 버튼은 large 48, 대화상자 바닥은 small 36(footer 가 맞춘다)
  const btnSize = wide ? undefined : "large";
  const subDone = () => f.leaveSub(false);
  const showSubDone =
    sub != null && sub !== "sms" && sub !== "presetAll" && sub !== "presetSave";

  let footer: React.ReactNode = null;
  if (sub === "sms") {
    footer = (
      <Button size={btnSize} onClick={() => smsRunRef.current?.()}>
        {t("sms.pasteAction")}
      </Button>
    );
  } else if (sub === "presetSave") {
    footer = (
      <Button
        size={btnSize}
        loading={f.submitting}
        onClick={() =>
          f.savePreset((name) =>
            snackbar.show({
              message: t("savePreset.saved", { name }),
              tone: "positive",
            }),
          )
        }
      >
        {tc("save")}
      </Button>
    );
  } else if (!sub) {
    footer =
      f.main === "1" ? (
        <Button size={btnSize} onClick={f.goNext}>
          {t("addTx.next")}
        </Button>
      ) : (
        <Button
          size={btnSize}
          variant={isNew ? "brandSolid" : "neutralSolid"}
          loading={f.submitting}
          onClick={f.save}
        >
          {primaryLabel}
        </Button>
      );
  }

  const body = !sub ? (
    f.main === "1" ? (
      <TxStep1 f={f} />
    ) : (
      <TxStep2 f={f} />
    )
  ) : sub === "amount" ? (
    <AmountSub f={f} />
  ) : sub === "memo" ? (
    <MemoSub f={f} />
  ) : sub === "fee" ? (
    <FeeSub f={f} kind="fee" />
  ) : sub === "interest" ? (
    <FeeSub f={f} kind="interest" />
  ) : sub === "sms" ? (
    <SmsSub f={f} runRef={smsRunRef} />
  ) : sub === "presetAll" ? (
    <PresetAllSub f={f} />
  ) : sub === "presetSave" ? (
    <PresetSaveSub f={f} />
  ) : (
    <PresetAmountSub f={f} />
  );

  const overlays = (
    <>
      {f.saveConfirm && (
        <ConfirmDialog
          title={f.saveConfirm.title}
          message={f.saveConfirm.notes.join("\n")}
          confirmLabel={tc("save")}
          loading={f.submitting}
          onCancel={() => !f.submitting && f.setSaveConfirm(null)}
          onConfirm={f.confirmSave}
        />
      )}
      {f.openReconcile && f.seed && (
        <SplitTxDialog
          expense={f.seed}
          mobile={props.mobile}
          overrideTotal={f.amountNumber}
          recordedTotal={Math.abs(f.seed.amount)}
          initialSplits={
            f.effectiveSplits.length > 0 ? f.effectiveSplits : undefined
          }
          onReconciled={(splits) => {
            f.setReconciledSplits(splits);
            f.setOpenReconcile(false);
          }}
          onClose={() => f.setOpenReconcile(false)}
        />
      )}
    </>
  );

  if (props.embed) {
    const embedBack = () => {
      if (sub) f.leaveSub(true);
      else if (twoOfTwo) f.setMain("1");
      else props.onBack?.();
    };
    return (
      <>
        {props.embed({
          title,
          body: (
            <>
              {f.saveFailed && !sub && f.main === "2" && (
                <div className="px-global-gutter pb-x3">
                  <Callout tone="critical" role="alert">
                    {t("addTx.saveFailed")}
                  </Callout>
                </div>
              )}
              {body}
            </>
          ),
          footer:
            wide && sub ? (
              <>
                <Button variant="neutralWeak" onClick={embedBack}>
                  {tc("cancel")}
                </Button>
                {showSubDone ? (
                  <Button onClick={subDone}>{tc("done")}</Button>
                ) : (
                  footer
                )}
              </>
            ) : wide ? (
              <>
                <Button variant="neutralWeak" onClick={embedBack}>
                  {tc("cancel")}
                </Button>
                {footer}
              </>
            ) : (
              footer
            ),
          dirty: sub ? f.subDirty : f.dirty,
          onBack: embedBack,
          inSub: showSubDone,
          onDone: subDone,
          overlays: null,
          bodyRef,
        })}
        {overlays}
      </>
    );
  }

  return (
    <>
      <ResponsiveDialog
        open
        form
        // 단계 안에서는 ← 가 묻는다 — 시트 전체를 닫는 물음은 단계 밖에서만
        dirty={f.dirty && !sub}
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
            !wide && showSubDone
              ? "[&_[data-slot=bottom-sheet-close]]:hidden"
              : undefined
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
                  {t("addTx.saveFailed")}
                </Callout>
              </div>
            )}
            <div className="-mx-x6">{body}</div>
          </ResponsiveDialogBody>
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

      {overlays}
    </>
  );
}
