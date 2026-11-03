import { useTranslation } from "react-i18next";

import { useSnackbar } from "@/shared/ds/snackbar";

import { useIsMobile } from "@/shared/hooks";
import { useCalendarScreen } from "@/widgets/calendar/model/use-calendar-screen";
import { CalendarDesktop } from "@/widgets/calendar/ui/CalendarDesktop";
import { CalendarMobile } from "@/widgets/calendar/ui/CalendarMobile";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";

import { CalendarEventFormHost } from "./CalendarEventFormHost";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

interface IProps {
  events: IEvent[];
  isLoading?: boolean;
  /** 일정 질의가 내용 없이 실패했다 */
  isFailed?: boolean;
  /** 일정 질의만 다시 받는다 */
  onRetry?: () => void;
}

/**
 * 캘린더 화면의 뼈대 — 상태(`useCalendarScreen`)를 들고 폰 · 데스크톱/태블릿 표면을 고르며,
 * 둘이 함께 쓰는 일정 폼(그날 추가 · 수정)과 삭제 확인을 그린다.
 */
const CalendarContainer = ({
  events,
  isLoading = false,
  isFailed = false,
  onRetry = () => {},
}: IProps) => {
  const { t } = useTranslation("calendar");
  const snackbar = useSnackbar();
  const isMobile = useIsMobile();
  const screen = useCalendarScreen(events);
  const {
    editingEvent,
    setEditingEvent,
    deleting,
    setDeleting,
    creatingDate,
    setCreatingDate,
    deleteEvent,
    handleConfirmDelete,
  } = screen;

  return (
    <div className="flex w-full flex-col">
      {isMobile ? (
        <CalendarMobile
          screen={screen}
          isLoading={isLoading}
          isFailed={isFailed}
          onRetry={onRetry}
        />
      ) : (
        <CalendarDesktop
          screen={screen}
          isLoading={isLoading}
          isFailed={isFailed}
          onRetry={onRetry}
        />
      )}

      {/* 일정 추가(그날 시트 · 패널 · 제목 줄) — 그 날 기본값. 폼 표면은 1280 에서 시트 ↔ 대화상자 */}
      {creatingDate && (
        <CalendarEventFormHost
          selectedDate={creatingDate}
          quick={!isMobile}
          onClose={() => setCreatingDate(null)}
        />
      )}

      {/* 일정 수정 */}
      {editingEvent && (
        <CalendarEventFormHost
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onDelete={() => {
            setDeleting({
              id: editingEvent.rowId,
              title: editingEvent.title,
              recurring: !!editingEvent.rrule,
            });
            setEditingEvent(null);
          }}
        />
      )}

      {/* Delete Confirmation — 삭제 확인은 전부 ConfirmDialog 한 모양이다(spec alert-dialog.md) */}
      {deleting !== null && (
        <ConfirmDialog
          title={t("deleteConfirm.title")}
          // 반복 일정은 행 하나를 지우면 모든 회차가 사라진다(서버) — 확인창이 그렇게 말한다(I-09b 8)
          message={t(
            deleting.recurring
              ? "deleteConfirm.messageRecurring"
              : "deleteConfirm.message",
            { name: deleting.title },
          )}
          confirmLabel={t("deleteConfirm.confirm")}
          cancelLabel={t("deleteConfirm.cancel")}
          danger
          loading={deleteEvent.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            handleConfirmDelete(() =>
              snackbar.show({
                message: t("deleteConfirm.failed"),
                tone: "critical",
              }),
            )
          }
        />
      )}
    </div>
  );
};

export { CalendarContainer };
