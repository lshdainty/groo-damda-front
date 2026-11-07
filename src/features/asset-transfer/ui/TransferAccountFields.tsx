import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { KRW } from "@/shared/lib/groo/format";
import { blockNonDigitKey } from "@/shared/lib/groo/amount";
import { useAmountLimit } from "@/shared/lib/groo/use-amount-limit";
import { AmountLimitError } from "@/shared/ui/groo/amount-limit-error";
import type { Asset } from "@/entities/asset";
import { transferEligible, isLoanTarget } from "../model/rules";

interface Props {
  assets: Asset[];
  fromAssetRowId: number | null;
  toAssetRowId: number | null;
  /** 문자열 그대로 — 입력 중 '0' 과 빈칸을 구분해야 해서 숫자로 접지 않는다. */
  fee: string;
  interest: string;
  /** 이자 안내에서 원금을 쪼개 보여 줄 때 쓴다. 0 이면 안내만 뜬다. */
  amountNumber: number;
  onFromChange: (rowId: number | null) => void;
  onToChange: (rowId: number | null) => void;
  onFeeChange: (value: string) => void;
  onInterestChange: (value: string) => void;
  /**
   * 이자 칸을 쓸 수 있는 화면인가 — **기본은 켜짐**.
   *
   * 이자는 받는 자산이 대출일 때만 뜨는데, 그 위에 화면마다 다른 조건이 하나 더 붙는
   * 자리가 있다. 프리셋 폼은 <b>금액을 고정했을 때만</b> 이자를 받는다(금액이 매달
   * 다르면 이자도 매달 달라서, 박아 둔 이자는 불러올 때마다 틀린 값이 된다).
   *
   * 그 조건을 여기 넣으면 안 된다 — 거래 시트와 반복 설정에는 "금액 고정" 이라는 게
   * 없어서 이자 칸이 통째로 사라진다. 대출 상환 이체에 이자를 못 적으면 이자 지출이
   * 안 생기고 원금이 과다 상환된 것으로 기록된다. 그래서 **조건은 호스트가 정한다.**
   */
  interestEnabled?: boolean;
}

/**
 * 이체의 계좌·수수료·이자 칸 — **거래 시트 · 반복 설정 · 프리셋**이 같이 쓴다.
 *
 * 세 자리가 같은 화면을 따로 그리면 "어떤 계좌를 고를 수 있나 · 이자 칸이 언제 뜨나" 가
 * 갈린다. 실제로 갈리면 사용자는 시트에서 만든 이체를 반복으로는 못 만들거나, 반복으로
 * 저장해 둔 규칙이 자정에만 거절당한다. 규칙은 {@link transferEligible} ·
 * {@link isLoanTarget} 한 벌이고 서버도 같은 것을 본다.
 *
 * 상태는 부르는 쪽이 들고 있는다 — 시트는 거래를, 반복은 규칙을, 프리셋은 양식을 저장해
 * 제출 모양이 서로 다르기 때문이다. 여기서 공통인 것은 **무엇을 보여 주고 무엇을 막느냐**뿐이다.
 */
export function TransferAccountFields({
  assets,
  fromAssetRowId,
  toAssetRowId,
  fee,
  interest,
  amountNumber,
  onFromChange,
  onToChange,
  onFeeChange,
  onInterestChange,
  interestEnabled = true,
}: Props) {
  const { t } = useTranslation("expense");
  const eligible = transferEligible(assets);
  const showInterest = interestEnabled && isLoanTarget(assets, toAssetRowId);

  const uid = useId();
  // 상한을 넘는 입력은 받지 않고 값은 그대로 — 칸 아래에 오류(다음 유효한 입력에서 사라진다)
  const feeLimit = useAmountLimit();
  const interestLimit = useAmountLimit();
  const label = (a: Asset) =>
    a.institution ? `${a.institution} · ${a.assetName}` : a.assetName;

  return (
    <>
      <Field style={{ marginBottom: 14 }}>
        <FieldLabel id={`${uid}from-label`}>
          {t("addTx.fromAccount")}
        </FieldLabel>
        <Select
          value={fromAssetRowId != null ? String(fromAssetRowId) : ""}
          onValueChange={(v) => onFromChange(v ? Number(v) : null)}
        >
          <SelectTrigger
            id={`${uid}from`}
            aria-labelledby={`${uid}from-label ${uid}from`}
          >
            <SelectValue placeholder={t("addTx.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((a) => (
              <SelectItem key={a.rowId} value={String(a.rowId)}>
                {label(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field style={{ marginBottom: 14 }}>
        <FieldLabel id={`${uid}to-label`}>{t("addTx.depositAccount")}</FieldLabel>
        <Select
          value={toAssetRowId != null ? String(toAssetRowId) : ""}
          onValueChange={(v) => onToChange(v ? Number(v) : null)}
        >
          <SelectTrigger
            id={`${uid}to`}
            aria-labelledby={`${uid}to-label ${uid}to`}
          >
            <SelectValue placeholder={t("addTx.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {eligible
              .filter((a) => a.rowId !== fromAssetRowId)
              .map((a) => (
                <SelectItem key={a.rowId} value={String(a.rowId)}>
                  {label(a)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>

      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("addTx.fee")}</FieldLabel>
        <Input
          className="num"
          value={fee}
          onChange={(e) => {
            const r = feeLimit.read(e.target.value, fee);
            if (r.accepted) onFeeChange(r.value);
          }}
          onKeyDown={blockNonDigitKey}
          placeholder="0"
          inputMode="numeric"
          aria-invalid={feeLimit.message ? true : undefined}
          aria-describedby={feeLimit.message ? `${uid}fee-error` : undefined}
        />
        <AmountLimitError id={`${uid}fee-error`} message={feeLimit.message} />
      </Field>

      {/* 이자 — 대출 상환에만. 상환액 중 이자는 부채를 줄이지 않고 지출로 잡힌다. */}
      {showInterest && (
        <Field style={{ marginBottom: 14 }}>
          <FieldLabel>{t("addTx.interest")}</FieldLabel>
          <Input
            className="num"
            value={interest}
            onChange={(e) => {
              const r = interestLimit.read(e.target.value, interest);
              if (r.accepted) onInterestChange(r.value);
            }}
            onKeyDown={blockNonDigitKey}
            placeholder="0"
            inputMode="numeric"
            aria-invalid={interestLimit.message ? true : undefined}
            aria-describedby={
              interestLimit.message ? `${uid}interest-error` : undefined
            }
          />
          <AmountLimitError
            id={`${uid}interest-error`}
            message={interestLimit.message}
          />
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              marginTop: 4,
            }}
          >
            {interest && amountNumber > 0
              ? t("addTx.interestSplit", {
                  principal: KRW(Math.max(0, amountNumber - Number(interest))),
                  interest: KRW(Number(interest)),
                })
              : t("addTx.interestHint")}
          </div>
        </Field>
      )}
    </>
  );
}
