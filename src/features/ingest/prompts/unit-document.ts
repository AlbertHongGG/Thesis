import { buildPreview, clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import { extractJsonObject, normalizeEntities, normalizeRelationHints, normalizeTerms } from './shared';
import type { DocumentUnitPromptBundle } from './types';

const DOCUMENT_UNIT_SYSTEM_PROMPT = `你是文件檢索單位分析器。
你的任務是為單一語意單位產出最小且穩定的 RAG metadata。
你只能輸出單一 JSON 物件，不可輸出 Markdown、前言、註解或其他文字。`;

const DOCUMENT_UNIT_USER_PROMPT_TEMPLATE = `請分析以下文件單位，建立檢索與關聯用 metadata。

【任務】
1. 產出可單獨理解此單位的 summary。
2. 抽出穩定且有檢索價值的 terms。
3. 抽出值得建立關聯的 entities。
4. 產出 relationHints，說明此單位與其他內容最重要的關聯類型，例如 depends-on、continues、compares、explains、references、supports。

【輸出格式】
{
  "summary": "string",
  "terms": ["string"],
  "entities": ["string"],
  "relationHints": [
    { "kind": "string", "label": "string" }
  ]
}

【要求】
- summary 使用繁體中文，控制在 2 到 4 句。
- relationHints 只保留最重要的 0 到 4 個，不要泛濫。
- 若幾乎可獨立理解，可以不輸出 relationHints。

【來源摘要】
{{sourceSummaryBlock}}

【既有知識庫脈絡】
{{knowledgeContextBlock}}

【前一個單位預覽】
{{previousUnitBlock}}

【下一個單位預覽】
{{nextUnitBlock}}

【目前單位全文】
{{unitText}}`;

export function createDocumentUnitPromptBundle(bundleId: string): DocumentUnitPromptBundle {
  return {
    id: `${bundleId}:document-unit`,
    systemPrompt: DOCUMENT_UNIT_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(DOCUMENT_UNIT_USER_PROMPT_TEMPLATE, {
        sourceSummaryBlock: renderPromptBlock(input.sourceSummary, '（目前沒有來源摘要）'),
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), '（目前沒有既有知識庫脈絡）'),
        previousUnitBlock: renderPromptBlock(input.previousUnit ? buildPreview(input.previousUnit.text, 220) : '', '（沒有前一個單位）'),
        nextUnitBlock: renderPromptBlock(input.nextUnit ? buildPreview(input.nextUnit.text, 220) : '', '（沒有下一個單位）'),
        unitText: input.unit.text.trim(),
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