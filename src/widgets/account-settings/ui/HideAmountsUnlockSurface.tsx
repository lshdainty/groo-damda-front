import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import { HideAmountsUnlockFields } from "./HideAmountsUnlockBody";
import { useHideAmountsUnlock } from "./use-hide-amounts-unlock";

function UnlockBody({
  unlock,
}: {
  unlock: ReturnType<typeof useHideAmountsUnlock>;
}) {
  const { t } = useTranslation("settings");
  const wide = useWideSurface();
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>("input")?.focus();
  }, []);
  return (
    <>
      <ResponsiveDialogBody ref={bodyRef}>
        <HideAmountsUnlockFields unlock={unlock} />
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <div
          className={
            wide ? "ml-auto flex items-center gap-x2" : "flex min-w-0 flex-1"
          }
        >
          {/* 대화상자의 [취소] — 표면의 닫기를 청한다(확인 중이면 받지 않는다 · 친 값이 있으면 묻는다) */}
          <ResponsiveDialogCancel size="small">
            {t("hideAmounts.cancel")}
          </ResponsiveDialogCancel>
          <Button
            size={wide ? "small" : "large"}
            className={wide ? undefined : "flex-1"}
            loading={unlock.pending}
            onClick={unlock.submit}
          >
            {t("hideAmounts.viewAmounts")}
          </Button>
        </div>
      </ResponsiveDialogFooter>
    </>
  );
}

/**
 * 금액 보기 본인 확인 표면(I-14 44 · I-17 52) — 1280 미만 시트 · 이상 Dialog 480 + 본문 부품(`HideAmountsUnlockFields`).
 * 페이지 위에 하나만 뜬다. 맞으면 `onVerified` 를 부르고 닫는다. 바깥을 눌러 닫히지 않는다(입력 폼 — `form`).
 * 금액 가리기 화면(I-14 44)과 자산 상세(I-17)가 함께 쓴다 — 옛 `HideAmountsUnlockDialog` 는 걷었다.
 */
export function HideAmountsUnlockSurface({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}) {
  if (!open) return null;
  return <UnlockSurface onOpenChange={onOpenChange} onVerified={onVerified} />;
}

// 열려 있는 동안만 산다 — 비밀번호 상태를 여기 두어 값이 있는 채 닫을 때 ds `dirty` 가 물을 수 있게 한다(I-14 44)
function UnlockSurface({
  onOpenChange,
  onVerified,
}: {
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}) {
  const { t } = useTranslation("settings");
  const unlock = useHideAmountsUnlock({
    onVerified: () => {
      onVerified();
      onOpenChange(false);
    },
  });
  return (
    <ResponsiveDialog
      open
      form
      dirty={unlock.password !== ""}
      onOpenChange={onOpenChange}
      busy={unlock.pending}
    >
      <ResponsiveDialogContent title={t("hideAmounts.unlockTitle")}>
        <UnlockBody unlock={unlock} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
