import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Apple, Copy, Download, Smartphone } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Divider } from "@/shared/ds/divider";
import { useSnackbar } from "@/shared/ds/snackbar";

/**
 * 앱 받기 — 로그인 없이 열리는 공개 페이지.
 *
 * <p>스토어에 올리지 않고 서버에서 직접 받아 설치한다. 파일은 nginx 가 정적으로
 * 내보내고(`/download/`), 이 페이지는 그 옆의 `version.json` 을 읽어 최신 버전을 보여 준다.
 *
 * <p>iOS 는 서명 없이 빌드한 IPA 라 받는 사람이 자기 Apple ID 로 서명해 넣어야 한다.
 * 일반 사용자에게 권할 경로가 아니라서 안내만 하고 웹으로 유도한다.
 *
 * <p>셸 밖 화면 — 모든 폭에서 흰 면 하나, 가운데 한 칸(최대 512)(I-12 5-A).
 */

const DOWNLOAD_BASE = "/download";

type AppRelease = {
  version: string;
  buildNumber: number;
  releasedAt: string;
  android: string;
  ios: string;
};

export const DownloadPage = () => {
  const { t } = useTranslation("download");
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [failed, setFailed] = useState(false);
  const snackbar = useSnackbar();

  // AltStore 에 붙여 넣을 주소. 이 페이지가 어디에 떠 있든 그 호스트를 그대로 쓴다.
  const sourceUrl = `${window.location.origin}${DOWNLOAD_BASE}/altstore.json`;

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl);
      snackbar.show({ message: t("ios.copiedToast") });
    } catch {
      // 클립보드가 막힌 브라우저(비 HTTPS 등) — 주소는 눈에 보이니 직접 골라 복사하면 된다.
      snackbar.show({ message: t("ios.copyFailed"), tone: "critical" });
    }
  };

  // 셸 밖이라 셸이 문서 제목을 정하지 않는다 — 이 화면이 둔다.
  const docTitle = t("docTitle");
  useEffect(() => {
    document.title = docTitle;
  }, [docTitle]);

  useEffect(() => {
    // 배포 전이거나 파일이 아직 없으면 조용히 접는다 — 버전을 감추고 내려받기 버튼을 막는다.
    fetch(`${DOWNLOAD_BASE}/version.json`, { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d: AppRelease) => setRelease(d))
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="flex min-h-dvh justify-center bg-bg-layer-default px-x6 pt-x12 pb-x10">
      <main className="w-full max-w-[32rem] break-keep [overflow-wrap:break-word]">
        <header className="text-center">
          <h1 className="text-screen-title text-fg-neutral">{t("title")}</h1>
          <p
            aria-live="polite"
            className="mt-x1 text-t4 text-fg-neutral-subtle"
          >
            {release
              ? t("subtitleWithVersion", {
                  version: release.version,
                  build: release.buildNumber,
                })
              : failed
                ? t("subtitleNoRelease")
                : t("subtitleLoading")}
          </p>
        </header>

        {/* 안드로이드 — 받아서 바로 설치된다. */}
        <section className="mt-x8">
          <h2 className="flex items-center gap-x2 text-t6 font-bold text-fg-neutral">
            <Smartphone
              aria-hidden
              className="size-[20px] shrink-0 text-fg-neutral"
            />
            {t("android.title")}
          </h2>
          <p className="mt-x3 mb-x4 text-t5 text-fg-neutral-muted">
            {t("android.desc")}
          </p>
          {release ? (
            <Button
              asChild
              variant="neutralSolid"
              size="large"
              className="w-full"
            >
              <a href={`${DOWNLOAD_BASE}/${release.android}`} download>
                <Download aria-hidden /> {t("android.cta")}
              </a>
            </Button>
          ) : (
            <Button
              variant="neutralSolid"
              size="large"
              className="w-full"
              disabled
            >
              <Download aria-hidden /> {t("android.cta")}
            </Button>
          )}
          <p className="mt-x3 text-t4 text-fg-neutral-subtle">
            {t("android.note")}
          </p>
        </section>

        <Divider className="mt-x8" />

        {/* iOS — 서명이 없어 그대로는 안 깔린다. 무엇이 필요한지 먼저 알린다. */}
        <section className="mt-x8">
          <h2 className="flex items-center gap-x2 text-t6 font-bold text-fg-neutral">
            <Apple
              aria-hidden
              className="size-[20px] shrink-0 text-fg-neutral"
            />
            {t("ios.title")}
          </h2>
          <Callout tone="warning" className="mt-x3 mb-x4">
            {t("ios.warning")}
          </Callout>

          {/* AltStore 소스 — 7일마다 다시 서명하는 수고를 없애는 유일한 길이라 먼저 권한다. */}
          <p className="text-t5 text-fg-neutral-muted">
            {t("ios.altstoreDesc")}
          </p>
          <div className="mt-x3 flex flex-wrap items-center gap-x2">
            <code
              data-testid="download-source-url"
              className="min-w-0 flex-1 basis-48 rounded-r2 bg-bg-neutral-weak px-x3 py-x2_5 font-mono text-t3 text-fg-neutral [overflow-wrap:anywhere]"
            >
              {sourceUrl}
            </code>
            <Button
              variant="neutralWeak"
              size="medium"
              className="shrink-0"
              onClick={copySource}
            >
              <Copy aria-hidden /> {t("ios.copy")}
            </Button>
          </div>

          {/* 직접 받는 길도 남겨 둔다 — Sideloadly 처럼 IPA 를 직접 먹이는 도구를 쓸 때. */}
          <p className="my-x3 text-t4 text-fg-neutral-subtle">
            {t("ios.desc")}
          </p>
          {release ? (
            <Button
              asChild
              variant="neutralWeak"
              size="large"
              className="w-full"
            >
              <a href={`${DOWNLOAD_BASE}/${release.ios}`} download>
                <Download aria-hidden /> {t("ios.cta")}
              </a>
            </Button>
          ) : (
            <Button
              variant="neutralWeak"
              size="large"
              className="w-full"
              disabled
            >
              <Download aria-hidden /> {t("ios.cta")}
            </Button>
          )}
        </section>

        <p className="mt-x8 text-center text-t4 text-fg-neutral-subtle">
          {t("webHint")}
        </p>
      </main>
    </div>
  );
};
