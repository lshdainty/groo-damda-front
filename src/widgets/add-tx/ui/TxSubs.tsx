import { useState } from "react";
import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MAX_AMOUNT } from "@/shared/lib/groo/amount";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { Callout } from "@/shared/ds/callout";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { List, ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { Textarea } from "@/shared/ds/textarea";
import { Icon } from "@/shared/ui/groo/primitives";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { money } from "@/shared/lib/groo/format";
import { looksLikePaymentSms, parseSms } from "@/features/sms";
import { transferPartiesLabel } from "@/features/asset-transfer";
import { ArrowRightLeft } from "lucide-react";
import type { TxForm } from "../model/use-tx-form";
import { AmountEntry } from "./AmountEntry";
import { RowError, RowValue, StepRow } from "./tx-parts";

const MEMO_MAX = 500;
const PRESET_NAME_MAX = 12;

/** 금액 단계 (D 25) — 밑줄 금액 칸 + 끝 통화 칩. "완료" 에 넣고 ← 는 버린다 */
export function AmountSub({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const err = f.errors.tooLarge
    ? t("addTx.amountTooLarge")
    : f.showErrors && f.errors.entry
      ? t("addTx.entryRequired")
      : undefined;
  return (
    <Field
      label={t("form.amount")}
      invalid={!!err}
      errorMessage={err}
      className="px-global-gutter pb-x2 pt-x3 [&_label]:sr-only"
    >
      <AmountEntry
        f={f}
        label={t("form.amount")}
        autoFocus
        onEnter={() => f.setSub(null)}
      />
    </Field>
  );
}

/** 원화 금액 단계(D 22) — 외화 거래의 카드사 청구액으로 원화만 고친다. 현지 금액 · 환율은 그대로(통화 칩 없음) */
export function KrwAmountSub({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const err = f.errors.tooLarge ? t("addTx.amountTooLarge") : undefined;
  return (
    <Field
      label={t("addTx.krwAmount")}
      invalid={!!err}
      errorMessage={err}
      className="px-global-gutter pb-x2 pt-x3 [&_label]:sr-only"
    >
      <AmountInput
        variant="underline"
        aria-label={t("addTx.krwAmount")}
        autoFocus
        value={f.amount}
        max={MAX_AMOUNT}
        onValueChange={f.setAmount}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            f.setSub(null);
          }
        }}
      />
    </Field>
  );
}

/** 메모 단계 — Textarea 최대 500 */
export function MemoSub({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  return (
    <Field
      label={t("addTx.memo")}
      maxGraphemeCount={MEMO_MAX}
      className="px-global-gutter pb-x2 pt-x1 [&_label]:sr-only"
    >
      <Textarea
        autoFocus
        rows={3}
        value={f.description}
        placeholder={t("addTx.optional")}
        onChange={(e) => f.setDescription(e.target.value)}
      />
    </Field>
  );
}

/** 수수료 · 이자 단계 — 밑줄 금액 칸 하나(이자는 칸 아래 안내) */
export function FeeSub({ f, kind }: { f: TxForm; kind: "fee" | "interest" }) {
  const { t } = useTranslation("expense");
  const label = kind === "fee" ? t("addTx.fee") : t("addTx.interest");
  const value = kind === "fee" ? f.fee : f.interest;
  const set = kind === "fee" ? f.setFee : f.setInterest;
  return (
    <Field
      label={label}
      description={kind === "interest" ? t("addTx.interestHint") : undefined}
      className="px-global-gutter pb-x2 pt-x3 [&_label]:sr-only"
    >
      <AmountInput
        variant="underline"
        aria-label={label}
        autoFocus
        value={value}
        max={MAX_AMOUNT}
        onValueChange={set}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            f.setSub(null);
          }
        }}
      />
    </Field>
  );
}

/**
 * 결제 문자 단계 (D 23) — 붙여넣고 [문자 읽기]. 실패는 칸 아래 글(서버 원문 없음).
 * 성공이면 칸을 채우고 2단계로 간다. 금액을 못 읽은 문자는 서버가 "인식 못 함" 으로 돌려 단계에 남는다.
 */
export function SmsSub({
  f,
  runRef,
}: {
  f: TxForm;
  /** 바닥 버튼이 부르는 읽기 */
  runRef: React.RefObject<(() => void) | null>;
}) {
  const { t } = useTranslation("expense");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    const value = text.trim();
    if (loading) return;
    if (!value || !looksLikePaymentSms(value)) {
      setNotice(t("sms.notRecognized"));
      return;
    }
    setLoading(true);
    f.setSmsLoading(true);
    setNotice(null);
    try {
      const parsed = await parseSms(value, { silent: true });
      if (!parsed.matched) {
        setNotice(t("sms.notRecognized"));
        return;
      }
      // 취소 문자는 원 거래를 특정할 수 없어 자동 기록하지 않는다 — 결제와 취소가 둘 다 지출로 쌓여 두 배가 된다
      if (parsed.cancel) {
        setNotice(t("sms.cancelNotice"));
        return;
      }
      f.applySms(value, parsed);
      f.finishSms();
    } catch {
      // 통신 실패는 서버 원문 대신 고정 글
      setNotice(t("sms.parseFailed"));
    } finally {
      setLoading(false);
      f.setSmsLoading(false);
    }
  };
  runRef.current = () => void run();
  return (
    <Field
      label={t("sms.label")}
      invalid={!!notice}
      errorMessage={notice ?? undefined}
      description={t("sms.help")}
      className="px-global-gutter pb-x2 pt-x1"
    >
      <Textarea
        autoFocus
        rows={4}
        value={text}
        placeholder={t("sms.pastePlaceholder")}
        onChange={(e) => {
          setText(e.target.value);
          setNotice(null);
        }}
      />
    </Field>
  );
}

