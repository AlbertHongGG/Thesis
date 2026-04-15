'use client';

import { useSyncExternalStore } from 'react';
import type { ExtendedFile } from '@/components/ui/DropZone';
import type { IngestStreamEvent } from '@/features/ingest/contracts';
import { startIngestRequest } from '@/lib/client/ingestApi';
import { repathKnowledgeSources } from '@/lib/client/knowledgeBaseApi';
import {
  canUseSessionPersistence,
  clearStoredSession,
  saveSessionSnapshot,
  syncSessionFiles,
} from '@/lib/storage/sessionStore';
import { cloneIngestResult, cloneIngestUnit } from '@/modules/workspace/client/ingestSnapshot';
import { getDisplayPath } from '@/lib/workbench/formatting';
import {
  buildInitialWorkbenchTree,
  collectPathSyncItems,
  createEmptyWorkbenchTreeState,
  createWorkbenchFileRecord,
  deleteWorkbenchNode,
  getOrderedFileIds,
  insertWorkbenchFile,
  moveWorkbenchNode,
} from '@/lib/workbench/treeState';
import type {
  FileProcessEntry,
  IngestResult,
  ProcessStepEntry,
  WorkbenchDropPosition,
  WorkbenchFileRecord,
  WorkbenchTreeState,
} from '@/lib/workbench/types';

export type WorkbenchProcessMode = 'idle' | 'playing' | 'paused';

export interface WorkbenchQueueSnapshot {
  files: WorkbenchFileRecord[];
  tree: WorkbenchTreeState;
  processEntries: Record<string, FileProcessEntry>;
  processMode: WorkbenchProcessMode;
  currentFileId: string | null;
  activeKnowledgeBaseId: string | null;
}

interface RestoreQueueStateInput {
  files: WorkbenchFileRecord[];
  tree: WorkbenchTreeState;
  processEntries: Record<string, FileProcessEntry>;
  currentFileId: string | null;
  activeKnowledgeBaseId: string | null;
}

const INITIAL_STATE: WorkbenchQueueSnapshot = {
  files: [],
  tree: createEmptyWorkbenchTreeState(),
  processEntries: {},
  processMode: 'idle',
  currentFileId: null,
  activeKnowledgeBaseId: null,
};

let state: WorkbenchQueueSnapshot = INITIAL_STATE;
let processingPromise: Promise<void> | null = null;
let persistTimer: number | null = null;
let lastPersistedFileSignature = '';
let queueGeneration = 0;

const listeners = new Set<() => void>();

function buildFileMap(files: WorkbenchFileRecord[]) {
  return new Map(files.map(file => [file.id, file]));
}

function getOrderedFiles(snapshot: WorkbenchQueueSnapshot) {
  const fileMap = buildFileMap(snapshot.files);
  return getOrderedFileIds(snapshot.tree)
    .map(fileId => fileMap.get(fileId) ?? null)
    .filter((file): file is WorkbenchFileRecord => file !== null);
}

function getNextIdleFileId(snapshot: Pick<WorkbenchQueueSnapshot, 'files' | 'tree' | 'processEntries'>) {
  const fileMap = buildFileMap(snapshot.files);

  for (const fileId of getOrderedFileIds(snapshot.tree)) {
    const file = fileMap.get(fileId);
    if (!file) {
      continue;
    }

    const entry = snapshot.processEntries[fileId] ?? buildInitialEntry(fileId, file.workbenchPath);
    if (entry.status === 'idle') {
      return fileId;
    }
  }

  return null;
}

function buildInitialEntry(fileId: string, fullPath: string): FileProcessEntry {
  return {
    fileId,
    path: fullPath,
    displayPath: getDisplayPath(fullPath),
    status: 'idle',
    steps: [],
  };
}

function syncEntryPath(entry: FileProcessEntry, fullPath: string): FileProcessEntry {
  return {
    ...entry,
    fileId: entry.fileId,
    path: fullPath,
    displayPath: getDisplayPath(fullPath),
  };
}

function syncEntriesToFiles(files: WorkbenchFileRecord[], processEntries: Record<string, FileProcessEntry>) {
  const nextEntries: Record<string, FileProcessEntry> = {};

  for (const file of files) {
    const existing = processEntries[file.id];
    nextEntries[file.id] = existing
      ? syncEntryPath(existing, file.workbenchPath)
      : buildInitialEntry(file.id, file.workbenchPath);
  }

  return nextEntries;
}

