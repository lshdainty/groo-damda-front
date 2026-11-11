import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { BusyOverlay } from "@/shared/ui/groo/busy-overlay";
import { ReauthFields, useReauth } from "@/features/user";
import { oauthLinkApi } from "@/features/oauth-link";

/**
 * 소셜 계정 연결 전 본인 확인(보안 점검 S-2).
 *
 * <p>로그인 쿠키만 훔친 사람이 자기 구글을 붙이면 그 구글로 영영 들어올 수 있다. 그래서 연결을 시작하기 전에
 * 해지와 같은 본인 확인(비밀번호 · 메일 코드)을 받고, 받은 `oauth-link` 티켓을 연동 시작 요청 헤더에 곧장 싣는다.
 * 티켓은 10분 · 단회라 어디에도 남기지 않는다.
 *
 * <p>모양은 해지 다이얼로그의 본인 확인 단계와 같다 — 칸은 `ReauthFields` 를 함께 쓴다. 해지처럼 되돌릴 수 없는
 * 일이 아니라 확인 버튼은 빨갛지 않은 주 버튼(비밀번호 바꾸기의 [저장]과 같은 기본 버튼)이다.
 *
 * <p>확인 뒤 연동 시작이 실패하면 티켓은 이미 쓰였을 수 있다. 같은 입력으로 다시 보내지 않게 칸을 비우고
 * 칸 밑에 "본인 확인부터 다시" 를 세운다 — 다음 [연결하기] 는 처음부터 다시 확인한다.
 */
export function LinkReauthDialog({
  provider,
  providerName,
  onClose,
}: {
  /** 연동 시작 경로의 provider (예: "google") */
  provider: string;
  /** 화면에 보이는 이름 (예: "Google") */
  providerName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  // 확인이 시작될 때 켠다. 성공하면 걷지 않는다 — 연동 화면으로 떠나며 사라진다.
  const [busy, setBusy] = useState(false);
  // 확인이 나가 있는 동안 또 눌려도 아무 일이 없어야 한다 — 두 번째 요청이 이미 쓴 티켓을 들고 가 거절당한다.
  const runningRef = useRef(false);
  const reauth = useReauth({
    purpose: "oauth-link",
    idPrefix: "link-reauth",
    failedText: t("account.linkReauth.failed"),
  });

  const onConfirm = async () => {
    if (runningRef.current) return;
    if (!reauth.checkInput()) return;
    runningRef.current = true;
    setBusy(true);
    const token = await reauth.verify();
    if (token == null) {
      setBusy(false);
      runningRef.current = false;
      return;
    }
    try {
      // returnUrl = 현재 설정 페이지 절대 URL. 연동 후 그루 계정이 여기로 ?linked/?linkError 를 달고 복귀.
      const { startUrl } = await oauthLinkApi.startLink(
        provider,
        window.location.origin + window.location.pathname,
        token,
      );
      window.location.href = startUrl;
    } catch {
      // 티켓 거절(OAUTH_LINK_FAILED) · 네트워크 — 티켓은 이미 쓰였을 수 있어 본인 확인부터 다시 받는다
      reauth.restart(t("account.linkReauth.startFailed"));
      setBusy(false);
    } finally {
      runningRef.current = false;
    }
  };

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        form
        dirty={reauth.dirty}
        busy={busy}
      >
        <ResponsiveDialogContent
          title={t("account.linkReauth.title", { name: providerName })}
          description={t("account.linkReauth.intro", { name: providerName })}
        >
          <ResponsiveDialogBody>
            <ReauthFields reauth={reauth} />
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
            <Button onClick={onConfirm} disabled={!reauth.canConfirm}>
              {t("account.linkReauth.confirm")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <BusyOverlay busy={busy} label={t("account.linkReauth.busy")} />
    </>
  );
}
