import { refetchMissingRefs } from "@/shared/api";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/shared/ds/avatar";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { useWideSurface } from "@/shared/ds/overlay";
import { Callout } from "@/shared/ds/callout";
import { ChipGroup, InputChip, chipVariants } from "@/shared/ds/chip";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import {
  List,
  ListButtonItem,
  ListCheckItem,
  ListHeader,
  ListItem,
  ListTile,
} from "@/shared/ds/list";
import { RadioSelectBox, RadioSelectBoxGroup } from "@/shared/ds/select-box";
import { Skeleton } from "@/shared/ds/skeleton";
import { Textarea } from "@/shared/ds/textarea";
import { MAX_AMOUNT } from "@/shared/lib/groo/amount";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { KRW, isEn } from "@/shared/lib/groo/format";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { kindOfExpense } from "@/shared/lib/groo/hide-amounts-cards";
import { cn } from "@/shared/lib/cn";
import { todayLocalKey } from "@/shared/lib/date";
import { Icon } from "@/shared/ui/groo/primitives";
import { Won } from "@/shared/ui/groo/won-text";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { useCreateDutchPay } from "@/features/dutch-pay";
import { useExpenseCategories } from "@/features/expense";
import { useCurrentUser } from "@/features/user";
import {
  PARTICIPANT_NAME_MAX,
  computeShares,
  type DutchPayFormValues,
  type ParticipantFormValues,
  type SplitMethod,
} from "@/entities/dutch-pay";
import type { Expense } from "@/entities/expense";
import type { TxEmbedParts } from "@/widgets/add-tx";
import { dateTimeLabel } from "@/widgets/expense-detail/lib/detail-format";

const MEMO_MAX = 500;
const NUM_RE = /[^0-9.]/g;

interface Person {
  uid: string;
  name: string;
  /** 비율 방식의 몫 수 */
  ratio: string;
  /** 개별 금액 방식의 금액 */
  custom: string;
}

let seq = 0;
const newUid = () => `p${(seq += 1)}`;

const METHODS: { v: SplitMethod; title: string; sub: string }[] = [
  {
    v: "EQUAL",
    title: "fromTx.split.equal.title",
    sub: "fromTx.split.equal.sub",
  },
  {
    v: "RATIO",
    title: "fromTx.split.ratio.title",
    sub: "fromTx.split.ratio.sub",
  },
  {
    v: "CUSTOM",
    title: "fromTx.split.custom.title",
    sub: "fromTx.split.custom.sub",
  },
];

export interface DutchStepOptions {
  enabled: boolean;
  expense: Expense;
  /** 정산을 만들었다 — 호스트가 상세로 돌아간다 */
  onCreated: () => void;
  /** 이 단계를 나간다(바뀐 값은 호스트가 먼저 물었다) */
  onExit: () => void;
}

/**
 * 더치페이로 나누기 단계 (I-21 G 39 ~ 42) — 원 거래 줄 · 나 포함 체크 줄 · 참여자 칩 · 나누는 법 Select Box 셋 · 몫 · 메모 › · 바닥 위 1인당.
 * 몫 셈은 `computeShares` 한 곳 — 남는 원은 결제자(나)에게 간다.
 */
