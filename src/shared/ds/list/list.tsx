import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Slot, Slottable } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useExpandMotion } from "@/shared/ds/accordion";
import { Checkmark, type CheckmarkProps } from "@/shared/ds/checkbox";
import {
  Radiomark,
  ignoreRadioJumpKeys,
  submitOnRadioEnter,
  type RadiomarkProps,
} from "@/shared/ds/radio-group";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { Switchmark, type SwitchmarkProps } from "@/shared/ds/switch";

import {
  LIST_EXPAND_SLOT,
  LIST_MARK_NO_SCALE,
  listActionVariants,
  listBackgroundVariants,
  listBodyVariants,
  listContentVariants,
  listControlVariants,
  listDetailVariants,
  listDividerVariants,
  listExpandButtonVariants,
  listExpandIconVariants,
  listHeaderVariants,
  listItemVariants,
  listPrefixVariants,
  listSuffixVariants,
  listTileVariants,
  listTitleVariants,
  listVariants,
} from "./list-variants";

// 구조 · 크기 · 상태 · 하위 줄은 list-variants.ts 머리 주석과 groo-design specs/components/list.yaml · list-header.yaml 이 정한다.
//
// 줄의 종류 — 보기만 하는 줄(ListItem) · 누르는 줄(ListButtonItem) · 링크 줄(ListLinkItem) · 컨트롤 줄(ListSwitchItem · ListCheckItem ·
// ListRadioItem). 누르는 줄만 호버 · 누름 · 포커스를 가진다. 화면을 옮기는 줄에만 오른쪽 화살표를 단다.
// 한 줄 안에서 따로 누르는 것(줄 자체 · 작은 버튼 · 메뉴)은 셋까지다 — 넷부터는 줄을 나누거나 상세 화면으로 옮긴다.
// 컨트롤 줄에는 따로 누르는 버튼을 같이 넣지 않는다(suffix 를 받지 않는다) — 약관처럼 따로 볼 내용은 제목 안의 링크로 두고,
// 그 링크를 눌러도 줄의 값이 바뀌지 않게 부르는 쪽이 막는다.
// 하나 고르기(ListRadioGroup)와 여럿 고르기(ListCheckGroup)는 묶음에 이름(aria-label · aria-labelledby)이 필수다 — 타입이 막는다.
// 한 묶음에서 라디오와 체크를 섞지 않고, 하나 고르기는 두 줄 이상으로 둔다(부르는 쪽 규칙 — list.md Guidelines).
// 체크 · 라디오 줄의 Enter 는 폼을 제출한다 — 체크 줄은 Checkmark, 라디오 줄은 묶음(submitOnRadioEnter)이 처리한다(2026-10-08).

type Align = NonNullable<VariantProps<typeof listContentVariants>["align"]>;
type Nest = NonNullable<VariantProps<typeof listContentVariants>["nest"]>;

type ItemBase = {
  title: React.ReactNode;
  detail?: React.ReactNode;
  prefix?: React.ReactNode;
  /**
   * 뒤 붙이개 — 글 · 금액 · 화살표 · 컨트롤 · 작은 버튼. 값 + 조작 요소는 Fragment(`<>값<ChevronRight/></>`)로 넘긴다 —
   * 좁은 줄에서 값만 본문 아래로 내려가고 꺾쇠는 줄 끝에 남는다. 한 요소로 싸 넘기거나 값에 svg 를 붙이면 값까지 줄 끝에 남는다
   */
  suffix?: React.ReactNode;
  /**
   * 뒤 붙이개를 글 값으로 다룬다 — 요소(앞 점 + 이름 같은 인라인 묶음)로 넘겨도 글 값처럼 좁은 줄에서 줄을 바꾸고 줄 끝에서 끊는다.
   * 기본은 글(string · number)만 글 값, 요소는 줄지 않는 덩어리다
   */
  suffixText?: boolean;
  /** 새 알림처럼 주목이 필요한 줄 — 옅은 브랜드 바탕(list.yaml highlight) */
  highlighted?: boolean;
  /** 맞춤 — 기본 center. 제목이 두 줄을 넘거나 설명이 길면 top. 한 목록 안에서는 줄마다 섞지 않는다 */
  align?: Align;
};

