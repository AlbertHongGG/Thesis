import { clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import type { ImageAnalysisPromptBundle } from './types';

const IMAGE_ANALYSIS_SYSTEM_PROMPT = `你是圖片理解與轉述助手，負責把圖片內容整理成可搜尋、可嵌入、可直接閱讀的繁體中文描述。
你必須忠於畫面可見資訊，不可虛構看不見的內容。
如果圖片包含文字、流程、欄位、節點、圖例或版面結構，應優先描述這些可支持檢索的資訊。`;

const IMAGE_ANALYSIS_USER_PROMPT_TEMPLATE = `請閱讀這張圖片，輸出一段完整的繁體中文描述。

【描述要求】
- 先判斷圖片類型，例如介面截圖、流程圖、架構圖、表格、文件截圖或一般示意圖。
- 說明畫面中的主要元素、版面結構、可見文字、資料關係、流程方向或狀態。
- 若與下方背景脈絡有明確對應，請把關聯說清楚；若證據不足，請不要硬做推論。
- 不要使用條列；請直接輸出連貫的自然語言描述。
- 對無法辨識的細節可直接說明模糊或不可讀，不要猜測。

【背景脈絡】
{{globalContextBlock}}`;

const IMAGE_ANALYSIS_EMPTY_GLOBAL_CONTEXT = '（目前沒有可用的文字背景脈絡）';

export function createImageAnalysisPromptBundle(bundleId: string): ImageAnalysisPromptBundle {
  return {
    id: `${bundleId}:image-analysis`,
    systemPrompt: IMAGE_ANALYSIS_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(IMAGE_ANALYSIS_USER_PROMPT_TEMPLATE, {
        globalContextBlock: renderPromptBlock(clampContext(input.globalContext), IMAGE_ANALYSIS_EMPTY_GLOBAL_CONTEXT),
      });
    },
  };
}