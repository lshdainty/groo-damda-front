import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Coins,
  Globe,
  MapPin,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { InputButton, useInputButtonSurface } from "@/shared/ds/input-button";
import {
  List,
  ListButtonItem,
  ListItem,
  ListRadioGroup,
  ListRadioItem,
} from "@/shared/ds/list";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { Skeleton } from "@/shared/ds/skeleton";
import { useTheme } from "@/shared/ui/theme-context";
import { regionOptionsWith } from "@/shared/lib";
import { DEFAULT_CURRENCY } from "@/shared/lib/groo/currency";
import {
  applyLanguageChoice,
  i18n as i18nInstance,
  readLanguageChoice,
  type LanguageChoice,
} from "@/shared/i18n";
import { useUserPreferences, useUpdateUserPreferences } from "@/features/user";

/**
 * 고를 수 있는 통화는 **서버 `SupportedCurrency` 와 같은 넷**이다(desk-back #328).
 * 자산·거래 폼의 `CURRENCIES`(14종)와 일부러 다르다 — 그쪽은 "적어 둘 수 있는 통화"
 * 전부고, 여기는 "새로 만들 때 먼저 골라 둘 통화" 라 서버가 값을 검사한다.
 * 목록이 어긋나면 화면에는 뜨는데 저장은 400 이 된다.
 */
type CurrencyKey = "KRW" | "USD" | "EUR" | "JPY";

const THEME_OPTIONS = [
  { k: "light", label: "theme.light", desc: "theme.lightDesc", Icon: Sun },
  { k: "dark", label: "theme.dark", desc: "theme.darkDesc", Icon: Moon },
  {
    k: "system",
    label: "theme.system",
    desc: "theme.systemDesc",
    Icon: Monitor,
  },
] as const;

const LANGUAGE_OPTIONS: { k: LanguageChoice; label: string }[] = [
  { k: "system", label: "language.system" },
  { k: "ko", label: "language.ko" },
  { k: "en", label: "language.en" },
];

const CURRENCY_OPTIONS: { k: CurrencyKey; label: string; symbol: string }[] = [
  { k: "KRW", label: "currency.KRW", symbol: "₩" },
  { k: "USD", label: "currency.USD", symbol: "$" },
  { k: "EUR", label: "currency.EUR", symbol: "€" },
  { k: "JPY", label: "currency.JPY", symbol: "¥" },
];

/**
 * 화면 설정(I-14 17 ~ 22) — 값 줄 넷(테마 · 언어 · 기준 지역 · 기본 통화). 줄은 지금 값을 보이고, 누르면 고르기 표면이 열려
 * 고르는 순간 바뀌고 닫힌다. 폰은 흰 면 하나(줄을 누르면 고르기 시트), 768 이상은 카드 하나 안에서 줄 뒤 Input Button
 * (1280 미만 시트 · 이상 그 칸 아래 Popover).
 */
