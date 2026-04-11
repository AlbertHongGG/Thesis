import type { FileProcessStatus, StepStatus } from './types';

export function getDisplayPath(fullPath: string) {
  const parts = fullPath.split('/');
  if (parts.length > 1) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return fullPath;
}

export function formatDuration(milliseconds: number) {
  const safeMilliseconds = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  return `${(safeMilliseconds / 1000).toFixed(1)}s`;
}

export function getStatusLabel(status: FileProcessStatus) {
  if (status === 'processing') return '處理中';
  if (status === 'completed') return '已完成';
  if (status === 'error') return '失敗';
  return '待處理';
}

export function getStepStatusLabel(status: StepStatus) {
  if (status === 'running') return '執行中';
  if (status === 'error') return '失敗';
  return '完成';
}

export function formatSavedAt(timestamp: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}