function buildResetEntries(files: WorkbenchFileRecord[]) {
  return Object.fromEntries(files.map(file => [file.id, buildInitialEntry(file.id, file.workbenchPath)]));
}

async function readIngestError(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null) as { error?: unknown } | null;
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
  }

  const text = await response.text().catch(() => '');
  return text.trim() || `HTTP ${response.status}`;
}

function serializeResult(result?: IngestResult) {
  return cloneIngestResult(result);
}

function serializeSteps(steps: ProcessStepEntry[]) {
  return steps.map(step => ({
    id: step.id,
    message: step.message,
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
  }));
}

function serializeEntry(entry: FileProcessEntry) {
  return {
    fileId: entry.fileId,
    path: entry.path,
    displayPath: entry.displayPath,
    status: entry.status,
    steps: serializeSteps(entry.steps),
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    result: serializeResult(entry.result),
    errorMessage: entry.errorMessage,
  };
}

function buildPersistedFileRecord(file: WorkbenchFileRecord) {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    originalPath: file.originalPath,
    workbenchPath: file.workbenchPath,
    sourceSyncStatus: file.sourceSyncStatus,
    sourceSyncError: file.sourceSyncError,
    syncedCanonicalPath: file.syncedCanonicalPath,
    sourceId: file.sourceId,
    knowledgeBaseId: file.knowledgeBaseId,
    blob: file.file,
  };
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function schedulePersist() {
  if (typeof window === 'undefined' || !canUseSessionPersistence() || persistTimer !== null) {
    return;
  }

  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistSnapshot(state);
  }, 120);
}

async function persistSnapshot(snapshot: WorkbenchQueueSnapshot) {
  if (!canUseSessionPersistence()) {
    return;
  }

  const orderedFiles = getOrderedFiles(snapshot);
  if (orderedFiles.length === 0) {
    lastPersistedFileSignature = '';
    await clearStoredSession().catch(error => {
      console.error('Failed to clear stored session:', error);
    });
    return;
  }

  const processEntries: Record<string, ReturnType<typeof serializeEntry>> = {};
  for (const file of orderedFiles) {
    processEntries[file.id] = serializeEntry(snapshot.processEntries[file.id] ?? buildInitialEntry(file.id, file.workbenchPath));
  }

  await saveSessionSnapshot({
    activeKnowledgeBaseId: snapshot.activeKnowledgeBaseId,
    tree: snapshot.tree,
    currentFileId: snapshot.currentFileId,
    processEntries,
  }).catch(error => {
    console.error('Failed to save session snapshot:', error);
  });

  const fileSignature = orderedFiles
    .map(file => [
      file.id,
      file.workbenchPath,
      file.size,
      file.lastModified,
      file.sourceSyncStatus,
      file.syncedCanonicalPath ?? '',
      file.sourceId ?? '',
      file.knowledgeBaseId ?? '',
    ].join(':'))
    .join('|');

  if (fileSignature === lastPersistedFileSignature) {
    return;
  }

  lastPersistedFileSignature = fileSignature;

  await syncSessionFiles(orderedFiles.map(buildPersistedFileRecord)).catch(error => {
    console.error('Failed to sync session files:', error);
  });
}

function setState(nextStateOrUpdater: WorkbenchQueueSnapshot | ((current: WorkbenchQueueSnapshot) => WorkbenchQueueSnapshot)) {
  const nextState = typeof nextStateOrUpdater === 'function'
    ? nextStateOrUpdater(state)
    : nextStateOrUpdater;

  if (nextState === state) {
    return;
  }

  state = nextState;
  emitChange();
  schedulePersist();
}

function isCurrentGeneration(generation: number) {
  return generation === queueGeneration;
}

