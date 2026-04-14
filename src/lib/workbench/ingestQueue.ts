'use client';

import { useSyncExternalStore } from 'react';
import type { ExtendedFile } from '@/components/ui/DropZone';
import type { IngestStreamEvent } from '@/features/ingest/contracts';
import {
  canUseSessionPersistence,
  clearStoredSession,
  saveSessionSnapshot,
  syncSessionFiles,
} from '@/lib/storage/sessionStore';
import { getDisplayPath } from '@/lib/workbench/formatting';
import { IMAGE_FILE_PATTERN } from '@/lib/workbench/filePreview';
import type {
  FileProcessEntry,
  IngestResult,
  IngestUnit,
  ProcessStepEntry,
} from '@/lib/workbench/types';

export type WorkbenchProcessMode = 'idle' | 'playing' | 'paused';

export interface WorkbenchQueueSnapshot {
  files: ExtendedFile[];
  processEntries: Record<string, FileProcessEntry>;
  processMode: WorkbenchProcessMode;
  currentIndex: number;
  activeKnowledgeBaseId: string | null;
}

interface RestoreQueueStateInput {
  files: ExtendedFile[];
  processEntries: Record<string, FileProcessEntry>;
  currentIndex: number;
  activeKnowledgeBaseId: string | null;
}

const INITIAL_STATE: WorkbenchQueueSnapshot = {
  files: [],
  processEntries: {},
  processMode: 'idle',
  currentIndex: 0,
  activeKnowledgeBaseId: null,
};

let state: WorkbenchQueueSnapshot = INITIAL_STATE;
let processingPromise: Promise<void> | null = null;
let persistTimer: number | null = null;
let lastPersistedFileSignature = '';
let queueGeneration = 0;

const listeners = new Set<() => void>();

function getFullPath(file: ExtendedFile) {
  return file.path || file.name;
}

function sortFiles(files: ExtendedFile[]) {
  const docs = files.filter(file => !IMAGE_FILE_PATTERN.test(file.name));
  const images = files.filter(file => IMAGE_FILE_PATTERN.test(file.name));
  return [...docs, ...images];
}

