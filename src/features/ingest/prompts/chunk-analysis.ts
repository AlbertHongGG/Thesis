import { buildPreview, clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import { extractJsonObject, normalizeKeywords } from './shared';
import type { ChunkAnalysisPromptBundle } from './types';

const CHUNK_ANALYSIS_SYSTEM_PROMPT = `你是文件切塊分析器，專門把單一文件片段整理成適合 RAG 檢索與後續摘要的中介資訊。
你必須忠於原文，不可虛構不存在的事實、結論、依賴或上下文。
你的唯一輸出必須是單一個 JSON 物件，不得加入 Markdown、程式碼區塊、前言、解釋或多餘文字。`;

const CHUNK_ANALYSIS_USER_PROMPT_TEMPLATE = `請分析以下文件 chunk，產出後續檢索會使用的結構化資訊。

【任務目標】
1. 先根據整份文件的總覽，判斷此 chunk 在整體中扮演什麼角色，再概括此 chunk 的核心內容。
2. 抽出最有助於搜尋的關鍵詞，優先保留檔名、路徑、命令、設定名稱、角色名稱、資料欄位、數值與技術術語。
3. 說明此 chunk 若單獨被檢索到時，還需要哪些前後文才能被正確理解，以及它與整份文件主題的關聯。

【輸出格式】
只可輸出 JSON 物件，欄位固定如下：
{
  "summary": "string",
  "keywords": ["string"],
  "bridgingContext": "string"
}

【欄位要求】
- summary：使用繁體中文，控制在 5、6 句左右；前幾句先交代整份文件整體在做或說什麼，接著後幾句說明這個 chunk 在其中提供了哪些細節、限制、步驟或例子。
- keywords：輸出 4 到 8 個短詞；可混用繁體中文與原文術語；不要輸出完整句子；不要重複。
- bridgingContext：說明與前文、後文、文件總覽、外部設定或隱含假設的關係；若幾乎可獨立理解，請明確寫出可獨立理解的原因。
- 若資料不足，請保守描述，不要猜測。

【文件總覽】
{{documentOverviewBlock}}

【文件整體脈絡】
{{globalContextBlock}}

【前一個 chunk 預覽】
{{previousChunkBlock}}

【下一個 chunk 預覽】
{{nextChunkBlock}}

【目前 chunk 全文】
{{chunkText}}`;

const EMPTY_GLOBAL_CONTEXT = '（目前沒有可用的文件整體脈絡）';
const EMPTY_DOCUMENT_OVERVIEW = '（目前沒有可用的文件總覽）';
const EMPTY_PREVIOUS_CHUNK = '（沒有前一個 chunk）';
const EMPTY_NEXT_CHUNK = '（沒有下一個 chunk）';

export function createChunkAnalysisPromptBundle(bundleId: string): ChunkAnalysisPromptBundle {
  return {
    id: `${bundleId}:chunk-analysis`,
    systemPrompt: CHUNK_ANALYSIS_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(CHUNK_ANALYSIS_USER_PROMPT_TEMPLATE, {
        documentOverviewBlock: renderPromptBlock(input.documentOverview, EMPTY_DOCUMENT_OVERVIEW),
        globalContextBlock: renderPromptBlock(clampContext(input.globalContext), EMPTY_GLOBAL_CONTEXT),
        previousChunkBlock: renderPromptBlock(
          input.previousChunk ? buildPreview(input.previousChunk.text, 260) : '',
          EMPTY_PREVIOUS_CHUNK,
        ),
        nextChunkBlock: renderPromptBlock(
          input.nextChunk ? buildPreview(input.nextChunk.text, 260) : '',
          EMPTY_NEXT_CHUNK,
        ),
        chunkText: input.chunk.text.trim(),
      });
    },
    parse(rawText) {
      const parsed = extractJsonObject(rawText);

      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        keywords: normalizeKeywords(parsed.keywords),
        bridgingContext: typeof parsed.bridgingContext === 'string' ? parsed.bridgingContext.trim() : '',
      };
    },
  };
}