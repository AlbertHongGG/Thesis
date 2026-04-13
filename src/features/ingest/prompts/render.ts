const PROMPT_TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function renderPromptTemplate(template: string, variables: Record<string, string>) {
  return template.replace(PROMPT_TOKEN_PATTERN, (_, key: string) => variables[key] ?? '').trim();
}

export function renderPromptBlock(text: string | undefined, fallback: string) {
  const normalized = text?.trim() ?? '';
  return normalized.length > 0 ? normalized : fallback;
}