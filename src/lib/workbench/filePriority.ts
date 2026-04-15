import { getPreviewKind } from './filePreview';

export function getWorkbenchFilePriority(name: string) {
  const previewKind = getPreviewKind(name);

  if (previewKind === 'text' || previewKind === 'parsed-text') {
    return 0;
  }

  if (previewKind === 'image') {
    return 1;
  }

  return 2;
}

export function compareWorkbenchFileNames(left: string, right: string) {
  const priorityDiff = getWorkbenchFilePriority(left) - getWorkbenchFilePriority(right);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return left.localeCompare(right);
}