// 값 + 꺾쇠를 Fragment 로 넘긴 뒤 붙이개 — 글 조각을 span 으로 감싸 좁은 줄에서 값만 따로 놓을 수 있게 한다(글 조각은 격자 자리를 못 받는다).
// 글 하나로 넘긴 값은 금액이면 쉼표 뒤 줄바꿈 자리(withCommaBreaks)만 건다
function mixedSuffix(suffix: React.ReactNode): React.ReactNode {
  if (React.isValidElement(suffix) && suffix.type === React.Fragment) {
    const kids = React.Children.toArray(
      (suffix.props as { children?: React.ReactNode }).children,
    );
    return kids.map((k, i) =>
      typeof k === "string" || typeof k === "number" ? (
        <span key={i}>{withCommaBreaks(String(k))}</span>
      ) : (
        k
      ),
    );
  }
  return withCommaBreaks(suffix);
}

const has = (node: React.ReactNode) => node != null && node !== false;
const hl = (highlighted?: boolean) => (highlighted ? "highlighted" : "none");

// 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로(Button 과 같은 식) — 줄은 폭 ÷ 4 가 커서 세로로는 2px 보다 덜 준다.
// 키보드(Space)로 눌러도 :active 가 걸리므로 keydown 에서도 잰다. 줄(item)에 달고 콘텐츠 층이 물려받는다.
function measurePress(el: HTMLElement) {
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}

function withPress(
  props: React.HTMLAttributes<HTMLElement>,
): React.HTMLAttributes<HTMLElement> {
  return {
    ...props,
    onPointerDown: (e) => {
      measurePress(e.currentTarget);
      // 누르는 동안 콘텐츠 층(누르는 영역)이 줄어 가장자리를 누른 포인터가 영역 밖에 남아도 click 이 그 줄로 가게 잡아 둔다.
      // 마우스 · 펜만 — 터치는 브라우저가 처음 누른 요소에 이미 잡는다
      const target = e.target as Element;
      if (e.pointerType !== "touch" && target.closest("[data-list-action]"))
        target.setPointerCapture?.(e.pointerId);
      props.onPointerDown?.(e);
    },
    onKeyDown: (e) => {
      measurePress(e.currentTarget);
      props.onKeyDown?.(e);
    },
  };
}

// 줄의 태그 — 목록(ul) 안에서는 li, 묶음(radiogroup · fieldset) 안에서는 div
const ListRowTag = React.createContext<"li" | "div">("li");

// 하위 줄인가 — ListParentItem 의 하위 줄 묶음 안이면 "child"(부모의 제목 자리 104 에서 시작)
const ListNestContext = React.createContext<"none" | "child">("none");

type ItemRadius = {
  /** 누름 · 호버 바탕의 모서리(기본 radius-r2_5 10) — 카드 안에서는 카드 모서리 − 카드 가장자리에서 바탕까지 거리(동심 모서리) */
  itemRadius?: string;
};
const radiusStyle = (
  itemRadius: string | undefined,
  style: React.CSSProperties | undefined,
) =>
  itemRadius
    ? ({ ...style, "--list-item-radius": itemRadius } as React.CSSProperties)
    : style;

type TextsProps = Pick<ItemBase, "title" | "detail"> & {
  disabled?: boolean;
  highlighted?: boolean;
};

// 제목 + 설명
function Texts({ title, detail, disabled, highlighted }: TextsProps) {
  // 제목의 낱말 폭 잣대 — 제목이 요소(배지 · 강조가 섞인 조각)여도 쓰도록 렌더된 글을 data-ruler 로 옮긴다(list-variants 의 ruler).
  // 글이 같으면 쓰지 않는다 — 렌더마다 DOM 을 건드리지 않고 글이 바뀔 때만 한 번 쓴다(list.test.tsx 가 MutationObserver 로 잠근다)
  const titleRef = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const el = titleRef.current;
    const text = el?.textContent ?? "";
    if (el && el.dataset.ruler !== text) el.dataset.ruler = text;
  });
  return (
    <>
      <span
        data-slot="list-title"
        ref={titleRef}
        className={listTitleVariants({ disabled: !!disabled, ruler: true })}
      >
        {title}
      </span>
      {has(detail) && (
        <span
          data-slot="list-detail"
          className={listDetailVariants({
            disabled: !!disabled,
            highlighted: !!highlighted,
          })}
        >
          {detail}
        </span>
      )}
    </>
  );
}

type RowProps = Pick<
  ItemBase,
  "prefix" | "suffix" | "suffixText" | "highlighted" | "align"
