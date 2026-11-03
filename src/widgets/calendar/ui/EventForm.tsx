import { BottomSheet } from "@/shared/ds/bottom-sheet";
import { Dialog } from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import {
  useEventFormFlow,
  type EventFormFlowArgs,
} from "@/widgets/calendar/model/use-event-form-flow";
import { EventFormDialogPanel } from "./event-form/dialog-panel";
import { EventFormSheetPanel } from "./event-form/sheet-panel";

interface EventFormProps extends Omit<EventFormFlowArgs, "onSubmit"> {
  onSubmit: (data: Parameters<EventFormFlowArgs["onSubmit"]>[0]) => void;
  onClose: () => void;
}

/**
 * 일정 추가 · 수정 폼 (I-09 21 ~ 32) — 1280 미만은 ds Bottom Sheet 입력 폼(제목 칸 + List 줄 칸 · 장소 · 설명은 같은 시트 안 한 단계),
 * 1280 이상은 "자세히" ds Dialog 480(Field 칸). 상태는 `useEventFormFlow` 가 한 번 들고 두 표면이 읽으므로 1280 을 넘나들어도
 * 값이 남는다. [저장] 은 켜 두고 누를 때 비거나 틀린 칸마다 오류를 보이며 첫 오류 칸으로 초점을 옮긴다.
 * 바깥 누르기 · 끌어내리기로는 닫히지 않고, 바뀐 값이 있으면 닫기 전에 "작성한 내용이 사라져요" 를 묻는다.
 * 일정 상세가 든 시트(`EventDetailSurface`)는 같은 `EventFormSheetPanel` 을 자기 시트 안에 그린다.
 */
export const EventForm = ({ onClose, ...args }: EventFormProps) => {
  const wide = useWideSurface();
  const flow = useEventFormFlow(args);

  if (wide) {
    return (
      <Dialog
        open
        form
        dirty={flow.dirty}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <EventFormDialogPanel flow={flow} />
      </Dialog>
    );
  }

  return (
    <BottomSheet
      open
      form
      // 장소 · 설명 단계의 Esc · 뒤로 가기는 친 글을 버리고 줄 칸으로 돌아간다 — 시트를 닫는 물음은 줄 칸 단계에서만
      dirty={flow.dirty && !flow.inStep}
      onOpenChange={(next) => {
        if (next) return;
        if (flow.inStep) flow.requestCancelStep();
        else onClose();
      }}
    >
      <EventFormSheetPanel flow={flow} />
    </BottomSheet>
  );
};
