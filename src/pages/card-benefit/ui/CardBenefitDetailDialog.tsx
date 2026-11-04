import { useTranslation } from "react-i18next";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { CardDetailContent } from "./CardDetailContent";

/**
 * 카드 상세 — 조회 시트 (I-20 E 34 · 36). 1280 미만 Bottom Sheet(768 이상은 480 가운데), 바깥 누름 · 끌어내림으로 닫히고
 * 바닥 버튼은 없다(닫기 원 하나). 높이는 내용만큼 · 최대 90%, 본문만 스크롤한다. 1280 이상은 이 대화상자를 열지 않는다 — 오른쪽 패널이 보여 준다.
 * rowId 로 useCardCatalogDetail 만 쓴다(신규 API 없음).
 */
export function CardBenefitDetailDialog({
  rowId,
  onClose,
}: {
  rowId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation("card");
  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={t("benefit.detailTitle")}
        aria-describedby={undefined}
      >
        <ResponsiveDialogBody scrollFog>
          <CardDetailContent rowId={rowId} />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