> & {
  as?: "li" | "div";
  itemRef?: React.Ref<HTMLElement>;
  /** 줄(item)에 주는 속성 — className · 핸들러 */
  itemProps?: React.HTMLAttributes<HTMLElement>;
  nest: Nest;
  /** 앞 붙이개 앞의 것 — 부모 줄의 꺾쇠 단추 · 빈 자리 */
  leading?: React.ReactNode;
  disabled?: boolean;
  /** 끌 수 없는 켬 — 줄은 누르지 못하지만(막힌 칸과 같다) 글 · 앞 붙이개 색은 보통 줄 그대로다 */
  locked?: boolean;
  /** 누르는 줄 — 누르는 순간 축소 기준 길이를 잰다 */
  pressable?: boolean;
  /** 컨트롤 줄 — 콘텐츠 층이 라벨이라 줄 어디를 눌러도 끼운 컨트롤이 바뀐다 */
  control?: { htmlFor: string };
  /** 본문 — 보기만 하는 줄은 글 칸, 누르는 줄은 버튼 · 링크 */
  children: React.ReactNode;
};

// 줄의 짜임 — item(li · div) > 바탕 층(span) + 콘텐츠 층(div · label) > 앞 · 본문 · 뒤
function Row({
  as = "li",
  itemRef,
  itemProps,
  prefix,
  suffix,
  suffixText,
  highlighted,
  align,
  nest,
  leading,
  disabled,
  locked,
  pressable,
  control,
  children,
}: RowProps) {
  const Item = as as React.ElementType;
  const { className, ...rest } = itemProps ?? {};
  // 글(string · number)로 넘긴 값은 줄 끝에서 끊고, 요소(금액 · 화살표 · 컨트롤)는 줄지 않는다(Q-001)
  const suffixValue =
    suffixText || typeof suffix === "string" || typeof suffix === "number"
      ? "text"
      : "node";
  const parts = (
    <>
      {leading}
      {has(prefix) && (
        <span
          data-slot="list-prefix"
          className={listPrefixVariants({ disabled: !!disabled })}
        >
          {prefix}
        </span>
      )}
      {children}
      {has(suffix) && (
        <span
          data-slot="list-suffix"
          data-value={suffixValue}
          className={listSuffixVariants({
            disabled: !!disabled,
            highlighted: !!highlighted,
            value: suffixValue,
          })}
        >
          {mixedSuffix(suffix)}
        </span>
      )}
    </>
  );
  return (
    <Item
      ref={itemRef}
      data-slot="list-item"
      className={cn(listItemVariants(), className)}
      {...(pressable ? withPress(rest) : rest)}
    >
      <span
        aria-hidden
        data-slot="list-background"
        className={listBackgroundVariants({ highlight: hl(highlighted) })}
      />
      {control ? (
        <label
          htmlFor={control.htmlFor}
          data-slot="list-content"
          data-list-action=""
          data-disabled={disabled || locked ? "" : undefined}
          className={cn(
            listContentVariants({ align, nest }),
            listControlVariants(),
          )}
        >
          {parts}
        </label>
      ) : (
        <div
          data-slot="list-content"
          className={listContentVariants({ align, nest })}
        >
          {parts}
        </div>
      )}
    </Item>
  );
}

export interface ListProps
  extends React.HTMLAttributes<HTMLUListElement>, ItemRadius {}

// 목록 — 줄을 세로로 잇는다. 목록 제목이 있으면 aria-labelledby 로 잇는다
const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ className, itemRadius, style, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="list"
      className={cn(listVariants(), className)}
      style={radiusStyle(itemRadius, style)}
      {...props}
    />
  ),
);
List.displayName = "List";

export interface ListItemProps
  extends
    ItemBase,
    Omit<React.LiHTMLAttributes<HTMLLIElement>, "title" | "prefix"> {
  /**
   * 줄 요소 — 기본 li. 한 줄 아래에 막대 같은 것을 덧붙여 li 하나로 묶을 때(부르는 쪽이 li 를 감싼다) div 로 둔다.
   * 목록이 줄 수만큼 열리지 않게 ul 하나 · li 하나를 지키려는 것이다.
   */
  as?: "li" | "div";
}