function buildInitialEntry(fullPath: string): FileProcessEntry {
  return {
    path: fullPath,
    displayPath: getDisplayPath(fullPath),
    status: 'idle',
    steps: [],
  };
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

function cloneUnit(unit: IngestUnit): IngestUnit {
  return {
    ...unit,
    meta: {
      ...unit.meta,
      terms: [...unit.meta.terms],
      entities: [...unit.meta.entities],
      relationHints: unit.meta.relationHints.map(relation => ({ ...relation })),
    },
    relatedUnits: unit.relatedUnits.map(relation => ({ ...relation })),
  };
}

function cloneKnowledgeContext(trace?: IngestResult['knowledgeContext']) {
  if (!trace) {
    return undefined;
  }

  return {
    ...trace,
    usedSources: trace.usedSources.map(source => ({ ...source })),
  };
}

function serializeResult(result?: IngestResult) {
  if (!result) return undefined;

  return {
    ...result,
    meta: {
      ...result.meta,
      terms: [...result.meta.terms],
      entities: [...result.meta.entities],
      structure: result.meta.structure ? { ...result.meta.structure } : undefined,
    },
    knowledgeContext: cloneKnowledgeContext(result.knowledgeContext),
    units: result.units.map(cloneUnit),
  } satisfies IngestResult;
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

function buildPersistedFileRecord(file: ExtendedFile) {
  return {
    path: getFullPath(file),
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
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

  const sortedFiles = sortFiles(snapshot.files);
  if (sortedFiles.length === 0) {
    lastPersistedFileSignature = '';
    await clearStoredSession().catch(error => {
      console.error('Failed to clear stored session:', error);
    });
    return;
  }

  const fileOrder = sortedFiles.map(getFullPath);
  const processEntries: Record<string, ReturnType<typeof serializeEntry>> = {};

  for (const path of fileOrder) {
    processEntries[path] = serializeEntry(snapshot.processEntries[path] ?? buildInitialEntry(path));
  }

  await saveSessionSnapshot({
    activeKnowledgeBaseId: snapshot.activeKnowledgeBaseId,
    fileOrder,
    processEntries,
  }).catch(error => {
    console.error('Failed to save session snapshot:', error);
  });

  const fileSignature = sortedFiles
    .map(file => `${getFullPath(file)}:${file.size}:${file.lastModified}`)
    .join('|');

  if (fileSignature === lastPersistedFileSignature) {
    return;
  }

  lastPersistedFileSignature = fileSignature;

  await syncSessionFiles(sortedFiles.map(buildPersistedFileRecord)).catch(error => {
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

function startProcessingEntry(fullPath: string, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const startedAt = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fullPath] ?? buildInitialEntry(fullPath);
    return {
      ...prev,
      processEntries: {
        ...prev.processEntries,
        [fullPath]: {
          ...existing,
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

function appendProcessStep(fullPath: string, message: string, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const timestamp = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fullPath] ?? buildInitialEntry(fullPath);
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
        [fullPath]: {
          ...existing,
          status: 'processing',
          startedAt: existing.startedAt ?? timestamp,
          completedAt: undefined,
          steps,
        },
      },
    };
  });
}

function mergeUnitResult(fullPath: string, event: Extract<IngestStreamEvent, { type: 'unit' }>, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  setState(prev => {
    const existing = prev.processEntries[fullPath] ?? buildInitialEntry(fullPath);
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
      nextUnits.push(cloneUnit(event.unit));
    } else {
      nextUnits[existingUnitIndex] = cloneUnit(event.unit);
    }

    nextUnits.sort((left, right) => left.sequence - right.sequence);

    return {
      ...prev,
      processEntries: {
        ...prev.processEntries,
        [fullPath]: {
          ...existing,
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

function completeProcessingEntry(fullPath: string, result: IngestResult, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const completedAt = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fullPath] ?? buildInitialEntry(fullPath);
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
      processEntries: {
        ...prev.processEntries,
        [fullPath]: {
          ...existing,
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

function failProcessingEntry(fullPath: string, errorMessage: string, generation: number) {
  if (!isCurrentGeneration(generation)) {
    return;
  }

  const completedAt = Date.now();

  setState(prev => {
    const existing = prev.processEntries[fullPath] ?? buildInitialEntry(fullPath);
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
        [fullPath]: {
          ...existing,
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

async function processStreamResponse(res: Response, fullPath: string, generation: number): Promise<IngestResult> {
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
      if (!line.trim()) continue;

      const event = JSON.parse(line) as IngestStreamEvent;

      if (event.type === 'step') {
        appendProcessStep(fullPath, event.message, generation);
        continue;
      }

      if (event.type === 'unit') {
        mergeUnitResult(fullPath, event, generation);
        continue;
      }

      if (event.type === 'error') {
        throw new Error(event.error);
      }

      finalResult = event.result;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as IngestStreamEvent;

    if (event.type === 'step') {
      appendProcessStep(fullPath, event.message, generation);
    } else if (event.type === 'unit') {
      mergeUnitResult(fullPath, event, generation);
    } else if (event.type === 'error') {
      throw new Error(event.error);
    } else {
      finalResult = event.result;
    }
  }

  if (!finalResult) {
    throw new Error('No final result returned from ingest stream');
  }

  completeProcessingEntry(fullPath, finalResult, generation);
  return finalResult;
}

async function processCurrentFile(generation: number) {
  const snapshot = state;
  const sortedFiles = sortFiles(snapshot.files);
  const file = sortedFiles[snapshot.currentIndex];

  if (!file) {
    return;
  }

  const fullPath = getFullPath(file);
  startProcessingEntry(fullPath, generation);

  try {
    if (!snapshot.activeKnowledgeBaseId) {
      throw new Error('No active knowledge base selected');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledgeBaseId', snapshot.activeKnowledgeBaseId);
    formData.append('filePath', fullPath);

    const res = await fetch('/api/ingest', { method: 'POST', body: formData });
    await processStreamResponse(res, fullPath, generation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    failProcessingEntry(fullPath, message, generation);
  } finally {
    if (isCurrentGeneration(generation)) {
      setState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
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
      const sortedFiles = sortFiles(snapshot.files);

      if (!isCurrentGeneration(generation) || snapshot.processMode !== 'playing') {
        return;
      }

      if (snapshot.currentIndex >= sortedFiles.length) {
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
  addFiles(newFiles: ExtendedFile[]) {
    if (newFiles.length === 0) {
      return;
    }

    setState(prev => {
      const existingPaths = new Set(prev.files.map(getFullPath));
      const filteredNewFiles = newFiles.filter(file => !existingPaths.has(getFullPath(file)));

      if (filteredNewFiles.length === 0) {
        return prev;
      }

      const nextEntries = { ...prev.processEntries };
      for (const file of filteredNewFiles) {
        const fullPath = getFullPath(file);
        nextEntries[fullPath] = nextEntries[fullPath] ?? buildInitialEntry(fullPath);
      }

      return {
        ...prev,
        files: [...prev.files, ...filteredNewFiles],
        processEntries: nextEntries,
      };
    });
  },
  deleteByPath(path: string) {
    queueGeneration += 1;

    setState(prev => {
      const nextFiles = prev.files.filter(file => !getFullPath(file).startsWith(path));
      const nextEntries = { ...prev.processEntries };

      for (const key of Object.keys(nextEntries)) {
        if (key.startsWith(path)) {
          delete nextEntries[key];
        }
      }

      return {
        ...prev,
        files: nextFiles,
        processEntries: nextEntries,
        processMode: nextFiles.length === 0 ? 'idle' : 'idle',
        currentIndex: Math.min(prev.currentIndex, sortFiles(nextFiles).length),
      };
    });
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
    setState({
      files: input.files,
      processEntries: input.processEntries,
      currentIndex: input.currentIndex,
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
      const sortedFiles = sortFiles(prev.files);

      if (sortedFiles.length === 0) {
        return prev;
      }

      if (prev.currentIndex >= sortedFiles.length) {
        const nextEntries: Record<string, FileProcessEntry> = {};

        for (const file of sortedFiles) {
          const fullPath = getFullPath(file);
          nextEntries[fullPath] = buildInitialEntry(fullPath);
        }

        return {
          ...prev,
          processEntries: nextEntries,
          currentIndex: 0,
          processMode: 'playing',
        };
      }

      return {
        ...prev,
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
    }));
  },
  async processNext() {
    const snapshot = state;
    const sortedFiles = sortFiles(snapshot.files);

    if (processingPromise || snapshot.currentIndex >= sortedFiles.length) {
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