function markFilesAfterPathChange(files: WorkbenchFileRecord[], changedFileIds: string[]): WorkbenchFileRecord[] {
  const changedSet = new Set(changedFileIds);

  return files.map(file => {
    if (!changedSet.has(file.id)) {
      return file;
    }

    if (!file.sourceId || !file.knowledgeBaseId) {
      return {
        ...file,
        sourceSyncStatus: 'unsynced' as const,
        sourceSyncError: undefined,
      };
    }

    if (file.syncedCanonicalPath === file.workbenchPath) {
      return {
        ...file,
        sourceSyncStatus: 'synced' as const,
        sourceSyncError: undefined,
      };
    }

    return {
      ...file,
      sourceSyncStatus: 'pending-path-sync' as const,
      sourceSyncError: undefined,
    };
  });
}

function hasLockedStructure(snapshot: WorkbenchQueueSnapshot) {
  return snapshot.files.some(file => file.sourceSyncStatus === 'pending-path-sync' || file.sourceSyncStatus === 'syncing-path')
    || Object.values(snapshot.processEntries).some(entry => entry.status === 'processing');
}

function startProcessingEntry(fileId: string, fullPath: string, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const startedAt = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fileId] ?? buildInitialEntry(fileId, fullPath);
    return {
      ...prev,
      processEntries: {
        ...prev.processEntries,
        [fileId]: {
          ...existing,
          path: fullPath,
          displayPath: getDisplayPath(fullPath),
          status: 'processing',
          startedAt,
          completedAt: undefined,
          errorMessage: undefined,
          result: undefined,
          steps: [],
        },
      },
    };
  });
}

function appendProcessStep(fileId: string, fullPath: string, message: string, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const timestamp = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fileId] ?? buildInitialEntry(fileId, fullPath);
    const steps = [...existing.steps];
    const lastStep = steps[steps.length - 1];

    if (lastStep && lastStep.status === 'running') {
      steps[steps.length - 1] = {
        ...lastStep,
        status: 'completed',
        completedAt: timestamp,
      };
    }

    steps.push({
      id: steps.length + 1,
      message,
      status: 'running',
      startedAt: timestamp,
    });

    return {
      ...prev,
      processEntries: {
        ...prev.processEntries,
        [fileId]: {
          ...existing,
          path: fullPath,
          displayPath: getDisplayPath(fullPath),
          status: 'processing',
          startedAt: existing.startedAt ?? timestamp,
          completedAt: undefined,
          steps,
        },
      },
    };
  });
}

function mergeUnitResult(fileId: string, fullPath: string, event: Extract<IngestStreamEvent, { type: 'unit' }>, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  setState(prev => {
    const existing = prev.processEntries[fileId] ?? buildInitialEntry(fileId, fullPath);
    const sourceResult = existing.result ?? {
      type: 'source',
      knowledgeBaseId: event.knowledgeBaseId,
      knowledgeBaseName: event.knowledgeBaseName,
      previewKind: event.previewKind,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      title: event.title,
      totalUnitCount: event.totalUnitCount,
      totalCharCount: event.totalCharCount,
      rawPreview: event.rawPreview,
      meta: {
        schemaVersion: 1,
        sourceType: event.sourceType,
        title: event.title,
        summary: '',
        terms: [],
        entities: [],
      },
      units: [],
    } satisfies IngestResult;

    const nextUnits = [...sourceResult.units];
    const existingUnitIndex = nextUnits.findIndex(unit => unit.id === event.unit.id);

    if (existingUnitIndex === -1) {
      nextUnits.push(cloneIngestUnit(event.unit));
    } else {
      nextUnits[existingUnitIndex] = cloneIngestUnit(event.unit);
    }

    nextUnits.sort((left, right) => left.sequence - right.sequence);

    return {
      ...prev,
      processEntries: {
        ...prev.processEntries,
        [fileId]: {
          ...existing,
          path: fullPath,
          displayPath: getDisplayPath(fullPath),
          status: 'processing',
          startedAt: existing.startedAt ?? Date.now(),
          completedAt: undefined,
          result: {
            ...sourceResult,
            previewKind: event.previewKind,
            sourceId: event.sourceId,
            sourceType: event.sourceType,
            title: event.title,
            totalUnitCount: event.totalUnitCount,
            totalCharCount: event.totalCharCount,
            rawPreview: event.rawPreview,
            units: nextUnits,
          },
        },
      },
    };
  });
}