export function AppearanceSection({ mobile }: { mobile: boolean }) {
  const { t, i18n } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const {
    data: prefs,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useUserPreferences();
  const updatePrefs = useUpdateUserPreferences();
  const isEnLang = i18n.language?.startsWith("en") ?? false;
  const [langChoice, setLangChoice] = useState<LanguageChoice>(() =>
    readLanguageChoice(i18n.language),
  );

  // 저장된 값이 목록에 없을 수도 있어(가입 후 목록 변경 등) 현재 값을 옵션에 끼워 넣는다.
  const regionOptions = regionOptionsWith(prefs?.timezone);
  const regionName = (tz: string | undefined) => {
    const o = regionOptions.find((r) => r.value === tz);
    return o ? (isEnLang ? o.en : o.ko) : undefined;
  };

  // 바꾸기 실패는 전역 알림이 아니라(요청이 silent) 여기서 고정 글 하나로 알린다. 값 글은 서버 값에서 읽으므로 이전 값으로 남는다.
  const saveFailed = () =>
    toast.error(t("prefs.saveFailed"), { id: "prefs-save-failed" });
  const savePref = (patch: Record<string, string>) =>
    updatePrefs.mutate(patch, { onError: saveFailed });

  const prefsBusy = !prefs || updatePrefs.isPending;
  const prefsState = {
    loading: isLoading,
    failed: isError,
    retrying: isRefetching,
    onRetry: () => void refetch(),
  };

  const rows = [
    <ChoiceRow
      key="theme"
      mobile={mobile}
      icon={<Sun aria-hidden />}
      title={t("theme.label")}
      value={t(`theme.${theme}`)}
    >
      {(close) => (
        <ListRadioGroup
          aria-label={t("theme.label")}
          value={theme}
          onValueChange={(v) => {
            setTheme(v as typeof theme);
            close();
          }}
        >
          {THEME_OPTIONS.map(({ k, label, desc, Icon }) => (
            <ListRadioItem
              key={k}
              value={k}
              prefix={<Icon aria-hidden />}
              title={t(label)}
              detail={t(desc)}
            />
          ))}
        </ListRadioGroup>
      )}
    </ChoiceRow>,
    <ChoiceRow
      key="language"
      mobile={mobile}
      icon={<Globe aria-hidden />}
      title={t("language.label")}
      value={t(`language.${langChoice}`)}
    >
      {(close) => (
        <ListRadioGroup
          aria-label={t("language.label")}
          value={langChoice}
          onValueChange={(v) => {
            const choice = v as LanguageChoice;
            setLangChoice(choice);
            void applyLanguageChoice(i18nInstance, choice);
            close();
          }}
        >
          {LANGUAGE_OPTIONS.map(({ k, label }) => (
            <ListRadioItem key={k} value={k} title={t(label)} />
          ))}
        </ListRadioGroup>
      )}
    </ChoiceRow>,
    <ChoiceRow
      key="region"
      mobile={mobile}
      icon={<MapPin aria-hidden />}
      title={t("region.label")}
      detail={t("region.desc")}
      scrollFog
      value={regionName(prefs?.timezone)}
      disabled={prefsBusy}
      failedText={t("prefs.regionLoadError")}
      {...prefsState}
    >
      {(close) => (
        <ListRadioGroup
          aria-label={t("region.label")}
          value={prefs?.timezone ?? ""}
          onValueChange={(tz) => {
            close();
            if (tz && tz !== prefs?.timezone) savePref({ timezone: tz });
          }}
        >
          {regionOptions.map((o) => (
            <ListRadioItem
              key={o.value}
              value={o.value}
              title={isEnLang ? o.en : o.ko}
            />
          ))}
        </ListRadioGroup>
      )}
    </ChoiceRow>,
    <ChoiceRow
      key="currency"
      mobile={mobile}
      icon={<Coins aria-hidden />}
      title={t("currency.label")}
      detail={t("currency.desc")}
      value={t(
        `currency.${(prefs?.defaultCurrency ?? DEFAULT_CURRENCY) as CurrencyKey}`,
      )}
      // 서버 값이 오기 전에는 값 글을 비워 둔다(원화로 그리지 않는다) — 로딩 중 Skeleton · 실패 안내가 대신한다
      showValue={!!prefs}
      disabled={prefsBusy}
      failedText={t("prefs.currencyLoadError")}
      {...prefsState}
    >
      {(close) => (
        <ListRadioGroup
          aria-label={t("currency.label")}
          value={prefs?.defaultCurrency ?? DEFAULT_CURRENCY}
          onValueChange={(c) => {
            close();
            if (c !== prefs?.defaultCurrency) savePref({ defaultCurrency: c });
          }}
        >
          {CURRENCY_OPTIONS.map((c) => (
            <ListRadioItem
              key={c.k}
              value={c.k}
              prefix={
                <span
                  aria-hidden
                  className="inline-grid size-[22px] place-items-center font-sans text-t5 font-bold text-fg-neutral"
                >
                  {c.symbol}
                </span>
              }
              title={t(c.label)}
              detail={c.k}
            />
          ))}
        </ListRadioGroup>
      )}
    </ChoiceRow>,
  ];

  if (mobile) {
    return (
      <div className="pb-[calc(var(--spacing-x6)+env(safe-area-inset-bottom))] pt-x3">
        <List aria-label={t("sections.appearance.label")}>{rows}</List>
      </div>
    );
  }
  return (
    <Card body="list">
      <List aria-label={t("sections.appearance.label")}>{rows}</List>
    </Card>
  );
}

/**
 * 값 줄 하나 — 아이콘 22 · 제목 · (설명) · 지금 값. 폰은 줄 전체가 버튼이고 고르기 시트가 열린다(꺾쇠 없음 — 화면을 옮기지 않는다).
 * 768 이상은 줄을 누르지 않고 뒤 Input Button 이 누르는 자리 — 1280 미만 시트 · 이상 칸 아래 Popover.
 * 서버 값(지역 · 통화)이 오기 전에는 값 자리 Skeleton + 누름 막힘, 실패하면 설명 자리에 안내 + [다시 시도].
 */
function ChoiceRow({
  mobile,
  icon,
  title,
  detail,
  value,
  showValue = true,
  disabled,
  scrollFog,
  loading,
  failed,
  failedText,
  retrying,
  onRetry,
  children,
}: {
  mobile: boolean;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  value?: string;
  showValue?: boolean;
  disabled?: boolean;
  loading?: boolean;
  failed?: boolean;
  failedText?: string;
  retrying?: boolean;
  onRetry?: () => void;
  /** 목록이 길어 스크롤되는 고르기(지역 18개)만 끝 흐림을 켠다 — 위 20 · 아래 80(스펙 overlayBody) */
  scrollFog?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const { t: tDs } = useTranslation("ds");
  const wide = useInputButtonSurface() === "popover";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const body = <div className="-mx-x6">{children(close)}</div>;
  const align = detail || failed ? "top" : "center";
  const text = failed ? failedText : detail;

  if (failed) {
    return (
      <ListItem
        align="top"
        prefix={icon}
        title={title}
        detail={text}
        suffix={
          <Button
            variant="neutralWeak"
            size="small"
            className="-my-[7px]"
            loading={retrying}
            onClick={onRetry}
          >
            {tDs("common.retry")}
          </Button>
        }
      />
    );
  }

  const suffixValue = loading ? (
    <Skeleton radius="4" text="t5" className="w-16" />
  ) : showValue ? (
    value
  ) : undefined;

  if (mobile) {
    return (
      <>
        <ListButtonItem
          align={align}
          prefix={icon}
          title={title}
          detail={detail}
          suffix={suffixValue}
          suffixText
          disabled={disabled || loading}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        />
        <BottomSheet open={open} onOpenChange={setOpen}>
          <BottomSheetContent title={title}>
            <BottomSheetBody scrollFog={scrollFog}>{body}</BottomSheetBody>
          </BottomSheetContent>
        </BottomSheet>
      </>
    );
  }

  const trigger = (
    <InputButton
      size="responsive"
      aria-label={title}
      value={showValue && !loading ? value : undefined}
      suffixIcon={<ChevronDown aria-hidden />}
      disabled={disabled || loading}
      onClick={wide ? undefined : () => setOpen(true)}
      // 보이는 줄 높이는 다른 줄(46)과 같게 — 1280 이상은 상자(medium 40)의 위아래를 줄 여백에 겹친다. 미만(large 52)은 상자가 줄보다 커서
      // 겹치면 이웃 줄의 상자와 맞닿으므로 겹치지 않고 줄이 상자를 따라 자란다.
      rootClassName="w-[200px] lg:-my-[9px]"
    />
  );
  return (
    <>
      <ListItem
        align={align}
        prefix={icon}
        title={title}
        detail={detail}
        suffix={
          loading ? (
            <Skeleton radius="4" className="-my-[9px] h-x10 w-[200px]" />
          ) : wide ? (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
              <PopoverContent aria-label={title} align="end">
                <PopoverBody scrollFog={scrollFog}>{body}</PopoverBody>
              </PopoverContent>
            </Popover>
          ) : (
            trigger
          )
        }
      />
      {!wide && (
        <BottomSheet open={open} onOpenChange={setOpen}>
          <BottomSheetContent title={title}>
            <BottomSheetBody scrollFog={scrollFog}>{body}</BottomSheetBody>
          </BottomSheetContent>
        </BottomSheet>
      )}
    </>
  );
}
