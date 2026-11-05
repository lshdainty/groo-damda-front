import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Monitor,
  MonitorOff,
  Smartphone,
  Tablet,
  CircleHelp,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { Divider } from "@/shared/ds/divider";
import { List, ListItem } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { useNow } from "@/shared/hooks";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { useAuth } from "@/features/auth/model/useAuth";
import {
  useDeviceSessions,
  useRevokeDeviceMutation,
  useRevokeAllDevicesMutation,
} from "@/features/session";
import type { DeviceKind, DeviceSession } from "@/features/session";
import { relativeTime } from "../lib/relative-time";

/** 아이콘은 서버가 준 형태로 고른다 — 기기 이름 문자열을 여기서 다시 뜯지 않는다. */
const KIND_ICON: Record<DeviceKind, typeof Monitor> = {
  MOBILE: Smartphone,
  TABLET: Tablet,
  DESKTOP: Monitor,
  UNKNOWN: CircleHelp,
};

/**
 * "로그인된 기기" — 계정 > 보안에서 들어온다.
 *
 * 이 계정으로 살아 있는 세션을 기기별로 보여 주고, 낯선 기기를 끊게 한다.
 * 목록·해지 모두 desk 백엔드만 부른다(SSO 왕복 없음) — desk 가 로그인마다 자기
 * 세션 테이블에 한 행을 남기기 때문이다.
 *
 * 폰은 흰 면 하나(안내 → 기기 줄 → 위 24 → 모두 로그아웃), 데스크톱 · 태블릿은 카드 하나 +
 * 카드 바닥 줄(I-12 3-A · 4-A). 머리(제목 · 안내)는 데스크톱에서 설정 틀이 그린다.
 */
