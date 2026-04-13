import { buildPreview, clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import type { DocumentOverviewPromptBundle } from './types';

const DOCUMENT_OVERVIEW_SYSTEM_PROMPT = `你是文件總覽整理器。
你的工作是在 chunk 細部分析之前，先抓出整份文件整體在做什麼、主要談什麼、包含哪些面向，以及各段內容在整體中的分工。
輸出必須是繁體中文、單一段落，不得使用條列，也不得加入多餘解釋。`;

const DOCUMENT_OVERVIEW_USER_PROMPT_TEMPLATE = `請先閱讀以下文件資訊，產出一段「文件總覽」。

【目標】
- 先說明整份文件整體在做什麼、核心主題是什麼。
- 交代這份文件大致包含哪些區塊、步驟、面向或子主題。
- 幫後續 chunk 分析建立全局感，讓人知道單一 chunk 會是整份文件中的哪一部分。
- 若文件看起來是規格、流程、報告、分析、操作說明、紀錄或資料整理，請明確點出它的性質。

【輸出要求】
- 請寫成 2 到 4 句的繁體中文段落。
- 內容要偏「整體定位」，不要陷入單一 chunk 細節。
- 若內容不完整，請保守描述，不要猜測不存在的章節。

【既有知識庫脈絡】
{{knowledgeContextBlock}}

【文件解析預覽】
{{parsedTextPreviewBlock}}

【chunk 預覽列表】
{{chunkPreviewBlock}}`;

const DOCUMENT_OVERVIEW_EMPTY_KNOWLEDGE_CONTEXT = '（目前沒有既有知識庫脈絡）';
const DOCUMENT_OVERVIEW_EMPTY_PARSED_PREVIEW = '（沒有可用的文件解析預覽）';
const DOCUMENT_OVERVIEW_EMPTY_CHUNK_PREVIEW = '（沒有可用的 chunk 預覽）';

export function createDocumentOverviewPromptBundle(bundleId: string): DocumentOverviewPromptBundle {
  return {
    id: `${bundleId}:document-overview`,
    systemPrompt: DOCUMENT_OVERVIEW_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(DOCUMENT_OVERVIEW_USER_PROMPT_TEMPLATE, {
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), DOCUMENT_OVERVIEW_EMPTY_KNOWLEDGE_CONTEXT),
        parsedTextPreviewBlock: renderPromptBlock(input.parsedTextPreview, DOCUMENT_OVERVIEW_EMPTY_PARSED_PREVIEW),
        chunkPreviewBlock: renderPromptBlock(
          input.chunks.slice(0, 8).map(chunk => `第 ${chunk.index + 1} 個 chunk：${buildPreview(chunk.text, 220)}`).join('\n'),
          DOCUMENT_OVERVIEW_EMPTY_CHUNK_PREVIEW,
        ),
      });
    },
  };
}