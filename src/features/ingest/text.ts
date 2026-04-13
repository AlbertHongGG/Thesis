const MAX_CONTEXT_CHARS = 1800;
const MAX_PARSED_PREVIEW_CHARS = 4000;

export function buildPreview(text: string, maxLength = 180) {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function buildParsedPreview(text: string, maxLength = MAX_PARSED_PREVIEW_CHARS) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}\n\n...已截斷，僅保留前 ${maxLength.toLocaleString('zh-TW')} 個字元。`;
}

export function clampContext(text: string, maxLength = MAX_CONTEXT_CHARS) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `...${normalized.slice(-maxLength)}`;
}