export function DevicesSection({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { t: tDs } = useTranslation("ds");
  const { logout } = useAuth();
  const {
    data: devices = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useDeviceSessions();
  // 흐르는 '지금' — 목록을 받아 온 시각(dataUpdatedAt)이 아니다. useDeviceSessions 에
  // refetchInterval 이 없어 설정 화면을 열어 두면 그 값이 갱신되지 않아 '방금 전' 에 멈춘다.
  // 앱(devices_screen.dart 의 nowTickProvider)과 같은 1분 해상도를 쓴다.
  const now = useNow();
  const revoke = useRevokeDeviceMutation();
  const revokeAll = useRevokeAllDevicesMutation();

  const [confirming, setConfirming] = useState<DeviceSession | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  // 끊기 실패는 전역 알림이 아니라(요청이 silent) 여기서 한 번만 알린다 — 확인창은 닫고 critical 스낵바 + [다시 시도](묻지 않고 같은 요청).
  const confirmFail = useConfirmFail();
  const failed = (retry: () => Promise<unknown>, onRetried: () => void) =>
    confirmFail({ message: t("devices.logoutFailed"), retry, onRetried });

  const onRevoke = async (device: DeviceSession) => {
    try {
      await revoke.mutateAsync(device.sessionId);
    } catch {
      setConfirming(null);
      failed(
        () => revoke.mutateAsync(device.sessionId),
        () => {
          // 다시 시도가 성공했을 때도 지금 이 브라우저를 끊었으면 로그아웃한다
          if (device.current) void logout();
        },
      );
      return;
    }
    setConfirming(null);
    // 지금 이 브라우저를 끊었으면 여기 머물 이유가 없다 — 다음 요청마다 401 이 난다.
    if (device.current) await logout();
  };

  const onRevokeAll = async () => {
    try {
      await revokeAll.mutateAsync();
    } catch {
      setConfirmingAll(false);
      failed(
        () => revokeAll.mutateAsync(),
        () => void logout(),
      );
      return;
    }
    setConfirmingAll(false);
    // 전부 끊었으니 이 브라우저도 끊겼다.
    //
    // 성공 토스트는 띄우지 않는다 — 확인 다이얼로그에서 "다시 로그인해야 해요" 라고
    // 이미 말했고, 로그인 화면으로 떨어지는 것 자체가 결과다.
    await logout();
  };

  const hasList = !isLoading && !isError && devices.length > 0;

  let content: React.ReactNode;
  if (isLoading) {
    content = <DeviceSkeletonRows />;
  } else if (isError) {
    content = (
      <ResultSection
        kind="failure"
        size="medium"
        title={t("devices.loadError")}
        description={t("devices.loadErrorHint")}
        primaryAction={{
          label: tDs("common.retry"),
          onClick: () => void refetch(),
          loading: isRefetching,
        }}
      />
    );
  } else if (devices.length === 0) {
    content = (
      <ResultSection
        size="medium"
        icon={<MonitorOff />}
        title={t("devices.empty")}
      />
    );
  } else {
    content = (
      <List aria-label={t("sections.devices.label")}>
        {devices.map((d) => (
          <DeviceRow
            key={d.sessionId}
            device={d}
            now={now}
            busy={revoke.isPending && revoke.variables === d.sessionId}
            onRevoke={() => setConfirming(d)}
          />
        ))}
      </List>
    );
  }

  return (
    <>
      {mobile ? (
        <div className="pb-[calc(var(--spacing-x6)+env(safe-area-inset-bottom))]">
          <p className="m-0 px-global-gutter pb-x2 pt-x4 font-sans text-t4 text-fg-neutral-subtle">
            {t("sections.devices.desc")}
          </p>
          {content}
          {/* 비상 버튼이라 목록 아래에 둔다 — 위에 두면 기기 하나만 끊으려던 손이 먼저 닿는다. */}
          {hasList && (
            <div className="px-global-gutter pt-x6">
              <Button
                variant="ghost"
                ghostColor="critical"
                size="large"
                className="w-full"
                onClick={() => setConfirmingAll(true)}
              >
                {t("devices.logoutAll")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card body="list" className={hasList ? "pb-0" : undefined}>
          {hasList ? <div className="pb-x3">{content}</div> : content}
          {hasList && (
            <>
              <Divider />
              {/* 카드 바닥 줄 — 목록 전체에 거는 동작. 버튼 좌우 14 + 오른쪽 10 = 글 끝이 카드 안 24 */}
              <div className="flex justify-end py-x2 pl-x6 pr-x2_5">
                <Button
                  variant="ghost"
                  ghostColor="critical"
                  size="small"
                  onClick={() => setConfirmingAll(true)}
                >
                  {t("devices.logoutAll")}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      <AlertDialog
        open={confirming != null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        {confirming && (
          <AlertDialogContent>
            <AlertDialogTitle>
              {t("devices.logoutTitle", {
                device: confirming.deviceLabel ?? t("devices.unknown"),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("devices.logoutConfirm")}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <Button
                variant="criticalSolid"
                loading={revoke.isPending}
                onClick={() => onRevoke(confirming)}
              >
                {t("devices.logout")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog open={confirmingAll} onOpenChange={setConfirmingAll}>
        <AlertDialogContent>
          <AlertDialogTitle>{t("devices.logoutAllTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("devices.logoutAllConfirm")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <Button
              variant="criticalSolid"
              loading={revokeAll.isPending}
              onClick={onRevokeAll}
            >
              {t("devices.logoutAll")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** 불러오는 중 — 줄 모양 그대로 셋(앞 22 사각 · 제목 t5 40% · 설명 t3 25%, 위아래 12 · 좌우 24) */
function DeviceSkeletonRows() {
  return (
    <div data-device-skeleton>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start px-global-gutter py-x3">
          <Skeleton radius="4" className="mr-x3 size-[22px] shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton radius="4" text="t5" className="w-2/5" />
            <Skeleton radius="4" text="t3" className="w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 기기 한 줄 — 보기 줄(맞춤 위): 아이콘 22 + 이름(+ 현재 기기 배지가 이름 끝에 이어 붙는다) + 마지막 사용 + 뒤 [로그아웃].
 * 줄 자체는 누르지 않고 뒤 버튼 하나만 누른다. 줄 사이 선은 두지 않는다.
 */
function DeviceRow({
  device,
  now,
  busy,
  onRevoke,
}: {
  device: DeviceSession;
  /** 상대 시각의 기준점 — 흐르는 '지금'(useNow). */
  now: number;
  busy: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tDate } = useTranslation("date");
  const when = relativeTime(tDate, device.lastUsedAt ?? device.createAt, now);
  const Icon = KIND_ICON[device.deviceKind] ?? CircleHelp;
  const name = device.deviceLabel ?? t("devices.unknown");

  return (
    <ListItem
      align="top"
      prefix={<Icon />}
      title={
        <>
          {name}
          {device.current && (
            <>
              <span className="sr-only">, </span>
              <Badge
                variant="outline"
                tone="positive"
                className="ml-x1 align-[2px]"
              >
                {t("devices.current")}
              </Badge>
            </>
          )}
        </>
      }
      detail={when ? t("devices.lastUsed", { when }) : undefined}
      suffix={
        <Button
          variant="ghost"
          size="small"
          loading={busy}
          aria-label={t("devices.logoutLabel", { device: name })}
          className="-mr-x3_5 -my-[7px]"
          onClick={onRevoke}
        >
          {t("devices.logout")}
        </Button>
      }
    />
  );
}