function completeProcessingEntry(fileId: string, fullPath: string, result: IngestResult, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const completedAt = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fileId] ?? buildInitialEntry(fileId, fullPath);
    const steps = [...existing.steps];
    const lastStep = steps[steps.length - 1];

    if (lastStep && lastStep.status === 'running') {
      steps[steps.length - 1] = {
        ...lastStep,
        status: 'completed',
        completedAt,
      };
    }

    return {
      ...prev,
      files: prev.files.map(file => file.id === fileId
        ? {
          ...file,
          sourceId: result.sourceId,
          knowledgeBaseId: result.knowledgeBaseId,
          sourceSyncStatus: 'synced',
          syncedCanonicalPath: fullPath,
          sourceSyncError: undefined,
        }
        : file),
      processEntries: {
        ...prev.processEntries,
        [fileId]: {
          ...existing,
          path: fullPath,
          displayPath: getDisplayPath(fullPath),
          status: 'completed',
          steps,
          completedAt,
          startedAt: existing.startedAt ?? completedAt,
          result,
          errorMessage: undefined,
        },
      },
    };
  });
}

function failProcessingEntry(fileId: string, fullPath: string, errorMessage: string, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const completedAt = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fileId] ?? buildInitialEntry(fileId, fullPath);
    const steps = [...existing.steps];
    const lastStep = steps[steps.length - 1];

    if (lastStep && lastStep.status === 'running') {
      steps[steps.length - 1] = {
        ...lastStep,
        status: 'completed',
        completedAt,
      };
    }

    steps.push({
      id: steps.length + 1,
      message: `處理失敗：${errorMessage}`,
      status: 'error',
      startedAt: completedAt,
      completedAt,
    });

    return {
      ...prev,
      processEntries: {
        ...prev.processEntries,
        [fileId]: {
          ...existing,
          path: fullPath,
          displayPath: getDisplayPath(fullPath),
          status: 'error',
          steps,
          startedAt: existing.startedAt ?? completedAt,
          completedAt,
          errorMessage,
        },
      },
    };
  });
}

async function processStreamResponse(res: Response, fileId: string, fullPath: string, generation: number): Promise<IngestResult> {
  if (!res.ok) {
    throw new Error(await readIngestError(res));
  }

  if (!res.body) {
    throw new Error('Response body is empty');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: IngestResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = JSON.parse(line) as IngestStreamEvent;

      if (event.type === 'step') {
        appendProcessStep(fileId, fullPath, event.message, generation);
        continue;
      }

      if (event.type === 'unit') {
        mergeUnitResult(fileId, fullPath, event, generation);
        continue;
      }

      if (event.type === 'error') {
        throw new Error(event.error);
      }

      finalResult = event.result;
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as IngestStreamEvent;

    if (event.type === 'step') {
      appendProcessStep(fileId, fullPath, event.message, generation);
    } else if (event.type === 'unit') {
      mergeUnitResult(fileId, fullPath, event, generation);
    } else if (event.type === 'error') {
      throw new Error(event.error);
    } else {
      finalResult = event.result;
    }
  }

  if (!finalResult) {
    throw new Error('No final result returned from ingest stream');
  }

  completeProcessingEntry(fileId, fullPath, finalResult, generation);
  return finalResult;
}

