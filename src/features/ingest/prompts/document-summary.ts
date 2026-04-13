import { clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import type { DocumentSummaryPromptBundle } from './types';

const DOCUMENT_SUMMARY_SYSTEM_PROMPT = `你是文件總摘要整理器。
你必須根據多個 chunk 摘要整合出忠於原文的整體摘要。
輸出必須是繁體中文、單一段落，不得使用條列，不得加入前言、結語、提醒或額外評論。`;

const DOCUMENT_SUMMARY_USER_PROMPT_TEMPLATE = `請根據以下 chunk 摘要，為文件「{{filename}}」撰寫一段可獨立閱讀的整體摘要。

【摘要目標】
- 交代文件的主題、目的與主要內容。
- 保留重要術語、設定、限制、依賴、步驟、決策或結論。
- 若文件涵蓋多個子主題，需在同一段內自然串接，不可只挑其中一部分。
- 若內容明顯不完整，請保守描述，不可自行補寫缺漏資訊。

【文件總覽】
{{documentOverviewBlock}}

【既有知識庫脈絡】
{{knowledgeContextBlock}}

【chunk 摘要列表】
{{chunkSummaries}}`;

const DOCUMENT_SUMMARY_EMPTY_KNOWLEDGE_CONTEXT = '（目前沒有既有知識庫脈絡）';
const DOCUMENT_SUMMARY_EMPTY_DOCUMENT_OVERVIEW = '（目前沒有文件總覽）';
const CHUNK_SUMMARY_LINE_TEMPLATE = '第 {{chunkNumber}} 個 chunk：{{summary}}';

export function createDocumentSummaryPromptBundle(bundleId: string): DocumentSummaryPromptBundle {
  return {
    id: `${bundleId}:document-summary`,
    systemPrompt: DOCUMENT_SUMMARY_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(DOCUMENT_SUMMARY_USER_PROMPT_TEMPLATE, {
        filename: input.filename,
        documentOverviewBlock: renderPromptBlock(input.documentOverview, DOCUMENT_SUMMARY_EMPTY_DOCUMENT_OVERVIEW),
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), DOCUMENT_SUMMARY_EMPTY_KNOWLEDGE_CONTEXT),
        chunkSummaries: input.chunks.map(chunk => renderPromptTemplate(CHUNK_SUMMARY_LINE_TEMPLATE, {
          chunkNumber: String(chunk.index + 1),
          summary: chunk.summary,
        })).join('\n'),
      });
    },
  };
}