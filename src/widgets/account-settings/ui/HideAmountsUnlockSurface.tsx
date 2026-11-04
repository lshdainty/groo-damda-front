import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import { HideAmountsUnlockFields } from "./HideAmountsUnlockBody";
import { useHideAmountsUnlock } from "./use-hide-amounts-unlock";

function UnlockBody({
  onClose,
  onVerified,
}: {
  onClose: () => void;
  onVerified: () => void;
}) {
  const { t } = useTranslation("settings");
  const wide = useWideSurface();
  const unlock = useHideAmountsUnlock({ onVerified });
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
          {wide && (
            <Button variant="neutralWeak" size="small" onClick={onClose}>
              {t("hideAmounts.cancel")}
            </Button>
          )}
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
 * 옛 `HideAmountsUnlockDialog`(옛 Dialog sm)는 설정 쪽이 쓰는 동안 남는다.
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
  const { t } = useTranslation("settings");
  if (!open) return null;
  return (
    <ResponsiveDialog open form onOpenChange={onOpenChange}>
      <ResponsiveDialogContent title={t("hideAmounts.unlockTitle")}>
        <UnlockBody
          onClose={() => onOpenChange(false)}
          onVerified={() => {
            onVerified();
            onOpenChange(false);
          }}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