export function useDutchStep(o: DutchStepOptions): TxEmbedParts {
  const { t } = useTranslation("dutchPay");
  const { t: te } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const { expense } = o;
  const total = Math.abs(expense.amount);
  const kind = kindOfExpense(expense.expenseType);
  const expenseDay =
    (expense.expenseDate ?? "").slice(0, 10) || todayLocalKey();
  const createMut = useCreateDutchPay({ silent: true });
  const categoriesQ = useExpenseCategories({ silent: true });
  const userQ = useCurrentUser();

  const category = (categoriesQ.data ?? []).find(
    (c) => c.rowId === expense.categoryRowId,
  );
  const meName = userQ.data?.userName ?? t("fromTx.me");
  const title = expense.merchant || expense.description || t("title");

  const [method, setMethod] = useState<SplitMethod>("EQUAL");
  const [includeMe, setIncludeMe] = useState(true);
  const [meRatio, setMeRatio] = useState("1");
  const [others, setOthers] = useState<Person[]>([]);
  const [memo, setMemo] = useState("");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // 카테고리 목록을 저장 때 다시 받다 또 실패했다 — 요청은 보내지 않고 폼 Callout 으로 알린다
  const [refFailed, setRefFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memoStep, setMemoStep] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const savingRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // 닫히면 처음 값으로 — 다시 열 때 지난 입력이 남지 않게(렌더 중 한 번만 맞춘다)
  const [wasOpen, setWasOpen] = useState(o.enabled);
  if (wasOpen !== o.enabled) {
    setWasOpen(o.enabled);
    if (!o.enabled) {
      setMethod("EQUAL");
      setIncludeMe(true);
      setMeRatio("1");
      setOthers([]);
      setMemo("");
      setName("");
      setNameError(null);
      setShowErrors(false);
      setSaveFailed(false);
      setMemoStep(false);
    }
  }

  const people = useMemo(
    () => [
      ...(includeMe
        ? [{ uid: "me", name: meName, ratio: meRatio, custom: "" }]
        : []),
      ...others,
    ],
    [includeMe, meName, meRatio, others],
  );
  const shares = computeShares(
    method,
    total,
    people.map((p) => ({
      isPayer: p.uid === "me",
      ratio: Number(p.ratio) || 0,
      custom: Number(p.custom) || 0,
    })),
    includeMe,
  );
  const ratioBad =
    method === "RATIO" && people.some((p) => !(Number(p.ratio) > 0));
  // 개별 금액 — 다른 사람 칸이 비면 0원으로 나간다(서버가 결제자 아닌 0원을 거절)
  const customBad =
    method === "CUSTOM" && others.some((p) => !(Number(p.custom) > 0));
  // 나 칩 · 줄은 "나" 로 쓴다(앱과 같게) — 저장 본문의 이름은 내 이름 그대로
  const shown = (p: Person) => (p.uid === "me" ? t("fromTx.me") : p.name);
  const fmt = (n: number) => `${wonPre()}${KRW(n)}${isEn() ? "" : "원"}`;

  const addPerson = () => {
    const n = name.trim();
    if (!n) {
      setNameError(t("fromTx.nameRequired"));
      return;
    }
    // 같은 이름 · 내 이름과 같은 참여자는 막는다(서버는 이름을 소문자로 비교해 거절한다)
    const key = n.toLowerCase();
    if (
      key === meName.trim().toLowerCase() ||
      others.some((x) => x.name.trim().toLowerCase() === key)
    ) {
      setNameError(t("fromTx.nameDuplicate"));
      return;
    }
    setNameError(null);
    setOthers([...others, { uid: newUid(), name: n, ratio: "1", custom: "" }]);
    setName("");
  };
  const patch = (uid: string, p: Partial<Person>) =>
    setOthers(others.map((x) => (x.uid === uid ? { ...x, ...p } : x)));

  const noPeople = people.length === 0;
  const gapText =
    method === "CUSTOM" && shares.gap !== 0
      ? t(shares.gap > 0 ? "fromTx.shortfallLine" : "fromTx.excessLine", {
          amount: fmt(Math.abs(shares.gap)),
        })
      : null;

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      setShowErrors(true);
      if (noPeople || gapText || ratioBad || customBad) return;
      setRefFailed(false);
      // 결제자(나)의 user id · 이름은 서버로 가는 값이다 — "나" 폴백은 화면 표시에만 쓰고 저장에는 쓰지 않는다.
      // 현재 사용자를 못 받았으면 저장 때 다시 받고, 또 실패하면 요청 없이 폼 Callout 으로 알린다
      let me = userQ.data;
      let ok = await refetchMissingRefs([categoriesQ]);
      if (ok && !me) {
        const r = await userQ.refetch();
        me = r.data;
        ok = !r.isError && !!me;
      }
      if (!ok || !me) {
        setRefFailed(true);
        bodyRef.current?.scrollTo({ top: 0 });
        return;
      }
      const savedMeRowId = me.rowId;
      const savedMeName = me.userName;
      const participants: ParticipantFormValues[] = people.map((p, i) => ({
        userRowId: p.uid === "me" ? savedMeRowId : null,
        participantName: p.uid === "me" ? savedMeName : p.name.trim(),
        amount: shares.amounts[i] ?? 0,
        isPayer: p.uid === "me",
      }));
      // 나 포함을 끄면 나는 목록에 없지만 결제자로 싣는다 — 남는 원이 내 몫이다(서버는 결제자의 0 · 양수 모두 받는다)
      if (!includeMe)
        participants.unshift({
          userRowId: savedMeRowId,
          participantName: savedMeName,
          amount: shares.mine,
          isPayer: true,
        });
      const data: DutchPayFormValues = {
        sourceExpenseRowId: expense.rowId,
        title,
        description: memo.trim() || undefined,
        totalAmount: total,
        currency: "KRW",
        splitMethod: method,
        dutchPayDate: expenseDay,
        participants,
      };
      setSaveFailed(false);
      try {
        await createMut.mutateAsync(data);
      } catch {
        setSaveFailed(true);
        bodyRef.current?.scrollTo({ top: 0 });
        return;
      }
      o.onCreated();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const formDirty =
    method !== "EQUAL" ||
    !includeMe ||
    meRatio !== "1" ||
    others.length > 0 ||
    memo !== "" ||
    name !== "";
  const dirty = memoStep ? memoDraft !== memo : formDirty;
  // 닫기(X)는 안쪽(메모) 단계에서도 흐름 전체의 변경을 본다
  const dirtyAll = formDirty || (memoStep && memoDraft !== memo);

  const pal = getPaletteByColor(category?.color ?? expense.categoryColor);
  const loading = categoriesQ.isPending || userQ.isPending;

  let body: ReactNode;
  if (memoStep) {
    body = (
      <Field
        label={te("memo")}
        maxGraphemeCount={MEMO_MAX}
        className="px-global-gutter pb-x2 pt-x1 [&_label]:sr-only"
      >
        <Textarea
          autoFocus
          rows={3}
          value={memoDraft}
          placeholder={t("fromTx.memoPlaceholder")}
          onChange={(e) => setMemoDraft(e.target.value)}
        />
      </Field>
    );
  } else if (loading) {
    body = (
      <div aria-hidden className="flex flex-col gap-x4 px-global-gutter py-x2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} text="t5" className="w-2/3" />
        ))}
      </div>
    );
  } else {
    body = (
      <>
        {(saveFailed || refFailed) && (
          <div className="px-global-gutter pb-x3 pt-x1">
            <Callout tone="critical" role="alert">
              {saveFailed
                ? t("fromTx.saveFailed")
                : tc("query.referenceSaveFailed")}
            </Callout>
          </div>
        )}
        <List data-slot="dutch-source">
          <ListItem
            prefix={
              <ListTile
                aria-hidden
                style={{ background: pal.bg, color: pal.color }}
              >
                <Icon
                  name={category?.icon ?? expense.categoryIcon ?? "tag"}
                  size={20}
                />
              </ListTile>
            }
            title={title}
            detail={dateTimeLabel(expense.expenseDate)}
            suffix={
              <span className="whitespace-nowrap font-bold tabular-nums text-fg-neutral">
                <Won n={total} kind={kind} />
              </span>
            }
          />
          <ListCheckItem
            data-testid="dutch-include-me"
            title={t("fromTx.includeMe")}
            detail={
              includeMe
                ? t("fromTx.includeMeHint")
                : t("fromTx.includeMeHintOff")
            }
            checked={includeMe}
            onCheckedChange={(v) => setIncludeMe(v === true)}
          />
        </List>

        <div className="px-global-gutter pb-x3 pt-x3">
          <p
            id="dutch-people-label"
            className="m-0 pb-x2 font-sans text-t4 font-medium text-fg-neutral"
          >
            {t("fromTx.peopleLabel", { count: people.length })}
          </p>
          <ChipGroup aria-labelledby="dutch-people-label" className="pb-x2">
            {people.map((p) =>
              p.uid === "me" ? (
                <span
                  key="me"
                  data-testid="dutch-me-chip"
                  className={cn(
                    chipVariants({ variant: "outlineWeak", size: "medium" }),
                    "pointer-events-none gap-x1_5",
                  )}
                >
                  <Avatar name={shown(p)} size={24} />
                  {shown(p)}
                </span>
              ) : (
                <InputChip
                  key={p.uid}
                  prefixIcon={<Avatar name={p.name} size={24} />}
                  removeLabel={t("fromTx.removePerson", { name: p.name })}
                  onRemove={() =>
                    setOthers(others.filter((x) => x.uid !== p.uid))
                  }
                >
                  {p.name}
                </InputChip>
              ),
            )}
          </ChipGroup>
          <div className="flex items-start gap-x2">
            <div className="min-w-0 flex-1">
              <Input
                size="large"
                aria-label={t("fromTx.addNameLabel")}
                aria-invalid={nameError != null ? true : undefined}
                maxLength={PARTICIPANT_NAME_MAX}
                value={name}
                placeholder={t("fromTx.addNamePlaceholder")}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPerson();
                  }
                }}
              />
            </div>
            <Button size="large" variant="neutralWeak" onClick={addPerson}>
              {t("fromTx.add")}
            </Button>
          </div>
          {nameError != null && (
            <p
              role="alert"
              className="m-0 pt-x1 font-sans text-t3 text-fg-critical"
            >
              {nameError}
            </p>
          )}
          {showErrors && noPeople && (
            <p
              role="alert"
              className="m-0 pt-x1 font-sans text-t3 text-fg-critical"
            >
              {t("fromTx.peopleRequired")}
            </p>
          )}
        </div>

        <ListHeader variant="mediumWeak" as="h3" className="mt-x1">
          {t("fromTx.splitSection")}
        </ListHeader>
        <div className="px-global-gutter pb-x3">
          <RadioSelectBoxGroup
            aria-label={t("fromTx.splitSection")}
            columns={3}
            className="max-[559px]:grid-cols-1"
            value={method}
            onValueChange={(v) => setMethod(v as SplitMethod)}
          >
            {METHODS.map((m) => (
              <RadioSelectBox
                key={m.v}
                value={m.v}
                label={t(m.title)}
                description={t(m.sub)}
              />
            ))}
          </RadioSelectBoxGroup>
        </div>

        {people.length > 0 && (
          <>
            <ListHeader as="div" variant="boldSolid" className="mt-x1">
              <h3 className="m-0 font-[inherit] text-[length:inherit] [font-weight:inherit]">
                {t("fromTx.sharesTitle")}
              </h3>
              <span className="tabular-nums">
                {t("fromTx.sharesTotal", { amount: fmt(total) })}
              </span>
            </ListHeader>
            <List data-slot="dutch-shares">
              {people.map((p, i) => {
                const isMe = p.uid === "me";
                const amt = shares.amounts[i] ?? 0;
                const restNote =
                  method === "EQUAL" && isMe
                    ? total - shares.perPerson * people.length
                    : 0;
                const invalidRatio =
                  method === "RATIO" && !(Number(p.ratio) > 0);
                return (
                  <ListItem
                    key={p.uid}
                    prefix={<Avatar name={shown(p)} size={42} />}
                    title={
                      <span className="[overflow-wrap:anywhere] [word-break:break-all]">
                        {shown(p)}
                        {isMe && (
                          <>
                            {" "}
                            <Badge variant="weak" tone="neutral" size="large">
                              {t("fromTx.payerBadge")}
                            </Badge>
                          </>
                        )}
                      </span>
                    }
                    detail={
                      method === "RATIO" ? (
                        <Won n={amt} kind={kind} />
                      ) : restNote > 0 ? (
                        t("fromTx.restIncluded", { amount: fmt(restNote) })
                      ) : undefined
                    }
                    suffix={
                      method === "EQUAL" || (method === "CUSTOM" && isMe) ? (
                        <span className="whitespace-nowrap font-bold tabular-nums text-fg-neutral">
                          <Won n={amt} kind={kind} />
                        </span>
                      ) : method === "RATIO" ? (
                        <Input
                          size="large"
                          rootClassName="w-24"
                          className="text-right"
                          inputMode="decimal"
                          aria-label={t("fromTx.ratioLabel", {
                            name: shown(p),
                          })}
                          aria-invalid={
                            showErrors && invalidRatio ? true : undefined
                          }
                          suffix={t("fromTx.ratioUnit")}
                          value={p.ratio}
                          onChange={(e) => {
                            const v = e.target.value.replace(NUM_RE, "");
                            if (isMe) setMeRatio(v);
                            else patch(p.uid, { ratio: v });
                          }}
                        />
                      ) : (
                        <AmountInput
                          size="large"
                          rootClassName="w-32"
                          className="text-right"
                          aria-label={t("fromTx.customLabel", {
                            name: shown(p),
                          })}
                          unit={isEn() ? undefined : "원"}
                          value={p.custom}
                          max={MAX_AMOUNT}
                          onValueChange={(v) => patch(p.uid, { custom: v })}
                        />
                      )
                    }
                  />
                );
              })}
            </List>
          </>
        )}

        <List data-slot="dutch-memo">
          <ListButtonItem
            data-testid="dutch-memo-row"
            prefix={
              <span aria-hidden className="text-fg-neutral [&>svg]:size-[22px]">
                <StickyNote />
              </span>
            }
            title={te("memo")}
            suffix={
              <>
                <span
                  className={cn(
                    "block max-w-[12rem] truncate text-end",
                    memo ? "text-fg-neutral" : "text-fg-neutral-subtle",
                  )}
                >
                  {memo || t("fromTx.memoNone")}
                </span>
                <ChevronRight
                  aria-hidden
                  size={18}
                  className="text-fg-neutral-subtle"
                />
              </>
            }
            suffixText
            onClick={() => {
              setMemoDraft(memo);
              setMemoStep(true);
            }}
          />
        </List>
      </>
    );
  }

  const perLine =
    method === "EQUAL"
      ? includeMe || shares.mine === 0
        ? t("fromTx.perPersonLine", { amount: fmt(shares.perPerson) })
        : t("fromTx.perPersonLineMine", {
            amount: fmt(shares.perPerson),
            rest: fmt(shares.mine),
          })
      : null;
  const above =
    !memoStep && !loading && (perLine || gapText || ratioBad || customBad) ? (
      <div data-slot="dutch-sum" className="px-global-gutter pb-x2 pt-x2">
        {perLine && !noPeople && (
          <p className="m-0 flex items-center justify-between font-sans text-t4">
            <span className="text-fg-neutral-muted">
              {t("fromTx.perPerson")}
            </span>
            <span className="font-bold tabular-nums text-fg-neutral">
              {perLine}
            </span>
          </p>
        )}
        {showErrors && gapText && (
          <p role="alert" className="m-0 font-sans text-t3 text-fg-critical">
            {gapText}
          </p>
        )}
        {showErrors && customBad && (
          <p role="alert" className="m-0 font-sans text-t3 text-fg-critical">
            {t("fromTx.customRequired")}
          </p>
        )}
        {showErrors && ratioBad && (
          <p role="alert" className="m-0 font-sans text-t3 text-fg-critical">
            {t("fromTx.ratioInvalid")}
          </p>
        )}
      </div>
    ) : null;

  const commitMemo = () => {
    setMemo(memoDraft.trim() ? memoDraft : "");
    setMemoStep(false);
  };

  const primary = memoStep ? null : (
    <Button variant="neutralSolid" loading={saving} onClick={() => void save()}>
      {t("fromTx.createSettlement")}
    </Button>
  );

  return {
    title: memoStep ? te("memo") : t("fromTx.title"),
    body,
    primary,
    footer: (requestBack) =>
      wide ? (
        <>
          <Button variant="neutralWeak" onClick={requestBack}>
            {tc("cancel")}
          </Button>
          {memoStep ? (
            <Button onClick={commitMemo}>{tc("done")}</Button>
          ) : (
            primary
          )}
        </>
      ) : (
        primary
      ),
    above,
    dirty,
    dirtyAll,
    onBack: () => {
      if (saving) return;
      if (memoStep) setMemoStep(false);
      else o.onExit();
    },
    inSub: memoStep,
    onDone: commitMemo,
    busy: saving,
    overlays: null,
    bodyRef,
  };
}
