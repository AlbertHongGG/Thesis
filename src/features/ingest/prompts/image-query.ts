import { extractJsonObject, normalizeKeywords } from './shared';
import { renderPromptTemplate } from './render';
import type { ImageQueryPromptBundle } from './types';

const IMAGE_QUERY_SYSTEM_PROMPT = `你是圖片檢索線索整理器。
你的任務不是做最終圖片分析，而是先從圖片中抽出有助於知識庫檢索的線索。
你只能輸出單一 JSON 物件，不可輸出 Markdown 或額外文字。`;

const IMAGE_QUERY_USER_PROMPT_TEMPLATE = `請閱讀圖片，為檔名「{{filename}}」輸出檢索線索。

【目標】
- 用 2 到 4 句描述圖片的主題、圖表類型與主要可見內容。
- 抽出適合搜尋知識庫的關鍵詞，優先保留研究主題、技術術語、指標名稱、資料欄位、方法名稱、圖表類型。
- 提出 2 到 4 個候選檢索查詢句，讓系統可以據此到知識庫找最相關內容。
- 若圖片中看得到文字、標籤、圖例、座標軸或標題，請提取最關鍵的片段。

【輸出格式】
{
  "summary": "string",
  "chartType": "string",
  "keywords": ["string"],
  "candidateQueries": ["string"],
  "visibleText": ["string"]
}`;

export function createImageQueryPromptBundle(bundleId: string): ImageQueryPromptBundle {
  return {
    id: `${bundleId}:image-query`,
    systemPrompt: IMAGE_QUERY_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(IMAGE_QUERY_USER_PROMPT_TEMPLATE, {
        filename: input.filename,
      });
    },
    parse(rawText) {
      const parsed = extractJsonObject(rawText);

      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        chartType: typeof parsed.chartType === 'string' ? parsed.chartType.trim() : '',
        keywords: normalizeKeywords(parsed.keywords),
        candidateQueries: normalizeKeywords(parsed.candidateQueries).slice(0, 4),
        visibleText: normalizeKeywords(parsed.visibleText).slice(0, 6),
      };
    },
  };
}