// 보기만 하는 줄 — 누르지 않는다(호버 · 누름 · 포커스가 없다). 키-값 · 안내 줄
const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  (
    {
      title,
      detail,
      prefix,
      suffix,
      suffixText,
      align,
      highlighted,
      as,
      ...props
    },
    ref,
  ) => {
    const nest = React.useContext(ListNestContext);
    return (
      <Row
        as={as}
        itemRef={ref as React.Ref<HTMLElement>}
        itemProps={props}
        prefix={prefix}
        suffix={suffix}
        suffixText={suffixText}
        align={align}
        highlighted={highlighted}
        nest={nest}
      >
        <span data-slot="list-body" className={listBodyVariants()}>
          <Texts title={title} detail={detail} highlighted={highlighted} />
        </span>
      </Row>
    );
  },
);
ListItem.displayName = "ListItem";

export interface ListButtonItemProps
  extends
    ItemBase,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "title" | "prefix" | "children"
    > {
  rootProps?: React.LiHTMLAttributes<HTMLLIElement>;
  /** 줄 요소 — 기본 li. 막대 같은 것을 덧붙여 li 하나로 묶을 때 div(ListItem 과 같다) */
  as?: "li" | "div";
}

// 누르는 줄 — 줄 전체가 버튼. 화면을 옮기면 suffix 에 오른쪽 화살표를 둔다
const ListButtonItem = React.forwardRef<HTMLButtonElement, ListButtonItemProps>(
  (
    {
      className,
      title,
      detail,
      prefix,
      suffix,
      suffixText,
      align,
      highlighted,
      disabled,
      rootProps,
      as,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const nest = React.useContext(ListNestContext);
    return (
      <Row
        as={as}
        itemProps={rootProps}
        prefix={prefix}
        suffix={suffix}
        suffixText={suffixText}
        align={align}
        highlighted={highlighted}
        nest={nest}
        disabled={disabled}
        pressable
      >
        <button
          ref={ref}
          type={type}
          disabled={disabled}
          data-slot="list-body"
          data-list-action=""
          data-disabled={disabled ? "" : undefined}
          className={cn(listActionVariants(), listBodyVariants(), className)}
          {...props}
        >
          <Texts
            title={title}
            detail={detail}
            disabled={disabled}
            highlighted={highlighted}
          />
        </button>
      </Row>
    );
  },
);
ListButtonItem.displayName = "ListButtonItem";

export interface ListLinkItemProps
  extends
    ItemBase,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "title" | "prefix"> {
  asChild?: boolean;
  rootProps?: React.LiHTMLAttributes<HTMLLIElement>;
}

// 링크 줄 — 줄 전체가 링크. asChild 면 라우터의 Link 를 자식으로 — 제목 · 설명은 그 링크 안에 그려진다.
// 링크 줄은 막지 않는다(disabled 가 없다) — 갈 수 없는 곳이면 줄을 빼거나 누르는 줄(ListButtonItem)로 바꿔 막는다
const ListLinkItem = React.forwardRef<HTMLAnchorElement, ListLinkItemProps>(
  (
    {
      className,
      title,
      detail,
      prefix,
      suffix,
      align,
      highlighted,
      asChild = false,
      rootProps,
      children,
      ...props
    },
    ref,
  ) => {
    const nest = React.useContext(ListNestContext);
    const actionProps = {
      "data-slot": "list-body",
      "data-list-action": "",
      className: cn(listActionVariants(), listBodyVariants(), className),
      ...props,
    };
    return (
      <Row
        itemProps={rootProps}
        prefix={prefix}
        suffix={suffix}
        align={align}
        highlighted={highlighted}
        nest={nest}
        pressable
      >
        {asChild ? (
          <Slot ref={ref} {...actionProps}>
            <Slottable>{children}</Slottable>
            <Texts title={title} detail={detail} highlighted={highlighted} />
          </Slot>
        ) : (
          <a ref={ref} {...actionProps}>
            <Texts title={title} detail={detail} highlighted={highlighted} />
          </a>
        )}
      </Row>
    );
  },
);
ListLinkItem.displayName = "ListLinkItem";

// ── 하위 줄 ─────────────────────────────────────────────────

type ListParentFoldable = {
  /** 접는 줄(기본) — 꺾쇠 단추로 하위 줄을 접고 편다 */
  collapsible?: true;
  /** 꺾쇠 단추의 고정 이름 — "{카테고리} 하위 카테고리". 접는 줄은 하위가 없어도 준다(필수 — 빠뜨리면 타입 오류) */
  expandLabel: string;
  /** 하위 줄 펼침 — 쥐고 다룰 때 */
  open?: boolean;
  /** 처음 펼침 — 화면이 정한다(카테고리는 모두 펼친 채 연다) */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ListParentFixed = {
  /** 늘 펼친 화면(편집 모드) — 꺾쇠 자리는 같은 폭으로 비우고(aria-hidden) 하위 줄은 늘 보이며 aria-expanded 가 없다(Q-002) */
  collapsible: false;
  expandLabel?: never;
  open?: never;
  defaultOpen?: never;
  onOpenChange?: never;
};

export type ListParentItemProps = ListButtonItemProps &
  (ListParentFoldable | ListParentFixed) & {
    /** 하위 줄(ListButtonItem …) */
    children?: React.ReactNode;
  };

// 하위 줄을 접는 부모 줄 — li > 줄(바탕 층 · 콘텐츠 층) + 하위 줄 묶음(ul). 줄을 누르면 onClick(편집), 꺾쇠 단추는 펼치고 접기만.
// 한 목록에 ListParentItem 이 있으면 그 목록의 맨 위 단계 줄은 모두 ListParentItem 으로 둔다 — 타일 자리를 맞춘다(자식이 없으면 꺾쇠 자리를 비운다). 늘 펼친 편집 화면은 collapsible={false}.
// Tab 은 꺾쇠 단추 → 그 줄 → 펼친 하위 줄 → 다음 부모의 꺾쇠 단추(DOM 순서)
const ListParentItem = React.forwardRef<HTMLButtonElement, ListParentItemProps>(
  (
    {
      className,
      title,
      detail,
      prefix,
      suffix,
      align,
      highlighted,
      disabled,
      rootProps,
      type = "button",
      collapsible = true,
      expandLabel,
      open: openProp,
      defaultOpen = false,
      onOpenChange,
      children,
      ...props
    },
    ref,
  ) => {
    const hasChildren = React.Children.toArray(children).length > 0;
    const foldable = hasChildren && collapsible;
    const [inner, setInner] = React.useState(defaultOpen);
    // 늘 펼친 화면(collapsible={false})은 하위 줄이 늘 보인다
    const open = foldable ? (openProp ?? inner) : hasChildren;
    const setOpen = (next: boolean) => {
      if (openProp === undefined) setInner(next);
      onOpenChange?.(next);
    };
    const subId = React.useId();
    const { ref: motionRef, hidden } = useExpandMotion<HTMLUListElement>(open);
    const { className: rootClassName, ...rootRest } = rootProps ?? {};
    return (
      <li
        data-slot="list-parent-item"
        className={cn("flex w-full flex-col", rootClassName)}
        {...rootRest}
      >
        <Row
          as="div"
          prefix={prefix}
          suffix={suffix}
          align={align}
          highlighted={highlighted}
          nest="parent"
          disabled={disabled}
          pressable
          leading={
            foldable ? (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={subId}
                aria-label={expandLabel}
                data-slot="list-expand-button"
                data-state={open ? "open" : "closed"}
                className={listExpandButtonVariants()}
                onClick={() => setOpen(!open)}
              >
                <ChevronRight
                  aria-hidden
                  strokeWidth={2}
                  className={listExpandIconVariants({ open })}
                />
              </button>
            ) : (
              <span
                aria-hidden
                data-slot="list-expand-slot"
                className={LIST_EXPAND_SLOT}
              />
            )
          }
        >
          <button
            ref={ref}
            type={type}
            disabled={disabled}
            data-slot="list-body"
            data-list-action=""
            data-disabled={disabled ? "" : undefined}
            className={cn(listActionVariants(), listBodyVariants(), className)}
            {...props}
          >
            <Texts
              title={title}
              detail={detail}
              disabled={disabled}
              highlighted={highlighted}
            />
          </button>
        </Row>
        {hasChildren && (
          <ListNestContext.Provider value="child">
            <ul
              ref={motionRef}
              id={subId}
              data-slot="list-sub-list"
              data-state={open ? "open" : "closed"}
              hidden={hidden}
              className={listVariants()}
            >
              {children}
            </ul>
          </ListNestContext.Provider>
        )}
      </li>
    );
  },
);
ListParentItem.displayName = "ListParentItem";

// ── 컨트롤 줄 ───────────────────────────────────────────────

type ControlRowProps = ItemBase & {
  rootProps?: React.HTMLAttributes<HTMLElement>;
};

// 컨트롤 줄의 짜임 — item(묶음 안에서는 div) > 라벨(콘텐츠 층 · 누르는 영역) > 앞 · 본문 · 뒤. 제목 + 설명이 컨트롤의 이름이다
function ControlRow({
  title,
  detail,
  prefix,
  suffix,
  align,
  highlighted,
  disabled,
  locked,
  rootProps,
  htmlFor,
}: ControlRowProps & {
  disabled?: boolean;
  locked?: boolean;
  htmlFor: string;
}) {
  const as = React.useContext(ListRowTag);
  const nest = React.useContext(ListNestContext);
  return (
    <Row
      as={as}
      itemProps={rootProps}
      prefix={prefix}
      suffix={suffix}
      align={align}
      highlighted={highlighted}
      nest={nest}
      disabled={disabled}
      locked={locked}
      pressable
      control={{ htmlFor }}
    >
      <span data-slot="list-body" className={listBodyVariants()}>
        <Texts
          title={title}
          detail={detail}
          disabled={disabled}
          highlighted={highlighted}
        />
      </span>
    </Row>
  );
}

// 컨트롤에도 data-list-action 을 단다 — 키보드(Space)로 누르면 :active 가 라벨이 아니라 컨트롤에 걸린다.
// 줄이 줄면 컨트롤도 함께 줄므로 컨트롤 자신의 누름 축소는 끈다(LIST_MARK_NO_SCALE)
const markProps = { "data-slot": "list-mark", "data-list-action": "" };

export interface ListSwitchItemProps
  extends
    Omit<SwitchmarkProps, "title" | "prefix" | "size" | "children">,
    Omit<ControlRowProps, "suffix"> {}

// 스위치 줄 — 스위치는 뒤에, 제목 16 줄이라 32(Switch 스펙). 바로 적용되는 설정에만 쓴다
const ListSwitchItem = React.forwardRef<
  React.ComponentRef<typeof Switchmark>,
  ListSwitchItemProps
>(
  (
    {
      title,
      detail,
      prefix,
      align,
      highlighted,
      rootProps,
      className,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const autoId = React.useId();
    const sid = id ?? autoId;
    return (
      <ControlRow
        title={title}
        detail={detail}
        prefix={prefix}
        align={align}
        highlighted={highlighted}
        rootProps={rootProps}
        disabled={disabled}
        htmlFor={sid}
        suffix={
          <Switchmark
            ref={ref}
            id={sid}
            size="32"
            disabled={disabled}
            className={cn(LIST_MARK_NO_SCALE, className)}
            {...markProps}
            {...props}
          />
        }
      />
    );
  },
);
ListSwitchItem.displayName = "ListSwitchItem";

// 마크 자리 — 체크는 앞(기본) · 뒤, 라디오는 뒤(기본) · 앞. 앞에 두면 그 자리를 차지하므로 prefix 를 같이 줄 수 없다(타입이 막는다)
type MarkPlacement<Default extends "prefix" | "suffix"> =
  Default extends "prefix"
    ? | { markPosition?: "prefix"; prefix?: never }
      | { markPosition: "suffix"; prefix?: React.ReactNode }
    : | { markPosition?: "suffix"; prefix?: React.ReactNode }
      | { markPosition: "prefix"; prefix?: never };

// 앞에 체크를 둔 줄은 내용 줄(거래 · 이체)의 고르기 모드에도 쓴다 — 체크 다음에 앞 타일(prefix)을 잇고, 뒤에 값(suffix, 금액)을 보이기만 한다.
// 따로 누르는 것은 두지 않는다(값은 글 · 금액만). 체크가 뒤에 있으면(markPosition "suffix") 지금처럼 뒤 붙이개는 체크 하나다
export type ListCheckItemProps = Omit<
  CheckmarkProps,
  "title" | "prefix" | "size" | "shape" | "children"
> &
  Omit<ControlRowProps, "suffix" | "prefix"> & {
    /**
     * 끌 수 없는 켬(숨길 수 없는 기본 캘린더) — 칸만 막힌 켬(`checked` + `disabled`, 포커스에서 빠진다)이고 줄은 누르지 못하지만,
     * 제목 · 앞 붙이개(색 점 · 타일) · 배지는 보통 줄 색 그대로다. 줄 전체를 막는 `disabled` 를 쓰지 않는다(제목이 회색이면 "꺼진 것" 으로
     * 읽힌다). 끌 수 없는 까닭은 배지가 말한다(list.md "끌 수 없는 켬 — 칸만 막는다", 2026-10-29 사용자 결정 B)
     */
    locked?: boolean;
  } & (
    | {
        markPosition?: "prefix";
        prefix?: React.ReactNode;
        suffix?: React.ReactNode;
        suffixValue?: never;
      }
    | {
        markPosition: "suffix";
        prefix?: React.ReactNode;
        suffix?: never;
        /** 뒤 값 글자 — 체크를 뒤에 둘 때 체크 앞에 놓인다(건수 · 개수). 값 + 조작 요소는 Fragment 로 넘기는 규칙 그대로 */
        suffixValue?: React.ReactNode;
      }
  );

// 체크 줄 — 여럿 고르기. 체크 24 를 앞(기본)이나 뒤에. 저장해야 적용되는 선택에 쓴다
const ListCheckItem = React.forwardRef<
  React.ComponentRef<typeof Checkmark>,
  ListCheckItemProps
>(
  (
    {
      title,
      detail,
      prefix,
      align,
      highlighted,
      rootProps,
      markPosition = "prefix",
      suffix,
      suffixValue,
      className,
      id,
      disabled,
      locked,
      ...props
    },
    ref,
  ) => {
    const autoId = React.useId();
    const cid = id ?? autoId;
    const mark = (
      <Checkmark
        ref={ref}
        id={cid}
        size="large"
        className={cn(LIST_MARK_NO_SCALE, className)}
        {...markProps}
        {...props}
        {...(locked ? { checked: true, disabled: true } : { disabled })}
      />
    );
    return (
      <ControlRow
        title={title}
        detail={detail}
        prefix={
          markPosition === "prefix" ? (
            has(prefix) ? (
              <span className="flex items-center gap-x3">
                {mark}
                {prefix}
              </span>
            ) : (
              mark
            )
          ) : (
            prefix
          )
        }
        suffix={
          markPosition === "suffix" ? (
            suffixValue != null && suffixValue !== false ? (
              <>
                {suffixValue}
                {mark}
              </>
            ) : (
              mark
            )
          ) : (
            suffix
          )
        }
        align={align}
        highlighted={highlighted}
        rootProps={rootProps}
        disabled={disabled}
        locked={locked}
        htmlFor={cid}
      />
    );
  },
);
ListCheckItem.displayName = "ListCheckItem";

// 묶음의 이름 — 둘 중 하나는 필수다(보조 기술이 묶음을 무엇으로 읽는지)
type GroupName =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

export type ListRadioGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  "aria-label" | "aria-labelledby"
> &
  ItemRadius &
  GroupName;

// 하나 고르기 목록 — 라디오 묶음(role=radiogroup, 이름 필수). 줄은 li 대신 div 다. Enter 는 폼을 제출한다(Radio 와 같다)
const ListRadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  ListRadioGroupProps
>(
  (
    { className, itemRadius, style, onKeyDown, onKeyDownCapture, ...props },
    ref,
  ) => (
    <ListRowTag.Provider value="div">
      <RadioGroupPrimitive.Root
        ref={ref}
        data-slot="list"
        className={cn(listVariants(), className)}
        style={radiusStyle(itemRadius, style)}
        {...props}
        onKeyDown={submitOnRadioEnter(onKeyDown)}
        onKeyDownCapture={ignoreRadioJumpKeys(onKeyDownCapture)}
      />
    </ListRowTag.Provider>
  ),
);
ListRadioGroup.displayName = "ListRadioGroup";

export type ListCheckGroupProps = Omit<
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "aria-label" | "aria-labelledby"
> &
  ItemRadius &
  GroupName;

// 여럿 고르기 묶음 — fieldset(role=group, 이름 필수). 체크 줄을 담는다. 줄은 li 대신 div 다(SEED 와 같다)
const ListCheckGroup = React.forwardRef<
  HTMLFieldSetElement,
  ListCheckGroupProps
>(({ className, itemRadius, style, ...props }, ref) => (
  <ListRowTag.Provider value="div">
    <fieldset
      ref={ref}
      data-slot="list"
      className={cn(listVariants(), "m-0 min-w-0 border-0 p-0", className)}
      style={radiusStyle(itemRadius, style)}
      {...props}
    />
  </ListRowTag.Provider>
));
ListCheckGroup.displayName = "ListCheckGroup";

export type ListRadioItemProps = Omit<
  RadiomarkProps,
  "title" | "prefix" | "size" | "children"
> &
  Omit<ControlRowProps, "suffix" | "prefix" | "rootProps"> & {
    rootProps?: React.HTMLAttributes<HTMLDivElement>;
  } & MarkPlacement<"suffix">;

// 라디오 줄 — 하나 고르기. 라디오 24 를 뒤(기본)에. ListRadioGroup 안에 둔다
const ListRadioItem = React.forwardRef<
  React.ComponentRef<typeof Radiomark>,
  ListRadioItemProps
>(
  (
    {
      title,
      detail,
      prefix,
      align,
      highlighted,
      rootProps,
      markPosition = "suffix",
      className,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const autoId = React.useId();
    const rid = id ?? autoId;
    const mark = (
      <Radiomark
        ref={ref}
        id={rid}
        size="large"
        disabled={disabled}
        className={cn(LIST_MARK_NO_SCALE, className)}
        {...markProps}
        {...props}
      />
    );
    return (
      <ControlRow
        title={title}
        detail={detail}
        prefix={markPosition === "prefix" ? mark : prefix}
        suffix={markPosition === "suffix" ? mark : undefined}
        align={align}
        highlighted={highlighted}
        rootProps={rootProps}
        disabled={disabled}
        htmlFor={rid}
      />
    );
  },
);
ListRadioItem.displayName = "ListRadioItem";

// ── 선 · 제목 · 타일 ────────────────────────────────────────

export interface ListDividerProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof listDividerVariants> {}

// 줄 사이 선 — 필요할 때만(기본은 선 없음). 목록 안에서는 li, 묶음 안에서는 div. 보조 기술에 숨긴다(줄 수에 들지 않는다)
const ListDivider = React.forwardRef<HTMLElement, ListDividerProps>(
  ({ className, inset, ...props }, ref) => {
    const Item = React.useContext(ListRowTag) as React.ElementType;
    return (
      <Item
        ref={ref}
        aria-hidden
        data-slot="list-divider"
        className={cn(listDividerVariants({ inset }), className)}
        {...props}
      />
    );
  },
);
ListDivider.displayName = "ListDivider";

export interface ListHeaderProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof listHeaderVariants> {
  asChild?: boolean;
  /**
   * 제목 태그 — 기본 h2(화면 제목 아래 단계), 카드 · 대화상자 · 시트 안이면 h3(03D-007). asChild 면 자식이 태그다.
   * 오른쪽에 버튼을 두면 "div" 로 두고 제목 글만 h2 · h3 로 감싼다 — 줄 전체가 제목이면 머리말 이름이 "카테고리별 예산 전체 보기" 처럼 버튼 글과 섞인다
   * (스펙 list.md "제목 태그", 2026-10-22 · 앱 PListHeader 와 같다)
   */
  as?: "h2" | "h3" | "h4" | "div";
}

// 목록 제목 — 목록 밖, 바로 위. 오른쪽에 작은 버튼(도움말 · 전체 보기)을 둘 수 있다. 제목 글에 id 를 달고 목록의 aria-labelledby 로 잇는다.
// 버튼을 같이 두면 머리는 as="div" 로 두고 제목 글만 h2 · h3 로 감싼다(그 제목에 id) — 버튼은 제목 밖의 형제라 머리말 이름도 목록 이름도 버튼 글과 섞이지 않는다
const ListHeader = React.forwardRef<HTMLDivElement, ListHeaderProps>(
  ({ className, variant, asChild = false, as: Tag = "h2", ...props }, ref) => {
    const Comp = asChild ? Slot : Tag;
    return (
      <Comp
        ref={ref}
        data-slot="list-header"
        className={cn(listHeaderVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
ListHeader.displayName = "ListHeader";

// 내용 줄의 앞 타일 — 바탕 · 아이콘 색은 부르는 쪽이(카테고리 색)
const ListTile = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="list-tile"
    className={cn(listTileVariants(), className)}
    {...props}
  />
));
ListTile.displayName = "ListTile";

export {
  List,
  ListItem,
  ListButtonItem,
  ListLinkItem,
  ListParentItem,
  ListSwitchItem,
  ListCheckItem,
  ListCheckGroup,
  ListRadioGroup,
  ListRadioItem,
  ListDivider,
  ListHeader,
  ListTile,
};