/** "모두 보기" — 지금 종류의 프리셋 전부. 고르면 칩과 같은 길(금액이 있으면 2단계, 비었으면 1단계) */
export function PresetAllSub({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const all = f.templates
    .filter((p) => p.expenseType === f.type)
    .sort((a, b) => b.useCount - a.useCount);
  return (
    <>
      <List aria-label={t("addTx.presetAllTitle")}>
        {all.map((p) => {
          const cat = f.categories.find((c) => c.rowId === p.categoryRowId);
          const palette = getPaletteByColor(cat?.color ?? null);
          return (
            <ListButtonItem
              key={p.rowId}
              title={p.templateName}
              prefix={
                p.expenseType === "TRANSFER" ? (
                  <ListTile>
                    <ArrowRightLeft aria-hidden className="size-5" />
                  </ListTile>
                ) : (
                  <ListTile
                    style={{ background: palette.bg, color: palette.color }}
                  >
                    <Icon name={cat?.icon ?? "tag"} size={20} />
                  </ListTile>
                )
              }
              suffix={
                p.lockAmount === "Y" && p.amount != null ? (
                  <RowValue>{money(p.amount)}</RowValue>
                ) : undefined
              }
              suffixText
              onClick={() => {
                f.setSub(null);
                f.togglePreset(p);
              }}
            />
          );
        })}
      </List>
    </>
  );
}

/** 프리셋 저장 단계 (E 32) — 요약 줄 · 이름 · 금액 줄 하나(Q6 B). 금액 0 은 "비워 둠" 으로 저장된다 */
export function PresetSaveSub({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const isTransfer = f.type === "TRANSFER";
  const cat = f.selectedCategory;
  const palette = getPaletteByColor(cat?.color ?? null);
  const fromName =
    f.assets.find((a) => a.rowId === f.fromAssetRowId)?.assetName ?? null;
  const toName =
    f.assets.find((a) => a.rowId === f.toAssetRowId)?.assetName ?? null;
  const assetName =
    f.assets.find((a) => a.rowId === f.assetRowId)?.assetName ?? null;
  const catParent =
    cat?.parentRowId != null
      ? f.categories.find((c) => c.rowId === cat.parentRowId)
      : null;
  const catLabel = cat
    ? catParent
      ? `${catParent.categoryName} · ${cat.categoryName}`
      : cat.categoryName
    : t("savePreset.noCategory");
  const presetAmountNum = Number(f.presetAmount) || 0;
  const issue =
    f.presetShow && f.presetNameIssue
      ? f.presetNameIssue === "required"
        ? t("savePreset.nameRequired")
        : t("savePreset.nameDuplicate")
      : null;
  const needs =
    f.presetShow && f.presetNeeds
      ? f.presetNeeds === "category"
        ? t("savePreset.needCategory")
        : t("savePreset.needParties")
      : null;
  return (
    <>
      {f.presetFailed && (
        <div className="px-global-gutter pb-x5">
          <Callout tone="critical" role="alert">
            {t("addTx.saveFailed")}
          </Callout>
        </div>
      )}
      <List>
        <ListItem
          title={
            isTransfer
              ? t("addTx.transfer")
              : f.merchant || t("savePreset.noMerchant")
          }
          detail={
            isTransfer
              ? transferPartiesLabel(fromName, toName)
              : `${catLabel}${assetName ? ` · ${assetName}` : ""}`
          }
          prefix={
            isTransfer ? (
              <ListTile>
                <ArrowRightLeft aria-hidden className="size-5" />
              </ListTile>
            ) : (
              <ListTile
                style={{ background: palette.bg, color: palette.color }}
              >
                <Icon name={cat?.icon ?? "tag"} size={20} />
              </ListTile>
            )
          }
          suffix={<RowValue>{money(f.amountNumber)}</RowValue>}
        />
      </List>
      {needs && <RowError>{needs}</RowError>}
      <Field
        label={t("savePreset.name")}
        invalid={!!issue}
        errorMessage={issue ?? undefined}
        maxGraphemeCount={PRESET_NAME_MAX}
        className="px-global-gutter pb-x2 pt-x3"
      >
        <Input
          autoFocus
          value={f.presetName}
          placeholder={t("savePreset.namePlaceholder")}
          onChange={(e) => f.setPresetName(e.target.value)}
        />
      </Field>
      <StepRow
        title={t("savePreset.amountRow")}
        prefix={<Coins />}
        value={
          presetAmountNum > 0
            ? money(presetAmountNum)
            : t("savePreset.amountEmpty")
        }
        empty={presetAmountNum <= 0}
        onClick={() => f.setSub("presetAmount")}
      />
    </>
  );
}

/** 프리셋 금액 단계 — 비워 두면 불러올 때 금액을 직접 넣는다 */
export function PresetAmountSub({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  return (
    <Field
      label={t("savePreset.amountRow")}
      description={t("savePreset.amountHint")}
      className="px-global-gutter pb-x2 pt-x3 [&_label]:sr-only"
    >
      <AmountInput
        variant="underline"
        aria-label={t("savePreset.amountRow")}
        autoFocus
        value={f.presetAmount}
        max={MAX_AMOUNT}
        onValueChange={f.setPresetAmount}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            f.setSub("presetSave");
          }
        }}
      />
    </Field>
  );
}
