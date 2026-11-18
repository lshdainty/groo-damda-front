// React Compiler 를 거친 모듈을 시험에서 부른다.
//   vitest 는 vite.config.ts 를 쓰지 않아 컴파일러 없이 돈다(CLAUDE.md "테스트는 컴파일 안 된 코드를 돈다") — 그래서 컴파일러가
//   값을 처음 한 번만 재 묶는 결함(값을 버리고 측정만 부르는 훅 — `useTickFontVersion(); return measure()`)이 시험에서 안 보였다.
//   앱 빌드와 같은 플러그인(babel-plugin-react-compiler, 옵션 없음 — vite.config.ts 의 reactCompilerPreset())으로 그 파일만 변환해
//   node_modules/.cache 아래에 쓰고 불러온다. 새 의존성은 없다 — @babel/core 는 @rolldown/plugin-babel 이 이미 쓰는 것이다.
//   변환한 파일의 상대 경로 import 는 원래 자리의 절대 경로로 바꾼다("@/…" 는 vitest alias 가 그대로 푼다).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** 타입 선언이 없는 패키지라 이름으로 부른다(@types/babel__core 를 들이지 않는다) */
const BABEL = "@babel/core";
const OUT_DIR = path.resolve(
  __dirname,
  "../../../node_modules/.cache/react-compiler-tests",
);

interface BabelCore {
  transformAsync(
    code: string,
    options: Record<string, unknown>,
  ): Promise<{ code?: string | null } | null>;
}

/** [file](저장소 기준 경로)을 React Compiler 로 변환한 글 */
export async function compileWithReactCompiler(file: string): Promise<string> {
  const abs = path.resolve(__dirname, "../../..", file);
  const babel = (await import(/* @vite-ignore */ BABEL)) as BabelCore;
  const out = await babel.transformAsync(readFileSync(abs, "utf8"), {
    filename: abs,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [["babel-plugin-react-compiler", {}]],
  });
  if (!out?.code) throw new Error(`React Compiler 변환 실패: ${file}`);
  return out.code.replace(
    /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
    (_, head: string, rel: string, tail: string) =>
      `${head}${path.resolve(path.dirname(abs), rel)}${tail}`,
  );
}

/** [file] 을 React Compiler 로 변환해 불러온다 — 변환한 글(code)도 함께 돌려준다(어느 함수가 메모이즈됐는지 보려고) */
export async function importCompiled<T>(
  file: string,
): Promise<{ module: T; code: string }> {
  const code = await compileWithReactCompiler(file);
  mkdirSync(OUT_DIR, { recursive: true });
  const ext = path.extname(file);
  const out = path.join(
    OUT_DIR,
    `${file.replace(/[\\/]/g, "_").slice(0, -ext.length)}.compiled${ext}`,
  );
  writeFileSync(out, code);
  return { module: (await import(/* @vite-ignore */ out)) as T, code };
}

/** 변환한 글에서 함수 하나의 몸 — 그 함수가 컴파일러 캐시(`_c(`)를 쓰는지 본다 */
export function compiledBody(code: string, name: string): string {
  const start = code.search(new RegExp(`function ${name}\\(`));
  if (start < 0) return "";
  const next = code.indexOf("\nexport ", start + 1);
  return code.slice(start, next < 0 ? undefined : next);
}
