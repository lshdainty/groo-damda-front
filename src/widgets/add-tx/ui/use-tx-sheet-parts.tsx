import { useEffect, useRef } from "react";

import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import { useSnackbar } from "@/shared/ds/snackbar";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { useStepBack } from "@/widgets/calendar/model/use-step-back";
import { type TxForm, type TxSub } from "../model/use-tx-form";
import { TxStep1 } from "./TxStep1";
import { TxStep2 } from "./TxStep2";
import { useSplitStep } from "./use-split-step";
import { amountText } from "../lib/amount-format";
import {
  AmountSub,
  FeeSub,
  KrwAmountSub,
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
  /**
   * 바닥 버튼들 — 시트는 large, 대화상자는 small([취소] 포함). 호스트가 `requestBack` 을 넘기면 [취소] 가 ← 와 같이
   * 바뀐 값을 먼저 묻는다(호스트가 묻는 일을 맡는다)
   */
  footer: (requestBack: () => void) => React.ReactNode;
  /** 지금 자리에서 ← 로 나가면 버려지는 값이 있다 — 호스트가 "작성한 내용이 사라져요" 를 먼저 묻는다 */
  dirty: boolean;
  /** 시트 전체를 닫을 때 물을 값 — 단계 안에서도 폼 전체의 바뀐 값을 본다(닫기 원 · 바깥) */
  dirtyAll: boolean;
  /** 한 단계 뒤 — 호스트의 ← · Esc · 기기 뒤로 가기가 부른다(묻는 일은 호스트) */
  onBack: () => void;
  /** 단계 안에 있다(값 하나를 치는 단계 등) — 시트 머리의 닫기 원 자리에 "완료" 를 둘지 호스트가 정한다 */
  inSub: boolean;
  onDone: () => void;
  /** 표면 밖에 그릴 것(저장 확인창 · 맞추기 대화상자) */
  overlays: React.ReactNode;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  /** 바닥 버튼 바로 위 한 줄(나누기 단계의 남은 금액) — 본문 밖, 바닥 위에 그린다 */
  above?: React.ReactNode;
  /** 저장 요청이 나가 있다 — 호스트가 시트를 닫지 못하게 한다 */
  busy?: boolean;
  /** 시트 바닥의 주 버튼 하나(나누기 단계) — 값 하나를 치는 안쪽 단계면 null */
  primary?: React.ReactNode;
}

/** 거래 폼 표면의 조각 — 자기 표면(`AddTxSheet`)과 호스트 시트(`TxEmbedParts` 로 끼움)가 같이 쓴다 */
export function useTxSheetParts(
  f: TxForm,
  o: {
    mobile: boolean;
    /** 호스트 표면에 끼운다 — 닫는 길(← · Esc · 기기 뒤로 가기)은 호스트가 맡는다 */
    embedded: boolean;
    onClose: () => void;
    /** 끼운 수정 폼의 ← — 상세로 */
    onBack?: () => void;
  },
) {
  const embedded = o.embedded;
  const { t, tc } = f;
  const wide = useWideSurface();
  const snackbar = useSnackbar();
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const smsRunRef = useRef<(() => void) | null>(null);
  const isNew = !f.isEdit && !f.isRewrite;
  const sub = f.sub;
  const twoOfTwo = isNew && f.main === "2" && !sub;

  // 나눈 내역 맞추기 — 같은 표면 한 단계(F 34). 폼은 서버에 보내지 않고 맞춘 분할만 돌려받는다
  const split = useSplitStep({
    enabled: f.openReconcile && f.seed != null,
    expense: f.seed,
    overrideTotal: f.amountNumber,
    recordedTotal: f.seed ? Math.abs(f.seed.amount) : undefined,
    initialSplits: f.effectiveSplits.length > 0 ? f.effectiveSplits : undefined,
    onReconciled: (splits) => {
      f.setReconciledSplits(splits);
      f.setOpenReconcile(false);
    },
    onExit: () => f.setOpenReconcile(false),
  });
  const inRecon = f.openReconcile && f.seed != null;

  // ← · 기기 뒤로 가기 — 단계 안에서는 들어올 때 값으로 되돌리고(바뀐 값이 있으면 먼저 묻는다), 새 거래 2단계는 1단계로
  const leave = useLeaveConfirm({
    dirty: inRecon ? split.dirty : f.subDirty,
    leave: () => (inRecon ? split.onBack() : f.leaveSub(true)),
    contentRef,
  });
  const back = (): boolean => {
    // 저장이 나가 있는 동안은 나가지 않는다 — 나가면 응답 뒤 콜백(onSaved · 알림)이 사라진다
    if (f.submitting) return false;
    if (inRecon) return leave.request();
    if (sub) return leave.request();
    if (twoOfTwo) {
      f.setMain("1");
      return true;
    }
    return true;
  };
  useStepBack(!embedded && !wide && (sub != null || twoOfTwo || inRecon), back);

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
    krwAmount: t("addTx.krwAmount"),
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
      <Button
        size={btnSize}
        loading={f.smsLoading}
        onClick={() => smsRunRef.current?.()}
      >
        {t("sms.pasteAction")}
      </Button>
    );
  } else if (sub === "presetSave") {
    footer = (
      <Button
        size={btnSize}
        loading={f.presetSaving}
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
  ) : sub === "krwAmount" ? (
    <KrwAmountSub f={f} />
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
    </>
  );

  const embedBack = () => {
    if (f.submitting) return;
    if (inRecon) split.onBack();
    else if (sub) f.leaveSub(true);
    else if (twoOfTwo) f.setMain("1");
    else o.onBack?.();
  };
  const formEmbedParts: TxEmbedParts = {
    title,
    body: (
      <>
        {f.saveFailed && !sub && f.main === "2" && (
          <div className="px-global-gutter pb-x5">
            <Callout tone="critical" role="alert">
              {t("addTx.saveFailed")}
            </Callout>
          </div>
        )}
        {body}
      </>
    ),
    footer: (requestBack) =>
      wide ? (
        <>
          <Button variant="neutralWeak" onClick={requestBack}>
            {tc("cancel")}
          </Button>
          {sub && showSubDone ? (
            <Button onClick={subDone}>{tc("done")}</Button>
          ) : (
            footer
          )}
        </>
      ) : (
        footer
      ),
    dirty: sub ? f.subDirty : f.dirty,
    dirtyAll: f.dirty || f.subDirty,
    onBack: embedBack,
    inSub: showSubDone,
    onDone: subDone,
    overlays: null,
    bodyRef,
  };
  // 맞추기 단계가 열려 있으면 폼 조각 대신 그 단계의 조각 — 폼의 바뀐 값은 닫을 때 함께 묻는다
  const embedParts: TxEmbedParts = inRecon
    ? {
        ...split,
        dirtyAll: split.dirty || f.dirty || f.subDirty,
        onBack: embedBack,
        bodyRef: split.bodyRef,
      }
    : formEmbedParts;
  return {
    embedParts,
    overlays,
    title: inRecon ? split.title : title,
    body: inRecon ? split.body : body,
    footer: inRecon ? (split.primary ?? null) : footer,
    above: inRecon ? split.above : null,
    wide,
    isNew,
    sub: inRecon ? ("reconcile" as const) : sub,
    twoOfTwo,
    showSubDone: inRecon ? split.inSub : showSubDone,
    subDone: inRecon ? split.onDone : subDone,
    back,
    leave,
    contentRef,
    bodyRef,
  };
}
