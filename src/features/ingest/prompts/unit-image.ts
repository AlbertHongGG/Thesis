import { clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import { extractJsonObject, normalizeEntities, normalizeRelationHints, normalizeTerms } from './shared';
import type { ImageUnitPromptBundle } from './types';

const IMAGE_UNIT_SYSTEM_PROMPT = `你是圖片檢索單位分析器。
你的任務是把整張圖片整理成可檢索、可關聯的最小 metadata。
你只能輸出單一 JSON 物件，不可輸出 Markdown 或其他額外文字。`;

const IMAGE_UNIT_USER_PROMPT_TEMPLATE = `請閱讀圖片，為檔名「{{filename}}」建立檢索單位 metadata。

【任務】
1. 產出可單獨檢索這張圖片的 summary。
2. 抽出最有檢索價值的 terms。
3. 抽出值得建立關聯的 entities。
4. 產出 relationHints，說明這張圖片與其他知識內容可能存在的主要關聯。

【輸出格式】
{
  "summary": "string",
  "terms": ["string"],
  "entities": ["string"],
  "relationHints": [
    { "kind": "string", "label": "string" }
  ]
}

【來源摘要】
{{sourceSummaryBlock}}

【既有知識庫脈絡】
{{knowledgeContextBlock}}`;

export function createImageUnitPromptBundle(bundleId: string): ImageUnitPromptBundle {
  return {
    id: `${bundleId}:image-unit`,
    systemPrompt: IMAGE_UNIT_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(IMAGE_UNIT_USER_PROMPT_TEMPLATE, {
        filename: input.filename,
        sourceSummaryBlock: renderPromptBlock(input.sourceSummary, '（目前沒有來源摘要）'),
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), '（目前沒有既有知識庫脈絡）'),
      });
    },
    parse(rawText) {
      const parsed = extractJsonObject(rawText);
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        terms: normalizeTerms(parsed.terms),
        entities: normalizeEntities(parsed.entities),
        relationHints: normalizeRelationHints(parsed.relationHints),
      };
    },
  };
}