import { clampContext } from '../text';
import { renderPromptBlock, renderPromptTemplate } from './render';
import type { ImageAnalysisPromptBundle } from './types';

const IMAGE_ANALYSIS_SYSTEM_PROMPT = `你是圖片理解與轉述助手，負責把圖片內容整理成可搜尋、可嵌入、可直接閱讀的繁體中文描述。
你必須忠於畫面可見資訊，不可虛構看不見的內容。
如果圖片是圖表、統計圖、比較圖、分析圖或帶有數據的視覺化內容，你必須優先做圖表解讀，而不是泛泛描述畫面外觀。
你應優先辨識圖表類型、資料組數、各項數據代表意義、是否存在比較關係、比較結果、主要洞察、傳達訊息與參考價值。`;

const IMAGE_ANALYSIS_USER_PROMPT_TEMPLATE = `請閱讀這張圖片，輸出一份以「圖表內容解讀」為核心的繁體中文分析。

【初步圖片理解】
{{preliminarySummaryBlock}}

【本次檢索查詢】
{{retrievalQueryBlock}}

【分析優先順序】
1. 先回答這是什麼圖，例如長條圖、折線圖、散點圖、流程圖、架構圖、表格或混合型視覺化。
2. 明確指出圖中是單一資料組，還是多組資料在比較；若有多組，請說明比較對象是誰。
3. 盡量辨識圖上的數據、欄位、座標軸、圖例、標籤、單位、系列名稱或分類名稱，並說明各自代表什麼意思。
4. 若圖中有比較、差異、趨勢、排序、集中、離群或變化，必須詳細解讀比較結果，而不是只說「有差異」。
5. 最後收斂到這張圖的重點、它想傳達的訊息、讀者能從中獲得什麼資訊，以及它的參考價值。

【輸出格式】
請使用以下固定段落標題輸出，並以繁體中文撰寫：
### 圖片類型
### 數據結構
### 數據內容與意義
### 比較結果與重點發現
### 圖片想傳達的訊息
### 可獲得的資訊與參考價值

【輸出要求】
- 重點放在圖表解讀，不要把篇幅浪費在顏色、排版或裝飾元素，除非那些元素本身承載數據意義。
- 若圖片不是典型圖表，也要依照上述段落盡可能回答；無法判定的部分請明確說明「無法從圖片可靠判定」。
- 若圖中文字模糊、數值不可讀、圖例不清楚或單位缺失，請明確指出限制，不要猜測。
- 若與下方背景脈絡有明確對應，請納入分析；若證據不足，請不要硬做推論。
- 比較結果若存在，請寫具體一點，例如哪一組較高、哪一組較低、趨勢是上升還是下降、差異集中在哪些區段。

【知識庫脈絡】
{{knowledgeContextBlock}}`;

const IMAGE_ANALYSIS_EMPTY_KNOWLEDGE_CONTEXT = '（目前沒有可用的知識庫脈絡）';
const IMAGE_ANALYSIS_EMPTY_PRELIMINARY_SUMMARY = '（目前沒有初步圖片理解）';
const IMAGE_ANALYSIS_EMPTY_RETRIEVAL_QUERY = '（本次未建立檢索查詢）';

export function createImageAnalysisPromptBundle(bundleId: string): ImageAnalysisPromptBundle {
  return {
    id: `${bundleId}:image-analysis`,
    systemPrompt: IMAGE_ANALYSIS_SYSTEM_PROMPT,
    buildPrompt(input) {
      return renderPromptTemplate(IMAGE_ANALYSIS_USER_PROMPT_TEMPLATE, {
        preliminarySummaryBlock: renderPromptBlock(input.preliminarySummary, IMAGE_ANALYSIS_EMPTY_PRELIMINARY_SUMMARY),
        retrievalQueryBlock: renderPromptBlock(input.retrievalQuery, IMAGE_ANALYSIS_EMPTY_RETRIEVAL_QUERY),
        knowledgeContextBlock: renderPromptBlock(clampContext(input.knowledgeContext), IMAGE_ANALYSIS_EMPTY_KNOWLEDGE_CONTEXT),
      });
    },
  };
}