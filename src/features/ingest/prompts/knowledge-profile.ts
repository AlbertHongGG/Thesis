import { extractJsonObject, normalizeTerms } from './shared';
import { renderPromptTemplate } from './render';
import type { KnowledgeProfilePromptBundle } from './types';

const KNOWLEDGE_PROFILE_SYSTEM_PROMPT = `你是知識庫聚合摘要器。
你必須根據多份來源摘要，產出一份知識庫層級的研究領域輪廓。
你只能輸出單一 JSON 物件，不可加入 Markdown 或額外解釋。`;

const KNOWLEDGE_PROFILE_USER_PROMPT_TEMPLATE = `請根據以下來源，為知識庫「{{knowledgeBaseName}}」產出聚合摘要。

【輸出格式】
{
  "summary": "string",
  "focusAreas": ["string"],
  "keyTerms": ["string"],
  "focusAreas": ["string"],
  "keyTerms": ["string"]
}

【既有術語】
{{keyTermsBlock}}

【來源摘要】
{{sourceSummariesBlock}}`;

export function createKnowledgeProfilePromptBundle(bundleId: string): KnowledgeProfilePromptBundle {
  return {
    id: `${bundleId}:knowledge-profile`,
    systemPrompt: KNOWLEDGE_PROFILE_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(KNOWLEDGE_PROFILE_USER_PROMPT_TEMPLATE, {
        knowledgeBaseName: input.knowledgeBaseName,
        keyTermsBlock: input.keyTerms.length > 0 ? input.keyTerms.join('、') : '（目前沒有穩定術語）',
        sourceSummariesBlock: input.sourceSummaries.length > 0 ? input.sourceSummaries.join('\n') : '（目前沒有可用來源摘要）',
      });
    },
    parse(rawText) {
      const parsed = extractJsonObject(rawText);

      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        focusAreas: normalizeTerms(parsed.focusAreas).slice(0, 8),
        keyTerms: normalizeTerms(parsed.keyTerms).slice(0, 16),
      };
    },
  };
}