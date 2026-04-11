import type { PreviewKind } from './types';

export const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|svg|webp)$/i;
export const TEXT_FILE_PATTERN = /\.(txt|md|json|csv)$/i;
export const PARSED_DOCUMENT_FILE_PATTERN = /\.(pdf|docx)$/i;
export const DOCUMENT_FILE_PATTERN = /\.(pdf|txt|docx|doc|json|csv|md)$/i;
export const MAX_TEXT_PREVIEW_CHARS = 20000;

export function getPreviewKind(name: string): PreviewKind {
  if (IMAGE_FILE_PATTERN.test(name)) return 'image';
  if (TEXT_FILE_PATTERN.test(name)) return 'text';
  if (PARSED_DOCUMENT_FILE_PATTERN.test(name)) return 'parsed-text';
  return 'unsupported';
}

export function isPreviewableTextFile(name: string) {
  return TEXT_FILE_PATTERN.test(name);
}

export function trimPreviewText(text: string, maxLength = MAX_TEXT_PREVIEW_CHARS) {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxLength)}\n\n...已截斷，僅顯示前 ${maxLength.toLocaleString('zh-TW')} 個字元。`,
    truncated: true,
  };
}