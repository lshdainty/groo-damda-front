import type {
  AttachmentEntry,
  AttachmentRejection,
  AttachmentRejectionCode,
  AttachmentStatus,
} from "./attachment-input";

/*
 * Groo Attachment Input 의 모양 · 검사 — 수치 원본은 groo-design specs/components/attachment-input.yaml
 * (값은 src/shared/ds/spec/attachment-input.json). 컴포넌트와 규칙은 attachment-input.tsx 머리 주석이다
 * (컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

/** 파일 크기 글 — "512B" · "84KB" · "9.8MB"(MB · GB 는 소수 한 자리, 띄어 쓰지 않는다) */
export function formatFileSize(bytes: number): string {
  const b = Math.max(0, Math.round(bytes));
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

// ── 검사 ─────────────────────────────────────────────────────
export const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif)$/i;
export const SHEET_EXT = /\.(csv|xlsx?|ods|numbers)$/i;
export const SHEET_TYPE = /(csv|spreadsheet|ms-excel)/i;

export const isImage = (type: string, name: string) =>
  type ? type.startsWith("image/") : IMAGE_EXT.test(name);

// accept 를 다시 검사한다 — 고르기 창의 accept 는 편의일 뿐("모든 파일" 로 다른 형식을 고를 수 있다)
export function accepts(file: File, accept: string | undefined) {
  const tokens = (accept ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((t) => {
    if (t.startsWith(".")) return name.endsWith(t);
    if (t.endsWith("/*"))
      return (
        type.startsWith(t.slice(0, -1)) ||
        (t === "image/*" && !type && IMAGE_EXT.test(name))
      );
    return type === t;
  });
}

// 형식 · 크기 · 개수 — 통과한 파일은 앞에서부터 남은 자리만큼, 넘친 파일은 TOO_MANY_FILES
export function validate(
  files: File[],
  room: number,
  accept: string | undefined,
  maxFileSize: number | undefined,
) {
  const accepted: File[] = [];
  const rejections: AttachmentRejection[] = [];
  for (const file of files) {
    const codes: AttachmentRejectionCode[] = [];
    if (!accepts(file, accept)) codes.push("INVALID_TYPE");
    if (maxFileSize != null && file.size > maxFileSize)
      codes.push("FILE_TOO_LARGE");
    if (codes.length === 0 && accepted.length >= room)
      codes.push("TOO_MANY_FILES");
    if (codes.length > 0) rejections.push({ file, codes });
    else accepted.push(file);
  }
  return { accepted, rejections };
}

let entrySeq = 0;
export const newEntryId = () =>
  `attachment-${Date.now().toString(36)}-${(entrySeq += 1)}`;

export const hasFiles = (e: { dataTransfer: DataTransfer | null }) =>
  Array.from(e.dataTransfer?.types ?? []).includes("Files");

export const STALL_MS = 10_000;
export const EMPTY_IDS: ReadonlySet<string> = new Set();

// 보이는 상태 — 진행이 멈춘 올리기는 실패로 보인다
export const effectiveStatus = (
  e: AttachmentEntry,
  stalled: ReadonlySet<string>,
): AttachmentStatus =>
  e.status === "uploading" && stalled.has(e.id) ? "error" : e.status;

// 같은 글이 이어지면 다시 읽히게 끝에 빈칸을 번갈아 붙인다
export const nextMessage = (previous: string, text: string) =>
  previous.endsWith(" ") ? text : `${text} `;

// ── 모양 ─────────────────────────────────────────────────────
export const ROOT = "flex min-w-0 flex-col gap-x2 font-sans";

// 항목 줄 — tile 은 화면 가장자리까지(Scroll Fog row 가 좌우 24 안쪽 여백 · 끝 흐림 20 · 스크롤바 숨김), dropzone 은 칸 안.
// 위 16 을 더 두고 같은 만큼 당긴다 — × 의 누르는 자리 44 가 위로 16(걸침 4 + 보이지 않는 여백 12) 나가도 가로 스크롤 줄에 잘리지 않는다.
// 당긴 16 은 위 칸(라벨 · 드롭존)에 겹치므로 줄 자체는 누르기를 받지 않고 안의 내용만 받는다
export const ROW_TILE =
  "-mx-global-gutter -mt-x4 pt-x4 pointer-events-none [&>*]:pointer-events-auto";
export const ROW_DROPZONE =
  "-mt-x4 flex flex-wrap items-start gap-x2 pt-x4 pointer-events-none [&>*]:pointer-events-auto";
export const ROW_CONTENT = "flex items-start gap-x2";
export const LIST = "m-0 flex list-none items-start gap-x2 p-0";

// 첨부 타일 — 80 · 모서리 12 · 안쪽 1px. 다 참 · 읽기 전용(aria-disabled) · 막힘(disabled)은 바탕 · 축소 없이 아이콘 · 개수만 fg-disabled
export const TRIGGER = [
  "group/attachment-trigger relative flex size-[80px] shrink-0 cursor-pointer flex-col items-center justify-center gap-x1 rounded-r3 bg-transparent font-sans",
  "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] [--press-basis:80]",
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
  "aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent aria-disabled:active:[scale:1]",
  "disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:bg-transparent disabled:active:[scale:1]",
].join(" ");
export const TRIGGER_ICON =
  "size-[24px] shrink-0 text-fg-neutral-subtle group-aria-disabled/attachment-trigger:text-fg-disabled group-disabled/attachment-trigger:text-fg-disabled";
export const COUNT = "text-t2 font-normal";
export const COUNT_NOW =
  "text-fg-neutral group-aria-disabled/attachment-trigger:text-fg-disabled group-disabled/attachment-trigger:text-fg-disabled";
export const COUNT_MAX =
  "text-fg-neutral-subtle group-aria-disabled/attachment-trigger:text-fg-disabled group-disabled/attachment-trigger:text-fg-disabled";

// × 둘레 구멍 — 지름 24, 가운데가 오른쪽 위 모서리에서 안쪽 6(× 의 가운데와 같다). 끄는 동안은 구멍이 없다
export const MASK =
  "[mask-image:radial-gradient(circle_at_calc(100%_-_6px)_6px,transparent_12px,#000_12.5px)] group-data-[dragging]/attachment-item:[mask-image:none]";

// 항목 상자 — 높이 80 · 모서리 12 · 윤곽(::after, 그림 위). 끄는 동안 2px 거리 축소(기준 80).
// 누를 수 있는 항목(메뉴 · 순서 바꾸기)은 role="button" — 키보드 포커스 링은 안쪽 2px
export const ITEM = [
  "relative flex h-[80px] shrink-0 items-center justify-center gap-x2_5 rounded-r3 bg-transparent",
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']",
  MASK,
  "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] [--press-basis:80]",
  "group-data-[dragging]/attachment-item:[scale:calc(1-2/var(--press-basis))] motion-reduce:group-data-[dragging]/attachment-item:[scale:1]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
  "data-[pressable]:cursor-pointer data-[sortable]:cursor-grab group-data-[readonly]/attachment-item:cursor-default group-data-[dragging]/attachment-item:cursor-grabbing",
].join(" ");
// 사진은 읽기 전용 · 끄는 동안 불투명도 0.5(SEED 그대로 — 사용자 결정 2026-10-15 마무리 13B, v106 의 예외는 이 두 상태뿐) —
// 흐림 · 축소는 motion-duration-d4 · ease-easing 으로 서서히(모션 줄이기면 바로)
export const ITEM_KIND = {
  image:
    "w-[80px] after:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-overlay)] [transition:opacity_var(--motion-duration-d4)_var(--motion-ease-easing),scale_var(--motion-duration-d4)_var(--motion-ease-easing)] motion-reduce:[transition:none] group-data-[readonly]/attachment-item:opacity-50 group-data-[dragging]/attachment-item:opacity-50",
  file: "w-[160px] px-x4 after:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
} as const;

export const IMAGE =
  "pointer-events-none size-full select-none rounded-[inherit] object-cover";
export const IMAGE_FALLBACK =
  "flex size-full items-center justify-center rounded-[inherit] bg-bg-neutral-weak text-fg-neutral-subtle [&>svg]:size-[24px]";

// 파일 카드 — 썸네일 칸 48 · 이름 · 크기. 실패면 다시 시도가 채운다. 읽기 전용 · 끄는 동안 글 · 아이콘 fg-disabled(SEED — 13B)
export const THUMBNAIL =
  "flex size-[48px] shrink-0 items-center justify-center rounded-r2 bg-bg-neutral-weak text-fg-neutral-subtle [&>svg]:size-[24px] group-data-[readonly]/attachment-item:text-fg-disabled group-data-[dragging]/attachment-item:text-fg-disabled group-data-[status=error]/attachment-item:hidden";
export const META =
  "flex min-w-0 flex-1 flex-col gap-0 group-data-[status=error]/attachment-item:hidden";
// 이름은 글자 단위로 줄을 바꾼다(break-all — SEED 레시피 그대로, 사용자 결정 2026-10-15 마무리 11D)
export const NAME =
  "relative block break-all text-t2 font-medium text-fg-neutral group-data-[readonly]/attachment-item:text-fg-disabled group-data-[dragging]/attachment-item:text-fg-disabled";
// 첫 줄만 오른쪽 4 를 비운다(YAML name.maskClear) — 오른쪽 float 4 × 한 줄. 네 줄이면 이름이 카드 위에 붙어 × 구멍이 첫 줄 끝 글자를
// 파먹는다. 둘째 줄부터는 70 그대로
export const NAME_CLEAR = "float-right h-[1lh] w-x1";
// 줄 수를 재는 보이지 않는 같은 글(같은 폭 · 같은 첫 줄 비움)
export const NAME_MEASURE = "invisible absolute inset-x-0 top-0";
export const NAME_EXT = "block";
export const SIZE =
  "text-t1 font-normal text-fg-neutral-subtle group-data-[readonly]/attachment-item:text-fg-disabled group-data-[dragging]/attachment-item:text-fg-disabled";

// 사진 위 덮개 — 올리는 중(라이트 0.50 · 다크 0.65) · 실패(두 모드 0.65 — 글이 얹힌다)
export const BACKDROP =
  "absolute inset-0 flex items-center justify-center rounded-[inherit]";
export const BACKDROP_UPLOADING =
  "bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]";
export const BACKDROP_ERROR = "bg-[var(--overlay-dim-dark)]";

// 대표 띠 — 첫 사진 아래 24, 두 모드 0.65. 사진 위 표식이라 글 · 띠 높이 모두 글자 크기 설정을 따르지 않는다
export const BADGE =
  "absolute inset-x-0 bottom-0 flex h-x6 items-center justify-center rounded-b-r3 bg-[var(--overlay-dim-dark)] px-x1 text-t2-static font-medium text-static-white";
export const BADGE_LABEL = "truncate";

// 다시 시도 — 항목 위에 겹친 형제(항목이 단추일 수 있다). 누르면 이것만 2px 거리 축소(기준 80)
export const ACTION = [
  "absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-x1 rounded-r3 bg-transparent font-sans text-t2 font-medium [&>svg]:size-[24px]",
  MASK,
  "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] [--press-basis:80]",
  "active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
  "disabled:cursor-not-allowed disabled:active:[scale:1]",
].join(" ");
export const ACTION_KIND = {
  image: "text-static-white",
  file: "text-fg-neutral-subtle",
} as const;

// × — 20 원이 모서리 밖으로 위 4 · 오른쪽 4. 누르는 자리 44(::before 12 씩). 끄는 동안 사라진다. 이웃 항목 위로 올린다
export const REMOVE = [
  "absolute -right-x1 -top-x1 z-[1] flex size-[20px] cursor-pointer items-center justify-center rounded-full bg-bg-layer-default text-fg-neutral",
  "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)] [&>svg]:size-[10px]",
  "before:absolute before:-inset-x3 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] [--press-basis:24]",
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
  "aria-disabled:cursor-not-allowed aria-disabled:text-fg-disabled aria-disabled:hover:bg-bg-layer-default aria-disabled:active:bg-bg-layer-default aria-disabled:active:[scale:1]",
  "disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:bg-bg-layer-default disabled:active:bg-bg-layer-default disabled:active:[scale:1]",
  "group-data-[dragging]/attachment-item:hidden",
].join(" ");

// 항목 자리(li) — 항목 · 다시 시도 · × 를 담는다. 끄는 항목이 위로
export const ITEM_ROOT =
  "group/attachment-item relative shrink-0 [touch-action:manipulation] data-[dragging]:z-[2]";

// 드롭존(1280 이상) — 최소 높이 120(큰 글자에서 안내 · 버튼을 따라 늘어난다) · 1px 실선. 끌어 들어오면 테두리 · 바탕이 바뀐다. 막히면 옅은 테두리
export const DROPZONE = [
  "group/attachment-dropzone hidden min-h-[120px] flex-col items-center justify-center gap-x2 rounded-r3 border border-solid border-stroke-neutral-solid bg-transparent px-x4 lg:flex",
  "[transition:border-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "data-[drag-over]:border-stroke-neutral-contrast data-[drag-over]:bg-bg-layer-default-pressed",
  "data-[disabled]:border-stroke-neutral-weak",
].join(" ");
export const DROPZONE_LABEL =
  "m-0 text-center text-t4 font-medium text-fg-neutral-subtle group-data-[disabled]/attachment-dropzone:text-fg-disabled";
// 1280 미만 — 드롭존 없이 파일 선택 버튼(large · 칸 폭 · 앞 아이콘)
export const PICK_NARROW = "w-full lg:hidden";
