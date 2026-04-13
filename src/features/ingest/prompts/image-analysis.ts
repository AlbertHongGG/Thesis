import { clampContext } from '../text';
import type { ImageAnalysisPromptBundle } from './types';

export function createImageAnalysisPromptBundle(bundleId: string): ImageAnalysisPromptBundle {
  return {
    id: `${bundleId}:image-analysis`,
    buildPrompt(input) {
      if (input.globalContext.trim().length === 0) {
        return 'Describe this image in detail.';
      }

      return `Given the following background context from earlier documents:\n${clampContext(input.globalContext)}\n\nDescribe this image in detail and connect it to the provided context when relevant.`;
    },
  };
}