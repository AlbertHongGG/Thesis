import { clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import { extractJsonObject, normalizeEntities, normalizeStructure, normalizeTerms } from './shared';
import type { ImageSourcePromptBundle } from './types';

const IMAGE_SOURCE_SYSTEM_PROMPT = `你是圖片來源語意整理器。
你的任務是為整張圖片建立最小但高價值的 RAG metadata。
你只能輸出單一 JSON 物件，不可輸出 Markdown 或其他多餘文字。`;

const IMAGE_SOURCE_USER_PROMPT_TEMPLATE = `請閱讀圖片，為檔名「{{filename}}」建立來源層級 metadata。

【任務】
1. 產出一段可代表整張圖片的 summary。
2. 抽出穩定且適合檢索的 terms。
3. 抽出值得建立關聯的 entities，例如圖表主題、系列名稱、模型、方法、資料集、欄位或主體。
4. 判斷圖片 structure，使用 chart、diagram、table、image、mixed 或 unknown 其一作為 kind，label 則寫較自然的繁中名稱。

【輸出格式】
{
  "summary": "string",
  "terms": ["string"],
  "entities": ["string"],
  "structure": { "kind": "string", "label": "string" }
}

【既有知識庫脈絡】
{{knowledgeContextBlock}}`;

export function createImageSourcePromptBundle(bundleId: string): ImageSourcePromptBundle {
  return {
    id: `${bundleId}:image-source`,
    systemPrompt: IMAGE_SOURCE_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(IMAGE_SOURCE_USER_PROMPT_TEMPLATE, {
        filename: input.filename,
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), '（目前沒有既有知識庫脈絡）'),
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