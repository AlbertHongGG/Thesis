import { buildPreview, clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import { extractJsonObject, normalizeEntities, normalizeStructure, normalizeTerms } from './shared';
import type { DocumentSourcePromptBundle } from './types';

const DOCUMENT_SOURCE_SYSTEM_PROMPT = `你是文件來源語意整理器。
你的任務是為整份文件建立最小但高價值的 RAG metadata。
你只能輸出單一 JSON 物件，不可輸出 Markdown、前言、註解或多餘文字。`;

const DOCUMENT_SOURCE_USER_PROMPT_TEMPLATE = `請根據以下資訊，為文件建立來源層級 metadata。

【任務】
1. 產出一段可代表整份文件的 summary。
2. 抽出穩定且可重複使用的 terms，避免冗詞。
3. 抽出值得建立關聯的 entities，例如專案名稱、模組、角色、資料集、方法、指標或重要產物。
4. 判斷這份文件的 structure，使用最貼近內容的種類，例如 report、analysis、specification、note、record、dataset、table 或 unknown。

【輸出格式】
{
  "summary": "string",
  "terms": ["string"],
  "entities": ["string"],
  "structure": { "kind": "string", "label": "string" }
}

【要求】
- summary 使用繁體中文，控制在 2 到 4 句。
- terms 保留 5 到 10 個最有助檢索的詞。
- entities 只保留真正值得關聯的對象，不要把每個名詞都列進去。
- 不可虛構原文沒有的概念。

【既有知識庫脈絡】
{{knowledgeContextBlock}}

【文件解析預覽】
{{parsedTextPreviewBlock}}

【單位預覽】
{{unitPreviewBlock}}`;

export function createDocumentSourcePromptBundle(bundleId: string): DocumentSourcePromptBundle {
  return {
    id: `${bundleId}:document-source`,
    systemPrompt: DOCUMENT_SOURCE_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(DOCUMENT_SOURCE_USER_PROMPT_TEMPLATE, {
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), '（目前沒有既有知識庫脈絡）'),
        parsedTextPreviewBlock: renderPromptBlock(input.parsedTextPreview, '（沒有可用的文件解析預覽）'),
        unitPreviewBlock: renderPromptBlock(
          input.units.slice(0, 8).map(unit => `第 ${unit.index + 1} 段：${buildPreview(unit.text, 220)}`).join('\n'),
          '（沒有可用的單位預覽）',
        ),
      });
    },
    parse(rawText) {
      const parsed = extractJsonObject(rawText);
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        terms: normalizeTerms(parsed.terms),
        entities: normalizeEntities(parsed.entities),
        structure: normalizeStructure(parsed.structure),
      };
    },
  };
}