import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
} from "@/shared/ds/dialog";
import type { EventFormFlow } from "@/widgets/calendar/model/use-event-form-flow";
import { EventFormDialogBody } from "./dialog-body";

/**
 * 일정 폼의 "자세히" 대화상자 안쪽 (I-09 32) — 1280 이상. `Dialog form` 안에 둔다(바깥 · 바뀐 값 물음은 root 가 맡는다).
 */
export function EventFormDialogPanel({ flow }: { flow: EventFormFlow }) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const {
    view,
    heading,
    del,
    isLoading,
    save,
    saveError,
    focusTitleOnOpen,
    setErrorEl,
  } = flow;
  return (
    <DialogContent title={heading} onOpenAutoFocus={focusTitleOnOpen}>
      <DialogBody scrollFog>
        {saveError && (
          <div ref={setErrorEl}>
            <Callout tone="critical" role="alert" className="mb-x4">
              {t("form.saveFailed")}
            </Callout>
          </div>
        )}
        <EventFormDialogBody view={view} />
      </DialogBody>
      <DialogFooter>
        {del && (
          <Button
            variant="ghost"
            ghostColor="critical"
            className="mr-auto"
            onClick={del}
          >
            {tc("delete")}
          </Button>
        )}
        <DialogCancel>{tc("cancel")}</DialogCancel>
        <Button loading={isLoading} onClick={save}>
          {tc("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
