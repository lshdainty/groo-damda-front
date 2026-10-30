import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Palette, Pin, Tag } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { List, ListSwitchItem } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { Textarea } from "@/shared/ds/textarea";
import { ColorPickerRow } from "@/shared/ui/groo/icon-color-rows";
import { PickList } from "@/shared/ui/groo/pick-list";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import type { Memo, MemoFormValues } from "@/entities/memo";
import {
  NO_TAG_KEY,
  memoTagInitialValue,
  tagValueToPayload,
} from "../lib/memo-tags";
import { DEFAULT_MEMO_COLOR } from "../lib/memo-view";

/**
 * 제목·본문 입력 상한 — 서버 `FieldLimits`(TITLE_MAX 200 · CONTENT_MAX 10,000)와 같은 값.
 * 제한이 없어 500자 제목이 서버 500 으로 터지던 자리다(QA #30 · #33). `maxLength` 는 타이핑 · 붙여넣기를 브라우저가,
 * `slice` 는 프로그램 입력까지 자른다.
 */
export const TITLE_MAX = 200;
export const CONTENT_MAX = 10_000;

/**
 * 메모 추가 · 수정 폼(I-15 13) — 줄 칸 폼: ds Responsive Dialog 입력 폼(1280 이상 대화상자 480 · 미만 Bottom Sheet).
 * 제목 Input large 52 → 내용 Textarea(3줄에서 자라고 시트 안 최대 높이) → 선 → List 줄 [태그 · 색상 · 상단에 고정 스위치].
 * 태그 · 색 줄은 꺾쇠 없이 값 글만, 누르면 1280 미만은 고르기 시트 · 이상은 그 자리 Popover. 고르면 바로 넣고 닫힌다.
 * 바닥은 [저장] 하나(시트는 폭 전체 · 대화상자는 [취소] [저장]). [저장] 은 켜 두고 누를 때 제목이 비면 칸 아래 오류 + 초점.
 * 값이 바뀐 채 닫으면 "작성한 내용이 사라져요" 를 묻고 바깥 누름 · 끌어내림으로는 닫히지 않는다.
 * 저장이 실패하면(`saveError`) 폼 맨 위 Callout — 폼은 열려 있고 쓴 값은 그대로다.
 */
export function MemoFormDialog({
  memo,
  tags,
  saveError,
  submitting,
  onClose,
  onSave,
}: {
  memo: Memo | null;
  /** 고를 수 있는 태그 이름 — 서버 목록 ∪ 메모에 남은 이름 */
  tags: string[];
  saveError: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSave: (
    values: MemoFormValues,
    id: number | undefined,
    pinned: boolean,
  ) => Promise<void>;
}) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const isNew = !memo;
  // 열린 순간의 값 — 닫을 때 바뀐 값이 있는지 이것과 견준다
  const [initial] = useState(() => ({
    title: memo?.title ?? "",
    content: memo?.content ?? "",
    // 있는 메모는 지금 태그(없으면 '태그 없음'), 새 메모도 '태그 없음' — 태그를 몰래 붙이지 않는다
    tag: memoTagInitialValue(memo),
    pinned: memo?.isPinned ?? false,
    color: memo?.color || DEFAULT_MEMO_COLOR,
  }));
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [tag, setTag] = useState(initial.tag);
  const [pinned, setPinned] = useState(initial.pinned);
  const [color, setColor] = useState(initial.color);
  const [showError, setShowError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const dirty =
    title !== initial.title ||
    content !== initial.content ||
    tag !== initial.tag ||
    pinned !== initial.pinned ||
    color !== initial.color;
  const titleEmpty = !title.trim();

  const submit = () => {
    if (submitting) return;
    if (titleEmpty) {
      setShowError(true);
      titleRef.current?.focus();
      return;
    }
    void onSave(
      {
        title: title.trim(),
        content,
        // sentinel 은 서버로 안 나간다 — 태그를 떼는 건 null 이다.
        tag: tagValueToPayload(tag),
        color,
      },
      memo?.rowId,
      pinned,
    );
  };

  // 목록에 없는 지금 값은 지킨다(다른 기기가 만든 태그 · 백필 전)
  const options =
    tags.includes(tag) || tag === NO_TAG_KEY ? tags : [tag, ...tags];
  const tagText = tag === NO_TAG_KEY ? t("noTag") : tag;

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={isNew ? t("newMemo") : t("editMemo")}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          {saveError && (
            <Callout tone="critical" role="alert" className="mb-x4">
              {t("saveFailed")}
            </Callout>
          )}
          <Field
            label={t("titlePlaceholder")}
            invalid={showError && titleEmpty}
            errorMessage={t("titleRequired")}
            labelHidden
            className="pb-x2 pt-x1"
          >
            <Input
              ref={titleRef}
              size="large"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.slice(0, TITLE_MAX));
                if (showError) setShowError(false);
              }}
              placeholder={t("titlePlaceholder")}
              maxLength={TITLE_MAX}
            />
          </Field>
          <Field label={t("contentLabel")} labelHidden className="pb-x2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
              placeholder={t("contentPlaceholder")}
              maxLength={CONTENT_MAX}
              className="max-h-[32dvh]"
            />
          </Field>
          {/* 한 면 안에서 묶음이 바뀐다 — 끝까지 선 1px, 위 8 · 아래 0 */}
          <hr
            aria-hidden
            className="-mx-x6 mb-0 mt-x2 h-px w-[calc(100%+var(--spacing-x12))] border-0 bg-stroke-neutral-subtle"
          />
          <div className="-mx-x6">
            <PickerRow
              title={t("tagLabel")}
              prefix={<Tag />}
              value={tagText}
              surfaceTitle={t("tagLabel")}
              popoverClassName="w-[320px]"
            >
              {({ close }) => (
                <>
                  <PickList
                    label={t("tagLabel")}
                    selected={tag}
                    items={[
                      { value: NO_TAG_KEY, title: t("noTag") },
                      ...options.map((name) => ({ value: name, title: name })),
                    ]}
                    onPick={(v) => {
                      setTag(v);
                      close();
                    }}
                  />
                  {/* 태그가 0개면 고를 게 '태그 없음' 뿐이라 어디서 만드는지 한 줄로 알린다(이름을 지어 넣지 않는다 — QA #105) */}
                  {tags.length === 0 && (
                    <p className="m-0 px-global-gutter pb-x2 pt-x4 text-center font-sans text-t4 text-fg-neutral-subtle">
                      {t("tagEmptyHint")}
                    </p>
                  )}
                </>
              )}
            </PickerRow>
            <ColorPickerRow
              title={t("colorLabel")}
              prefix={<Palette />}
              value={color}
              onChange={setColor}
            />
            <List>
              <ListSwitchItem
                prefix={<Pin className="size-[22px]" />}
                title={t("pinToTop")}
                checked={pinned}
                onCheckedChange={setPinned}
              />
            </List>
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button
            size={wide ? undefined : "large"}
            className={wide ? undefined : "w-full"}
            loading={submitting}
            onClick={submit}
          >
            {tc("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
