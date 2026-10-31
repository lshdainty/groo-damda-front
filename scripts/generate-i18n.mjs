/**
 * CSV → JSON 다국어 변환 스크립트
 *
 * 사용법: npm run i18n:generate
 *
 * CSV 구조:
 * namespace,key,ko,en
 * common,confirm,확인,Confirm
 *
 * 결과물:
 * src/locales/ko/common.json -> { "confirm": "확인" }
 * src/locales/en/common.json -> { "confirm": "Confirm" }
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT_DIR, "i18n", "translations.csv");
const LOCALES_DIR = path.join(ROOT_DIR, "src", "locales");

// 지원하는 언어 목록
const LANGUAGES = ["ko", "en"];

/**
 * CSV 파일 파싱
 * - 쉼표로 구분된 값 처리
 * - 따옴표로 감싸진 값 내의 쉼표 처리
 */
function parseCSV(content) {
  const lines = content.trim().split("\n");
  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      // 값 안의 글자 그대로 `\n` 은 줄바꿈 하나다(CSV 가 줄 단위로 읽혀 진짜 줄바꿈은 못 쓴다)
      row[header.trim()] = (values[index]?.trim() || "").replace(/\\n/g, "\n");
    });
    return row;
  });
}

/**
 * CSV 라인 파싱 (따옴표 내 쉼표 처리)
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // RFC4180 — 따옴표 안의 "" 는 리터럴 " 한 개다. 이 분기가 없으면 값에 들어간
      // 큰따옴표가 통째로 사라진다(대상 이름을 감싸는 `"급여통장"` 이 그 경우다).
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

/**
 * flat key로 값 설정
 * i18next가 flat key를 지원하므로 중첩하지 않음
 * (form.paymentMethod과 form.paymentMethod.CASH 같은 키 충돌 방지)
 */
function setFlatValue(obj, key, value) {
  obj[key] = value;
}

/**
 * 메인 함수
 */
async function main() {
  console.log("🌍 다국어 파일 생성 시작...\n");

  // CSV 파일 읽기
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV 파일을 찾을 수 없습니다: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(csvContent);

  console.log(`📄 ${rows.length}개의 번역 항목을 발견했습니다.\n`);

  // 언어별, 네임스페이스별로 데이터 구조화
  const translations = {};

  LANGUAGES.forEach((lang) => {
    translations[lang] = {};
  });

  rows.forEach((row) => {
    const namespace = row.namespace;
    const key = row.key;

    if (!namespace || !key) return;

    LANGUAGES.forEach((lang) => {
      if (!translations[lang][namespace]) {
        translations[lang][namespace] = {};
      }

      const value = row[lang] || "";
      setFlatValue(translations[lang][namespace], key, value);
    });
  });

  // locales 폴더 생성 및 JSON 파일 저장
  LANGUAGES.forEach((lang) => {
    const langDir = path.join(LOCALES_DIR, lang);

    // 언어 폴더 생성
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    // 네임스페이스별 JSON 파일 생성
    const namespaces = Object.keys(translations[lang]);
    namespaces.forEach((namespace) => {
      const filePath = path.join(langDir, `${namespace}.json`);
      const content = JSON.stringify(translations[lang][namespace], null, 2);
      fs.writeFileSync(filePath, content, "utf-8");
    });

    console.log(`✅ ${lang}/ 폴더에 ${namespaces.length}개의 파일 생성 완료`);
    namespaces.forEach((ns) => {
      const keyCount = countKeys(translations[lang][ns]);
      console.log(`   - ${ns}.json (${keyCount} keys)`);
    });
  });

  console.log("\n🎉 다국어 파일 생성 완료!");
}

/**
 * 객체의 키 개수 카운트 (중첩 포함)
 */
function countKeys(obj) {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

main().catch(console.error);
