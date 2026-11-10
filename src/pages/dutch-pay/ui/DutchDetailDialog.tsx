import { useId, useState } from "react";
import { EllipsisVertical, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/shared/ds/avatar";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { List, ListHeader, ListItem } from "@/shared/ds/list";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { useWideSurface } from "@/shared/ds/overlay";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import type { DutchPay } from "@/entities/dutch-pay";
import {
  dutchDateDow,
  isActiveSession,
  isPayer,
  perPersonOfSession,
} from "../model/dutch-model";
import { wonText } from "../model/dutch-format";
import { MaskedText, PerPersonText, Won } from "./dutch-parts";

/**
 * 정산 상세(I-15 38 · 39, 7-2B) — 읽기 시트 · 1280 이상 Dialog 480. 머리 제목 = 정산 이름. 본문: "{날짜 (요일)} · {장소}" → 총액(t9 700) →
 * "1인당 … · {n}명" → 선 → "참여자 · {n}" 머리 + 참여자 줄(ds List · 아바타 36). 줄 끝: 결제자 Badge "결제자"(설명 "결제했어요", 몫이 다르면
 * "· 몫 …") · 낸 사람 Badge "냈어요" · 안 낸 사람 [받음]. 바닥: 진행 중 왼쪽 [삭제] + [모두 받음](주 동작 하나), 완료 [삭제]. 동작이 여럿이면 머리 ⋮(bottom-sheet 규칙) —
 [일괄 요청] 은 서버 API 가 없어 막힌 줄로만 ⋮ 에 둔다(진행 중일 때만).
 * 삭제는 공용 ConfirmDialog 를 상세 위에 — 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도](바로 재요청). 받음 · 모두 받음 실패도 같은 띠.
 */
export function DutchDetailDialog({
  d,
  onClose,
  markPaid,
  settleAll,
  remove,
}: {
  d: DutchPay;
  onClose: () => void;
  markPaid: (participantId: number) => Promise<unknown>;
  settleAll: () => Promise<unknown>;
  remove: () => Promise<unknown>;
}) {
  const { t } = useTranslation("dutchPay");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const confirmFail = useConfirmFail();
  const [askDelete, setAskDelete] = useState(false);
  const [running, setRunning] = useState(false);
  const active = isActiveSession(d);
  const place = d.description?.trim();
  const date = dutchDateDow(d.dutchPayDate);
  const info = perPersonOfSession(d);
  const minShare = Math.min(...d.participants.map((p) => p.amount));
  const reasonId = useId();
  // 받음 · 모두 받음은 누르는 동안 그 단추만 진행 중이고 다시 눌리지 않는다
  const [pending, setPending] = useState<Set<number | "all">>(new Set());
  const guard = async (key: number | "all", run: () => Promise<void>) => {
    if (pending.has(key)) return;
    setPending((s) => new Set(s).add(key));
    try {
      await run();
    } finally {
      setPending((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const runDelete = async () => {
    setRunning(true);
    try {
      await remove();
      setAskDelete(false);
      onClose();
    } catch (error) {
      setAskDelete(false);
      confirmFail({
        error,
        unconfirmedKind: "delete",
        message: t("deleteFailed"),
        retry: () => remove(),
        onRetried: onClose,
      });
    } finally {
      setRunning(false);
    }
  };
  const receive = async (id: number) => {
    try {
      await markPaid(id);
    } catch (error) {
      confirmFail({
        error,
        unconfirmedKind: "action",
        message: t("markFailed"),
        retry: () => markPaid(id),
      });
    }
  };
  const receiveAll = async () => {
    try {
      await settleAll();
    } catch (error) {
      confirmFail({
        error,
        unconfirmedKind: "action",
        message: t("settleFailed"),
        retry: () => settleAll(),
      });
    }
  };

  const del = (
    <Button
      variant="ghost"
      ghostColor="critical"
      flush="left"
      size={wide ? undefined : "large"}
      className={
        wide
          ? "mr-auto text-fg-critical hover:text-fg-critical active:text-fg-critical"
          : "shrink-0 text-fg-critical hover:text-fg-critical active:text-fg-critical"
      }
      onClick={() => setAskDelete(true)}
    >
      {tc("delete")}
    </Button>
  );
  // 머리 ⋮ — 바닥에는 주 동작([모두 받음]) 하나와 왼쪽 [삭제] 만 둔다. [일괄 요청] 은 아직 열리지 않아 막힌 줄로 머리 ⋮ 에
  // (진행 중일 때만 — 끝난 정산엔 메뉴에 담을 동작이 없어 ⋮ 도 없다). 닫히면 초점은 ⋮ 로 돌아온다(Radix 기본)
  const more = active ? (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button
          variant="ghost"
          ghostColor="neutralSubtle"
          layout="iconOnly"
          size="small"
          aria-label={t("moreOf", { name: d.title })}
        >
          <EllipsisVertical aria-hidden />
        </Button>
      </ResponsiveMenuTrigger>
      <ResponsiveMenuContent title={d.title} align="end">
        <ResponsiveMenuGroup>
          <ResponsiveMenuItem
            label={t("requestAll")}
            description={t("requestSoon")}
            icon={<Send aria-hidden />}
            disabled
            onSelect={() => undefined}
          />
        </ResponsiveMenuGroup>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  ) : undefined;
  const all = active ? (
    <Button
      variant="neutralSolid"
      size={wide ? undefined : "large"}
      className={wide ? undefined : "grow"}
      loading={pending.has("all")}
      onClick={() => void guard("all", receiveAll)}
    >
      {t("receiveAll")}
    </Button>
  ) : null;

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <ResponsiveDialogContent
          title={d.title}
          headerAction={more}
          aria-describedby={undefined}
        >
          <ResponsiveDialogBody scrollFog>
            <p className="m-0 text-t4 text-fg-neutral-subtle">
              {place ? t("detailDate", { date, place }) : date}
            </p>
            <p className="m-0 pt-x1 text-t9 font-bold text-fg-neutral [overflow-wrap:anywhere]">
              <Won amount={d.totalAmount} />
            </p>
            <p className="m-0 pt-x1 text-t4 text-fg-neutral-subtle">
              <PerPersonText info={info} /> ·{" "}
              {t("memberCount", { count: d.participants.length })}
            </p>
            <hr
              aria-hidden
              className="-mx-x6 mb-0 mt-x4 h-px w-[calc(100%+var(--spacing-x12))] border-0 bg-stroke-neutral-subtle"
            />
            <div className="-mx-x6">
              <ListHeader as="h3">
                {t("participantsHeading", { count: d.participants.length })}
              </ListHeader>
              {active && (
                <div className="px-global-gutter pb-x2">
                  <Callout tone="informative" id={reasonId}>
                    {t("requestSoon")}
                  </Callout>
                </div>
              )}
              <List>
                {d.participants.map((p) => {
                  const payer = isPayer(d, p);
                  const make = (amount: string) =>
                    payer
                      ? p.amount !== minShare
                        ? t("payerPaidShare", { amount })
                        : t("payerPaid")
                      : p.isPaid
                        ? t("paidShare", { amount })
                        : t("owesShare", { amount });
                  const detail = (
                    <MaskedText
                      text={make(wonText(p.amount))}
                      masked={make("••••")}
                    />
                  );
                  return (
                    <ListItem
                      key={p.rowId}
                      prefix={<Avatar name={p.participantName} size={36} />}
                      title={p.participantName}
                      detail={detail}
                      suffix={
                        payer ? (
                          <Badge variant="weak" tone="neutral">
                            {t("payerBadge")}
                          </Badge>
                        ) : p.isPaid ? (
                          <Badge variant="weak" tone="positive">
                            {t("paidBadge")}
                          </Badge>
                        ) : active ? (
                          <span className="flex items-center gap-x2">
                            <Button
                              variant="neutralWeak"
                              size="small"
                              disabled
                              aria-describedby={reasonId}
                            >
                              {t("request")}
                            </Button>
                            <Button
                              variant="neutralWeak"
                              size="small"
                              aria-label={t("receiveName", {
                                name: p.participantName,
                              })}
                              loading={pending.has(p.rowId)}
                              onClick={() =>
                                void guard(p.rowId, () => receive(p.rowId))
                              }
                            >
                              {t("receive")}
                            </Button>
                          </span>
                        ) : undefined
                      }
                    />
                  );
                })}
              </List>
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            {wide ? (
              <>
                {del}
                {all}
              </>
            ) : (
              <div className="flex w-full min-w-0! flex-wrap items-center gap-x2 gap-y2">
                {del}
                {all}
              </div>
            )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      {askDelete && (
        <ConfirmDialog
          title={t("deleteConfirm.title")}
          message={t("deleteConfirm.message", { name: d.title })}
          confirmLabel={tc("delete")}
          danger
          loading={running}
          onCancel={() => {
            if (!running) setAskDelete(false);
          }}
          onConfirm={() => void runDelete()}
        />
      )}
    </>
  );
}