async function processCurrentFile(generation: number) {
  const snapshot = state;
  const fileId = snapshot.currentFileId;
  const file = snapshot.files.find(item => item.id === fileId);

  if (!file) {
    return;
  }

  startProcessingEntry(file.id, file.workbenchPath, generation);

  try {
    if (!snapshot.activeKnowledgeBaseId) {
      throw new Error('No active knowledge base selected');
    }

    const res = await startIngestRequest({
      file: file.file,
      knowledgeBaseId: snapshot.activeKnowledgeBaseId,
      filePath: file.workbenchPath,
    });
    await processStreamResponse(res, file.id, file.workbenchPath, generation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    failProcessingEntry(file.id, file.workbenchPath, message, generation);
  } finally {
    if (isCurrentGeneration(generation)) {
      setState(prev => ({
        ...prev,
        currentFileId: getNextIdleFileId(prev),
      }));
    }
  }
}

async function runQueue() {
  if (processingPromise) {
    return processingPromise;
  }

  const generation = queueGeneration;

  processingPromise = (async () => {
    while (true) {
      const snapshot = state;

      if (!isCurrentGeneration(generation) || snapshot.processMode !== 'playing') {
        return;
      }

      if (!snapshot.currentFileId) {
        setState(prev => ({
          ...prev,
          processMode: 'idle',
        }));
        return;
      }

      await processCurrentFile(generation);
    }
  })().finally(() => {
    processingPromise = null;
  });

  return processingPromise;
}

async function syncMovedPaths(changedFileIds: string[]) {
  if (changedFileIds.length === 0) {
    return;
  }

  const generation = queueGeneration;
  const pendingItems = collectPathSyncItems(state.files, changedFileIds);

  if (pendingItems.length === 0 || !isCurrentGeneration(generation)) {
    return;
  }

  const pendingIds = new Set(pendingItems.map(item => item.fileId));

  setState(prev => ({
    ...prev,
    files: prev.files.map(file => pendingIds.has(file.id)
      ? { ...file, sourceSyncStatus: 'syncing-path', sourceSyncError: undefined }
      : file),
  }));

  const itemsByKnowledgeBase = new Map<string, typeof pendingItems>();
  for (const item of pendingItems) {
    const group = itemsByKnowledgeBase.get(item.knowledgeBaseId) ?? [];
    group.push(item);
    itemsByKnowledgeBase.set(item.knowledgeBaseId, group);
  }

  const successfulFileIds = new Set<string>();
  const failedFileIds = new Map<string, string>();

  for (const [knowledgeBaseId, items] of itemsByKnowledgeBase.entries()) {
    try {
      await repathKnowledgeSources(knowledgeBaseId, items.map(item => ({
        sourceId: item.sourceId,
        canonicalPath: item.canonicalPath,
      })));
      items.forEach(item => successfulFileIds.add(item.fileId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      items.forEach(item => failedFileIds.set(item.fileId, message));
    }
  }

  if (!isCurrentGeneration(generation)) {
    return;
  }

  setState(prev => ({
    ...prev,
    files: prev.files.map(file => {
      if (successfulFileIds.has(file.id)) {
        return {
          ...file,
          sourceSyncStatus: 'synced',
          syncedCanonicalPath: file.workbenchPath,
          sourceSyncError: undefined,
        };
      }

      const errorMessage = failedFileIds.get(file.id);
      if (!errorMessage) {
        return file;
      }

      return {
        ...file,
        sourceSyncStatus: 'sync-error',
        sourceSyncError: errorMessage,
      };
    }),
  }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useWorkbenchQueueState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const workbenchQueue = {
  subscribe,
  getSnapshot,
  hasActiveRuntime() {
    return state.files.length > 0 || processingPromise !== null;
  },
  isStructureLocked() {
    return hasLockedStructure(state) || state.processMode === 'playing';
  },
  addFiles(newFiles: ExtendedFile[]) {
    if (newFiles.length === 0) {
      return;
    }

    setState(prev => {
      const existingPaths = new Set(prev.files.map(file => file.workbenchPath));
      const records = newFiles
        .filter(file => {
          const path = file.path || file.name;
          return !existingPaths.has(path);
        })
        .map(createWorkbenchFileRecord);

      if (records.length === 0) {
        return prev;
      }

      const nextFiles = [...prev.files, ...records];
      const nextTree = records.reduce((tree, file) => insertWorkbenchFile(tree, file), prev.tree);
      const nextEntries = syncEntriesToFiles(nextFiles, prev.processEntries);

      return {
        ...prev,
        files: nextFiles,
        tree: nextTree,
        processEntries: nextEntries,
        currentFileId: getNextIdleFileId({ files: nextFiles, tree: nextTree, processEntries: nextEntries }),
      };
    });
  },
  async moveNode(input: { sourceNodeId: string; targetNodeId: string | null; position: WorkbenchDropPosition }) {
    if (workbenchQueue.isStructureLocked()) {
      throw new Error('目前正在處理或同步路徑，暫時不能調整結構。');
    }

    let changedFileIds: string[] = [];

    setState(prev => {
      const moved = moveWorkbenchNode({
        tree: prev.tree,
        files: prev.files,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        position: input.position,
      });
      changedFileIds = moved.changedFileIds;
      const nextFiles = markFilesAfterPathChange(moved.files, moved.changedFileIds);
      const nextEntries = syncEntriesToFiles(nextFiles, prev.processEntries);

      return {
        ...prev,
        files: nextFiles,
        tree: moved.tree,
        processEntries: nextEntries,
        currentFileId: getNextIdleFileId({ files: nextFiles, tree: moved.tree, processEntries: nextEntries }),
      };
    });

    await syncMovedPaths(changedFileIds);
  },
  deleteNode(nodeId: string) {
    if (workbenchQueue.isStructureLocked()) {
      return [] as string[];
    }

    queueGeneration += 1;

    let removedFileIds: string[] = [];

    setState(prev => {
      const deleted = deleteWorkbenchNode({
        tree: prev.tree,
        files: prev.files,
        nodeId,
      });
      removedFileIds = deleted.removedFileIds;
      const nextEntries = syncEntriesToFiles(deleted.files, prev.processEntries);

      return {
        ...prev,
        files: deleted.files,
        tree: deleted.tree,
        processEntries: nextEntries,
        processMode: 'idle',
        currentFileId: getNextIdleFileId({ files: deleted.files, tree: deleted.tree, processEntries: nextEntries }),
      };
    });

    return removedFileIds;
  },
  async clear() {
    queueGeneration += 1;
    lastPersistedFileSignature = '';
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
    }

    state = INITIAL_STATE;
    emitChange();

    if (canUseSessionPersistence()) {
      await clearStoredSession().catch(error => {
        console.error('Failed to clear stored session:', error);
      });
    }
  },
  restoreSession(input: RestoreQueueStateInput) {
    queueGeneration += 1;

    const normalizedFiles = input.files.map(file => {
      file.file.path = file.workbenchPath;
      return file;
    });
    const normalizedTree = Object.keys(input.tree.nodes).length > 0
      ? input.tree
      : buildInitialWorkbenchTree(normalizedFiles);
    const normalizedEntries = syncEntriesToFiles(
      normalizedFiles,
      Object.fromEntries(Object.entries(input.processEntries).map(([fileId, entry]) => {
        const file = normalizedFiles.find(item => item.id === fileId);
        if (!file || entry.status === 'processing') {
          return [fileId, file ? buildInitialEntry(fileId, file.workbenchPath) : entry];
        }

        return [fileId, syncEntryPath({ ...entry, fileId }, file.workbenchPath)];
      })),
    );

    setState({
      files: normalizedFiles,
      tree: normalizedTree,
      processEntries: normalizedEntries,
      currentFileId: normalizedEntries[input.currentFileId ?? '']?.status === 'idle'
        ? input.currentFileId
        : getNextIdleFileId({ files: normalizedFiles, tree: normalizedTree, processEntries: normalizedEntries }),
      processMode: 'idle',
      activeKnowledgeBaseId: input.activeKnowledgeBaseId,
    });
  },
  setActiveKnowledgeBaseId(activeKnowledgeBaseId: string | null) {
    setState(prev => {
      if (prev.activeKnowledgeBaseId === activeKnowledgeBaseId) {
        return prev;
      }

      return {
        ...prev,
        activeKnowledgeBaseId,
      };
    });
  },
  startProcessing() {
    setState(prev => {
      if (prev.files.length === 0) {
        return prev;
      }

      const idleFileId = getNextIdleFileId(prev);
      if (!idleFileId) {
        const nextEntries = buildResetEntries(prev.files);
        return {
          ...prev,
          processEntries: nextEntries,
          currentFileId: getNextIdleFileId({ files: prev.files, tree: prev.tree, processEntries: nextEntries }),
          processMode: 'playing',
        };
      }

      return {
        ...prev,
        currentFileId: idleFileId,
        processMode: 'playing',
      };
    });

    void runQueue();
  },
  pauseProcessing() {
    setState(prev => ({
      ...prev,
      processMode: 'paused',
    }));
  },
  stopProcessing() {
    setState(prev => ({
      ...prev,
      processMode: 'idle',
      currentFileId: getNextIdleFileId(prev),
    }));
  },
  async processNext() {
    const snapshot = state;

    if (processingPromise || !snapshot.currentFileId) {
      return;
    }

    setState(prev => ({
      ...prev,
      processMode: 'paused',
    }));

    const generation = queueGeneration;
    await processCurrentFile(generation);
  },
};
