import { clampContext } from '../text';
import type { DocumentSummaryPromptBundle } from './types';

export function createDocumentSummaryPromptBundle(bundleId: string): DocumentSummaryPromptBundle {
  return {
    id: `${bundleId}:document-summary`,
    systemPrompt: '請輸出單一段繁體中文摘要，不要使用項目符號，也不要附加多餘說明。',
    buildPrompt(input) {
      return [
        `請根據以下文件 chunk 摘要，為文件 ${input.filename} 產出一段精煉的繁體中文總摘要。`,
        '摘要要保留核心主題、重要術語、關鍵限制或依賴，不要只是改寫第一段內容。',
        input.globalContext.trim().length > 0 ? `可參考先前文件脈絡：\n${clampContext(input.globalContext)}\n` : '',
        input.chunks.map(chunk => `Chunk ${chunk.index + 1}: ${chunk.summary}`).join('\n'),
      ].join('\n');
    },
  };
}