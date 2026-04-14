'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Database,
  FileText,
  FolderClock,
  Image as ImageIcon,
  LoaderCircle,
  Network,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
  Eraser,
} from 'lucide-react';
import { DropZone, ExtendedFile } from '@/components/ui/DropZone';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { FileTree } from '@/components/ui/FileTree';
import { ProcessTimeline } from '@/components/ui/ProcessTimeline';
import { RagQueryPanel } from '@/components/ui/RagQueryPanel';
import { Button } from '@/components/ui/Button';
import {
  canUseSessionPersistence,
  clearStoredSession,
  loadRestorableSession,
  type PersistedFileProcessEntry,
  type PersistedFileRecord,
  type PersistedProcessStepEntry,
  type PersistedSessionSnapshot,
  saveSessionSnapshot,
  syncSessionFiles,
} from '@/lib/storage/sessionStore';
import type { IngestStreamEvent } from '@/features/ingest/contracts';
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  type KnowledgeBaseMaintenanceAction,
  type KnowledgeBaseRecord,
} from '@/features/ingest/knowledge';
import { formatDuration, formatSavedAt, getDisplayPath, getStatusLabel } from '@/lib/workbench/formatting';
import { IMAGE_FILE_PATTERN } from '@/lib/workbench/filePreview';
import type {
  DocumentChunkAnalysis,
  DocumentIngestResult,
  FileProcessEntry,
  FileProcessStatus,
  IngestResult,
  ProcessStepEntry,
} from '@/lib/workbench/types';
import { useLiveNow } from '@/lib/workbench/useLiveNow';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';

type PersistencePhase = 'checking' | 'prompt' | 'ready';

interface RestorePromptState {
  snapshot: PersistedSessionSnapshot;
  files: PersistedFileRecord[];
}

const FALLBACK_KNOWLEDGE_BASE_ID = '00000000-0000-0000-0000-000000000001';
const FALLBACK_KNOWLEDGE_BASE: KnowledgeBaseRecord = {
  id: FALLBACK_KNOWLEDGE_BASE_ID,
  slug: DEFAULT_KNOWLEDGE_BASE_SLUG,
  name: DEFAULT_KNOWLEDGE_BASE_NAME,
  status: 'active',
  sourceCount: 0,
  chunkCount: 0,
  profileVersion: 0,
};

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


function rebuildExtendedFile(record: PersistedFileRecord): ExtendedFile {
  const file = new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  }) as ExtendedFile;

  file.path = record.path;
  return file;
}

function cloneChunkAnalysis(chunk: DocumentChunkAnalysis): DocumentChunkAnalysis {
  return {
    ...chunk,
    keywords: [...chunk.keywords],
    relatedChunks: chunk.relatedChunks.map(relation => ({ ...relation })),
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

  if (result.type === 'image') {
    return {
      ...result,
      knowledgeContext: cloneKnowledgeContext(result.knowledgeContext),
    } satisfies IngestResult;
  }

  return {
    ...result,
    knowledgeContext: cloneKnowledgeContext(result.knowledgeContext),
    chunkAnalyses: result.chunkAnalyses.map(cloneChunkAnalysis),
  } satisfies IngestResult;
}

function normalizeRestoredResult(result?: IngestResult) {
  return serializeResult(result);
}

function serializeSteps(steps: ProcessStepEntry[]): PersistedProcessStepEntry[] {
  return steps.map(step => ({
    id: step.id,
    message: step.message,
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
  }));
}

function serializeEntry(entry: FileProcessEntry): PersistedFileProcessEntry {
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

function normalizeRestoredEntry(entry: PersistedFileProcessEntry): FileProcessEntry {
  const restoredAt = Date.now();
  const normalizedSteps: ProcessStepEntry[] = entry.steps.map(step => ({
    ...step,
    status: step.status === 'running' ? 'completed' : step.status,
    completedAt: step.completedAt ?? restoredAt,
  }));

  if (entry.status === 'processing') {
    normalizedSteps.push({
      id: normalizedSteps.length + 1,
      message: '上次執行中斷，等待重新執行。',
      status: 'error',
      startedAt: restoredAt,
      completedAt: restoredAt,
    });
  }

  return {
    path: entry.path,
    displayPath: entry.displayPath,
    status: entry.status === 'processing' ? 'error' : entry.status,
    steps: normalizedSteps,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    result: normalizeRestoredResult(entry.result),
    errorMessage: entry.status === 'processing'
      ? '上次執行中斷，可直接 Resume 繼續。'
      : entry.errorMessage,
  };
}

function buildPersistedFileRecord(file: ExtendedFile): PersistedFileRecord {
  return {
    path: file.path || file.name,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
  };
}

function countRunnablePaths(snapshot: PersistedSessionSnapshot) {
  return snapshot.fileOrder.filter(path => {
    const entry = snapshot.processEntries[path];
    return (entry?.status ?? 'idle') !== 'completed';
  }).length;
}

const ProcessDurationValue = React.memo(({ entry }: { entry: FileProcessEntry }) => {
  const liveNow = useLiveNow(entry.status === 'processing');

  if (!entry.startedAt) {
    return <strong className={styles.processDurationValue}>0.0s</strong>;
  }

  const duration = formatDuration((entry.completedAt ?? liveNow ?? entry.startedAt) - entry.startedAt);
  return <strong className={styles.processDurationValue}>{duration}</strong>;
});
ProcessDurationValue.displayName = 'ProcessDurationValue';

export default function DataWorkbench() {
  const router = useRouter();
  const [files, setFiles] = useState<ExtendedFile[]>([]);
  const [processMode, setProcessMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);
  const [processEntries, setProcessEntries] = useState<Record<string, FileProcessEntry>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = useState<string | null>(null);
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('');
  const [knowledgeBaseError, setKnowledgeBaseError] = useState<string | null>(null);
  const [isCreatingKnowledgeBase, setIsCreatingKnowledgeBase] = useState(false);
  const [maintenanceState, setMaintenanceState] = useState<{ action: KnowledgeBaseMaintenanceAction; knowledgeBaseId: string } | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [persistencePhase, setPersistencePhase] = useState<PersistencePhase>('checking');
  const [restorePrompt, setRestorePrompt] = useState<RestorePromptState | null>(null);
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] = useState(false);
  const lastPersistedFileSignatureRef = useRef('');

  const activeKnowledgeBase = useMemo(
    () => knowledgeBases.find(knowledgeBase => knowledgeBase.id === activeKnowledgeBaseId) ?? null,
    [activeKnowledgeBaseId, knowledgeBases],
  );

  const sortedFiles = useMemo(() => {
    const docs = files.filter(file => !IMAGE_FILE_PATTERN.test(file.name));
    const imgs = files.filter(file => IMAGE_FILE_PATTERN.test(file.name));
    return [...docs, ...imgs];
  }, [files]);

  const selectedPreviewFile = useMemo(
    () => sortedFiles.find(file => (file.path || file.name) === selectedPreviewPath) ?? null,
    [selectedPreviewPath, sortedFiles],
  );

  const buildInitialEntry = useCallback((fullPath: string): FileProcessEntry => ({
    path: fullPath,
    displayPath: getDisplayPath(fullPath),
    status: 'idle',
    steps: [],
  }), []);

  const selectedPreviewEntry = useMemo(() => {
    if (!selectedPreviewPath) return null;
    return processEntries[selectedPreviewPath] ?? buildInitialEntry(selectedPreviewPath);
  }, [buildInitialEntry, processEntries, selectedPreviewPath]);

  const allPaths = useMemo(
    () => sortedFiles.map(file => file.path || file.name),
    [sortedFiles],
  );

  const resumablePaths = useMemo(
    () => allPaths.filter(path => (processEntries[path]?.status ?? 'idle') !== 'completed'),
    [allPaths, processEntries],
  );

  const sessionEntries = useMemo(() => {
    const nextEntries: Record<string, PersistedFileProcessEntry> = {};

    for (const path of allPaths) {
      nextEntries[path] = serializeEntry(processEntries[path] ?? buildInitialEntry(path));
    }

    return nextEntries;
  }, [allPaths, buildInitialEntry, processEntries]);

  const sessionFileSignature = useMemo(
    () => sortedFiles.map(file => `${file.path || file.name}:${file.size}:${file.lastModified}`).join('|'),
    [sortedFiles],
  );

  const fileStatuses = useMemo(() => {
    const nextStatuses: Record<string, FileProcessStatus | undefined> = {};

    for (const path of allPaths) {
      nextStatuses[path] = processEntries[path]?.status;
    }

    return nextStatuses;
  }, [allPaths, processEntries]);

  const refreshKnowledgeBases = useCallback(async (preferredKnowledgeBaseId?: string | null) => {
    try {
      setKnowledgeBaseError(null);
      const response = await fetch('/api/knowledge-bases');

      if (!response.ok) {
        throw new Error(`Knowledge base request failed: ${response.status}`);
      }

      const data = await response.json();
      let nextKnowledgeBases = (data.knowledgeBases ?? []) as KnowledgeBaseRecord[];

      if (nextKnowledgeBases.length === 0) {
        const createResponse = await fetch('/api/knowledge-bases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: FALLBACK_KNOWLEDGE_BASE_ID,
            slug: DEFAULT_KNOWLEDGE_BASE_SLUG,
            name: DEFAULT_KNOWLEDGE_BASE_NAME,
            description: 'Default knowledge base for thesis research ingestion.',
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create default knowledge base: ${createResponse.status}`);
        }

        const created = await createResponse.json();
        nextKnowledgeBases = [created.knowledgeBase as KnowledgeBaseRecord];
      }

      setKnowledgeBases(nextKnowledgeBases);
      setActiveKnowledgeBaseId(current => {
        const candidate = preferredKnowledgeBaseId ?? current ?? nextKnowledgeBases[0]?.id ?? null;
        if (candidate && nextKnowledgeBases.some(knowledgeBase => knowledgeBase.id === candidate)) {
          return candidate;
        }

        return nextKnowledgeBases[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      setKnowledgeBaseError(error instanceof Error ? error.message : String(error));
      setKnowledgeBases([FALLBACK_KNOWLEDGE_BASE]);
      setActiveKnowledgeBaseId(preferredKnowledgeBaseId ?? FALLBACK_KNOWLEDGE_BASE_ID);
    }
  }, []);

  const createKnowledgeBase = useCallback(async () => {
    const trimmedName = newKnowledgeBaseName.trim();

    if (!trimmedName) {
      return;
    }

    setIsCreatingKnowledgeBase(true);
    setKnowledgeBaseError(null);

    try {
      const response = await fetch('/api/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create knowledge base: ${response.status}`);
      }

      const data = await response.json();
      const created = data.knowledgeBase as KnowledgeBaseRecord;

      setKnowledgeBases(prev => {
        const next = [...prev.filter(knowledgeBase => knowledgeBase.id !== created.id), created];
        next.sort((left, right) => left.name.localeCompare(right.name));
        return next;
      });
      setActiveKnowledgeBaseId(created.id);
      setNewKnowledgeBaseName('');
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      setKnowledgeBaseError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingKnowledgeBase(false);
    }
  }, [newKnowledgeBaseName]);

  const deleteActiveKnowledgeBase = useCallback(async () => {
    if (!activeKnowledgeBaseId || knowledgeBases.length <= 1) {
      return;
    }

    const knowledgeBaseToDelete = knowledgeBases.find(knowledgeBase => knowledgeBase.id === activeKnowledgeBaseId);
    if (!knowledgeBaseToDelete) {
      return;
    }

    const confirmed = window.confirm(`Delete knowledge base "${knowledgeBaseToDelete.name}"? This will remove its stored documents and chunks.`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/knowledge-bases?id=${encodeURIComponent(activeKnowledgeBaseId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete knowledge base: ${response.status}`);
      }

      if (processMode !== 'idle') {
        setProcessMode('idle');
      }

      await refreshKnowledgeBases();
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
      setKnowledgeBaseError(error instanceof Error ? error.message : String(error));
    }
  }, [activeKnowledgeBaseId, knowledgeBases, processMode, refreshKnowledgeBases]);

  const runKnowledgeBaseMaintenance = useCallback(async (action: KnowledgeBaseMaintenanceAction) => {
    if (!activeKnowledgeBaseId || !activeKnowledgeBase) {
      return;
    }

    const actionLabel = action === 'reindex' ? 'reindex this knowledge base' : 'rebuild the knowledge profile';
    const confirmed = window.confirm(`Run ${actionLabel} for "${activeKnowledgeBase.name}"?`);

    if (!confirmed) {
      return;
    }

    setMaintenanceState({ action, knowledgeBaseId: activeKnowledgeBaseId });
    setKnowledgeBaseError(null);
    setMaintenanceMessage(null);

    try {
      const response = await fetch(`/api/knowledge-bases/${encodeURIComponent(activeKnowledgeBaseId)}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Maintenance request failed: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result as {
        action: KnowledgeBaseMaintenanceAction;
        sourceCount: number;
        chunkCount: number;
        imageCount: number;
        profileVersion?: number;
      };

      setMaintenanceMessage(
        action === 'reindex'
          ? `Reindex completed: ${result.chunkCount} chunks and ${result.imageCount} images refreshed. Profile v${result.profileVersion ?? '-'}.`
          : `Knowledge profile rebuilt: ${result.sourceCount} sources, ${result.chunkCount} chunks, profile v${result.profileVersion ?? '-'}.`,
      );
      await refreshKnowledgeBases(activeKnowledgeBaseId);
    } catch (error) {
      console.error('Knowledge base maintenance failed:', error);
      setKnowledgeBaseError(error instanceof Error ? error.message : String(error));
    } finally {
      setMaintenanceState(null);
    }
  }, [activeKnowledgeBase, activeKnowledgeBaseId, refreshKnowledgeBases]);

  const handleClearKnowledgeBaseData = useCallback(async () => {
    if (!activeKnowledgeBaseId) return;
    if (!window.confirm('Are you absolutely sure you want to clear ALL document and vector data inside this Knowledge Base? This action cannot be undone.')) {
      return;
    }
    
    try {
      setKnowledgeBaseError(null);
      setMaintenanceMessage('Clearing KB data...');
      const res = await fetch(`/api/graph?kbId=${activeKnowledgeBaseId}&deleteAll=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear KB data');
      
      setMaintenanceMessage('KB data successfully cleared.');
      void refreshKnowledgeBases(activeKnowledgeBaseId);
    } catch (err: any) {
      setKnowledgeBaseError(err.message);
      setMaintenanceMessage(null);
    }
  }, [activeKnowledgeBaseId, refreshKnowledgeBases]);

  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      await refreshKnowledgeBases();

      if (!canUseSessionPersistence()) {
        if (!ignore) {
          setPersistencePhase('ready');
        }
        return;
      }

      try {
        const restorableSession = await loadRestorableSession();

        if (ignore) return;

        if (restorableSession && restorableSession.files.length > 0) {
          setRestorePrompt({
            snapshot: restorableSession.snapshot,
            files: restorableSession.files,
          });

          if (restorableSession.snapshot.activeKnowledgeBaseId) {
            void refreshKnowledgeBases(restorableSession.snapshot.activeKnowledgeBaseId);
          }

          setPersistencePhase('prompt');
        } else {
          setPersistencePhase('ready');
        }
      } catch (error) {
        console.error('Failed to hydrate stored session:', error);
        if (!ignore) {
          setPersistencePhase('ready');
        }
      }
    };

    void bootstrap();

    return () => {
      ignore = true;
    };
  }, [refreshKnowledgeBases]);

  useEffect(() => {
    if (persistencePhase !== 'ready' || !canUseSessionPersistence()) {
      return;
    }

    if (allPaths.length === 0) {
      void clearStoredSession();
      return;
    }

    void saveSessionSnapshot({
      activeKnowledgeBaseId,
      fileOrder: allPaths,
      processEntries: sessionEntries,
    }).catch(error => {
      console.error('Failed to save session snapshot:', error);
    });
  }, [activeKnowledgeBaseId, allPaths, persistencePhase, sessionEntries]);

  useEffect(() => {
    if (persistencePhase !== 'ready' || !canUseSessionPersistence()) {
      return;
    }

    if (sessionFileSignature === lastPersistedFileSignatureRef.current) {
      return;
    }

    lastPersistedFileSignatureRef.current = sessionFileSignature;

    if (sortedFiles.length === 0) {
      void clearStoredSession();
      return;
    }

    void syncSessionFiles(sortedFiles.map(buildPersistedFileRecord)).catch(error => {
      console.error('Failed to sync session files:', error);
    });
  }, [persistencePhase, sessionFileSignature, sortedFiles]);

  useEffect(() => {
    if (!selectedPreviewPath) return;

    const previewStillExists = sortedFiles.some(file => (file.path || file.name) === selectedPreviewPath);
    if (!previewStillExists) {
      setSelectedPreviewPath(null);
    }
  }, [selectedPreviewPath, sortedFiles]);

  const ensureEntry = useCallback((fullPath: string) => {
    setProcessEntries(prev => {
      if (prev[fullPath]) return prev;
      return { ...prev, [fullPath]: buildInitialEntry(fullPath) };
    });
  }, [buildInitialEntry]);

  const startProcessingEntry = useCallback((fullPath: string) => {
    const startedAt = Date.now();

    setProcessEntries(prev => {
      const existing = prev[fullPath] ?? buildInitialEntry(fullPath);
      return {
        ...prev,
        [fullPath]: {
          ...existing,
          status: 'processing',
          startedAt,
          completedAt: undefined,
          errorMessage: undefined,
          result: undefined,
          steps: [],
        },
      };
    });
  }, [buildInitialEntry]);

  const appendProcessStep = useCallback((fullPath: string, message: string) => {
    const timestamp = Date.now();

    setProcessEntries(prev => {
      const existing = prev[fullPath] ?? buildInitialEntry(fullPath);
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
        [fullPath]: {
          ...existing,
          status: 'processing',
          startedAt: existing.startedAt ?? timestamp,
          completedAt: undefined,
          steps,
        },
      };
    });
  }, [buildInitialEntry]);

  const mergeChunkResult = useCallback((fullPath: string, event: Extract<IngestStreamEvent, { type: 'chunk' }>) => {
    setProcessEntries(prev => {
      const existing = prev[fullPath] ?? buildInitialEntry(fullPath);
      const documentResult = existing.result?.type === 'document'
        ? existing.result
        : {
            type: 'document',
            knowledgeBaseId: event.knowledgeBaseId,
            knowledgeBaseName: event.knowledgeBaseName,
            previewKind: event.previewKind,
            documentId: event.documentId,
            chunkCount: event.chunkCount,
            totalCharCount: event.totalCharCount,
            parsedTextPreview: event.parsedTextPreview,
            chunkAnalyses: [],
          } satisfies DocumentIngestResult;

      const nextChunkAnalyses = [...documentResult.chunkAnalyses];
      const existingChunkIndex = nextChunkAnalyses.findIndex(chunk => chunk.id === event.chunk.id);

      if (existingChunkIndex === -1) {
        nextChunkAnalyses.push(cloneChunkAnalysis(event.chunk));
      } else {
        nextChunkAnalyses[existingChunkIndex] = cloneChunkAnalysis(event.chunk);
      }

      nextChunkAnalyses.sort((left, right) => left.index - right.index);

      return {
        ...prev,
        [fullPath]: {
          ...existing,
          status: 'processing',
          startedAt: existing.startedAt ?? Date.now(),
          completedAt: undefined,
          result: {
            ...documentResult,
            previewKind: event.previewKind,
            documentId: event.documentId,
            chunkCount: event.chunkCount,
            totalCharCount: event.totalCharCount,
            parsedTextPreview: event.parsedTextPreview,
            chunkAnalyses: nextChunkAnalyses,
          },
        },
      };
    });
  }, [buildInitialEntry]);

  const completeProcessingEntry = useCallback((fullPath: string, result: IngestResult) => {
    const completedAt = Date.now();

    setProcessEntries(prev => {
      const existing = prev[fullPath] ?? buildInitialEntry(fullPath);
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
        [fullPath]: {
          ...existing,
          status: 'completed',
          steps,
          completedAt,
          startedAt: existing.startedAt ?? completedAt,
          result,
          errorMessage: undefined,
        },
      };
    });
  }, [buildInitialEntry]);

  const failProcessingEntry = useCallback((fullPath: string, errorMessage: string) => {
    const completedAt = Date.now();

    setProcessEntries(prev => {
      const existing = prev[fullPath] ?? buildInitialEntry(fullPath);
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
        [fullPath]: {
          ...existing,
          status: 'error',
          steps,
          startedAt: existing.startedAt ?? completedAt,
          completedAt,
          errorMessage,
        },
      };
    });
  }, [buildInitialEntry]);

  const resetProcessEntries = useCallback((targetFiles: ExtendedFile[]) => {
    setProcessEntries(() => {
      const nextEntries: Record<string, FileProcessEntry> = {};
      for (const file of targetFiles) {
        const fullPath = file.path || file.name;
        nextEntries[fullPath] = buildInitialEntry(fullPath);
      }
      return nextEntries;
    });
    setExpandedPaths({});
  }, [buildInitialEntry]);

  const processStreamResponse = useCallback(async (res: Response, fullPath: string): Promise<IngestResult> => {
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
          appendProcessStep(fullPath, event.message);
          continue;
        }

        if (event.type === 'chunk') {
          mergeChunkResult(fullPath, event);
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
        appendProcessStep(fullPath, event.message);
      } else if (event.type === 'chunk') {
        mergeChunkResult(fullPath, event);
      } else if (event.type === 'error') {
        throw new Error(event.error);
      } else {
        finalResult = event.result;
      }
    }

    if (!finalResult) {
      throw new Error('No final result returned from ingest stream');
    }

    completeProcessingEntry(fullPath, finalResult);
    return finalResult;
  }, [appendProcessStep, completeProcessingEntry, mergeChunkResult]);

  const processFile = useCallback(async (file: ExtendedFile) => {
    const fullPath = file.path || file.name;

    setHighlightedPath(fullPath);
    ensureEntry(fullPath);
    startProcessingEntry(fullPath);

    try {
      if (!activeKnowledgeBaseId) {
        throw new Error('No active knowledge base selected');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('knowledgeBaseId', activeKnowledgeBaseId);
      formData.append('filePath', fullPath);

      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      await processStreamResponse(res, fullPath);
      void refreshKnowledgeBases(activeKnowledgeBaseId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      failProcessingEntry(fullPath, message);
    } finally {
      setCurrentIndex(prev => prev + 1);
    }
  }, [activeKnowledgeBaseId, ensureEntry, failProcessingEntry, processStreamResponse, refreshKnowledgeBases, startProcessingEntry]);

  useEffect(() => {
    let ignore = false;

    const processNext = async () => {
      if (processMode !== 'playing' || ignore) return;
      if (currentIndex >= sortedFiles.length) {
        setProcessMode('idle');
        return;
      }

      await processFile(sortedFiles[currentIndex]);
    };

    if (processMode === 'playing') {
      const timer = window.setTimeout(() => {
        void processNext();
      }, 200);

      return () => {
        ignore = true;
        window.clearTimeout(timer);
      };
    }
  }, [currentIndex, processFile, processMode, sortedFiles]);

  const handleDelete = async (path: string) => {
    if (persistencePhase === 'prompt' && canUseSessionPersistence()) {
      await clearStoredSession().catch(error => {
        console.error('Failed to clear stored session before delete:', error);
      });
      setRestorePrompt(null);
      setPersistencePhase('ready');
    }

    setFiles(prev => prev.filter(file => !(file.path || file.name).startsWith(path)));
    setProcessEntries(prev => {
      const nextEntries = { ...prev };
      for (const key of Object.keys(nextEntries)) {
        if (key.startsWith(path)) {
          delete nextEntries[key];
        }
      }
      return nextEntries;
    });
    setExpandedPaths(prev => {
      const nextExpanded = { ...prev };
      for (const key of Object.keys(nextExpanded)) {
        if (key.startsWith(path)) {
          delete nextExpanded[key];
        }
      }
      return nextExpanded;
    });
    if (processMode !== 'idle') setProcessMode('idle');
    if (highlightedPath?.startsWith(path)) setHighlightedPath(null);
    if (selectedPreviewPath?.startsWith(path)) setSelectedPreviewPath(null);
  };

  const handleDrop = async (newFiles: ExtendedFile[]) => {
    if (persistencePhase === 'prompt' && canUseSessionPersistence()) {
      await clearStoredSession().catch(error => {
        console.error('Failed to clear stored session before starting a new queue:', error);
      });
      setRestorePrompt(null);
      setPersistencePhase('ready');
    }

    setFiles(prev => {
      const existingPaths = prev.map(file => file.path || file.name);
      const filteredNew = newFiles.filter(file => !existingPaths.includes(file.path || file.name));

      if (filteredNew.length > 0) {
        setProcessEntries(prevEntries => {
          const nextEntries = { ...prevEntries };
          for (const file of filteredNew) {
            const fullPath = file.path || file.name;
            nextEntries[fullPath] = nextEntries[fullPath] ?? buildInitialEntry(fullPath);
          }
          return nextEntries;
        });
      }

      return [...prev, ...filteredNew];
    });
  };

  const handlePlay = () => {
    if (currentIndex >= sortedFiles.length) {
      setCurrentIndex(0);
      resetProcessEntries(sortedFiles);
    }
    setProcessMode('playing');
  };

  const handlePause = () => setProcessMode('paused');

  const handleNext = async () => {
    if (currentIndex >= sortedFiles.length) return;
    setProcessMode('paused');
    await processFile(sortedFiles[currentIndex]);
  };

  const handleClear = async () => {
    setFiles([]);
    setProcessEntries({});
    setExpandedPaths({});
    setCurrentIndex(0);
    setProcessMode('idle');
    setHighlightedPath(null);
    setSelectedPreviewPath(null);
    setRestorePrompt(null);
    setPersistencePhase('ready');
    lastPersistedFileSignatureRef.current = '';

    if (canUseSessionPersistence()) {
      await clearStoredSession().catch(error => {
        console.error('Failed to clear stored session:', error);
      });
    }
  };

  const handleRestoreSession = () => {
    if (!restorePrompt) return;

    const restoredFiles = restorePrompt.files.map(rebuildExtendedFile);
    const restoredEntries: Record<string, FileProcessEntry> = {};

    for (const path of restorePrompt.snapshot.fileOrder) {
      const entry = restorePrompt.snapshot.processEntries[path];
      if (entry) {
        restoredEntries[path] = normalizeRestoredEntry(entry);
      } else {
        restoredEntries[path] = buildInitialEntry(path);
      }
    }

    setFiles(restoredFiles);
    setProcessEntries(restoredEntries);
    setExpandedPaths({});
    const restoredNextRunnableIndex = restorePrompt.snapshot.fileOrder.findIndex(path => {
      const entry = restoredEntries[path];
      return (entry?.status ?? 'idle') !== 'completed';
    });
    setCurrentIndex(restoredNextRunnableIndex === -1 ? restorePrompt.snapshot.fileOrder.length : restoredNextRunnableIndex);
    setProcessMode('idle');
    setHighlightedPath(null);
    setSelectedPreviewPath(null);
    if (restorePrompt.snapshot.activeKnowledgeBaseId) {
      setActiveKnowledgeBaseId(restorePrompt.snapshot.activeKnowledgeBaseId);
      void refreshKnowledgeBases(restorePrompt.snapshot.activeKnowledgeBaseId);
    }
    setRestorePrompt(null);
    setPersistencePhase('ready');
    lastPersistedFileSignatureRef.current = '';
  };

  const handleDiscardStoredSession = async () => {
    await handleClear();
  };

  const toggleExpanded = (fullPath: string) => {
    setExpandedPaths(prev => ({
      ...prev,
      [fullPath]: !prev[fullPath],
    }));
    setHighlightedPath(fullPath);
  };

  const handleSelectPreview = useCallback((fullPath: string) => {
    setSelectedPreviewPath(fullPath);
  }, []);

  const orderedEntries = sortedFiles.map(file => {
    const fullPath = file.path || file.name;
    return processEntries[fullPath] ?? buildInitialEntry(fullPath);
  });

  return (
    <div className={styles.layoutContainer}>
      <header className={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className={styles.logo}>
            <Sparkles className="text-gradient" size={24} />
            <span className="text-gradient">ThesisGen</span>
          </div>
          <div className={styles.badgesRow} style={{ marginTop: 0 }}>
            <div className={styles.badge}><Cpu size={14} /> <b>qwen3.5:27b</b></div>
            <div className={styles.badge}><ImageIcon size={14} /> <b>qwen3-vl:32b</b></div>
            <div className={styles.badge}><Box size={14} /> <b>embeddings</b></div>
          </div>
        </div>

        <nav className={styles.navMenu}>
          <Button variant="secondary" onClick={() => setIsKnowledgeBaseModalOpen(true)}>
            <Database size={16} /> Knowledge Base
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => {
              if (activeKnowledgeBaseId) {
                router.push(`/graph?kbId=${encodeURIComponent(activeKnowledgeBaseId)}`);
              } else {
                alert('Please select a Knowledge Base first.');
              }
            }}
          >
            <Network size={16} /> Visualize Graph
          </Button>
          <Button variant="ghost"><FileText size={16} /> Writing Desk</Button>
          <Button variant="ghost"><Settings size={16} /> Settings</Button>
        </nav>
      </header>

      <div className={styles.mainWrapper}>
        <aside className={styles.sidebarContainer}>
          <DropZone onDrop={files => void handleDrop(files)} isCompact={files.length > 0} />

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 className={styles.sidebarSectionTitle} style={{ margin: 0 }}>Files ({files.length})</h3>
                <Button variant="ghost" onClick={() => void handleClear()} style={{ padding: '4px 8px', fontSize: '0.8rem', height: 'auto' }}>Clear</Button>
              </div>
              <FileTree
                files={files}
                onDelete={path => void handleDelete(path)}
                highlightedPath={highlightedPath}
                selectedPath={selectedPreviewPath}
                statuses={fileStatuses}
                onSelectFile={node => handleSelectPreview(node.path)}
              />
            </div>
          )}
        </aside>

        <main className={styles.mainPanel}>
          <div className={styles.workingArea}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>RAG Knowledge Extraction Engine</h3>
                <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Active KB: {activeKnowledgeBase?.name || 'Loading knowledge base...'}
                  <button 
                    onClick={() => setIsKnowledgeBaseModalOpen(true)} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
                    title="Manage Knowledge Base"
                  >
                    <Settings size={14} />
                  </button>
                </div>
              </div>

              {files.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {processMode === 'playing' ? (
                    <Button variant="secondary" onClick={handlePause}><Square size={14} /> Stop</Button>
                  ) : (
                    <Button variant="primary" onClick={handlePlay} disabled={!activeKnowledgeBaseId}><Play size={14} /> {currentIndex > 0 && currentIndex < sortedFiles.length ? 'Resume' : 'Start Auto'}</Button>
                  )}
                  <Button variant="secondary" onClick={() => void handleNext()} disabled={processMode === 'playing' || !activeKnowledgeBaseId}><SkipForward size={14} /> Next Step</Button>
                </div>
              )}
            </div>

            <Modal
              isOpen={isKnowledgeBaseModalOpen}
              onClose={() => setIsKnowledgeBaseModalOpen(false)}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={20} className="text-secondary" />
                  <span>Knowledge Base Management</span>
                </div>
              }
              maxWidth="650px"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Current Status</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                      {activeKnowledgeBase ? `${activeKnowledgeBase.sourceCount} sources · ${activeKnowledgeBase.chunkCount} chunks` : 'No KB loaded'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Select Knowledge Base</label>
                  <Select
                    value={activeKnowledgeBaseId ?? ''}
                    onChange={val => setActiveKnowledgeBaseId(val)}
                    options={knowledgeBases.map(kb => ({ value: kb.id, label: kb.name }))}
                    placeholder="Loading..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Create New</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        value={newKnowledgeBaseName}
                        onChange={event => setNewKnowledgeBaseName(event.target.value)}
                        placeholder="New knowledge base name..."
                      />
                    </div>
                    <Button variant="secondary" onClick={() => void createKnowledgeBase()} disabled={isCreatingKnowledgeBase || !newKnowledgeBaseName.trim()}>
                      {isCreatingKnowledgeBase ? <LoaderCircle size={16} className={styles.spinningIcon} /> : <Database size={16} />} Create
                    </Button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Maintenance Actions</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button
                      variant="secondary"
                      onClick={() => void runKnowledgeBaseMaintenance('rebuild-profile')}
                      disabled={!activeKnowledgeBaseId || maintenanceState !== null}
                    >
                      {maintenanceState?.action === 'rebuild-profile' ? <LoaderCircle size={14} className={styles.spinningIcon} /> : <RotateCcw size={14} />} Rebuild Profile
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void runKnowledgeBaseMaintenance('reindex')}
                      disabled={!activeKnowledgeBaseId || maintenanceState !== null}
                    >
                      {maintenanceState?.action === 'reindex' ? <LoaderCircle size={14} className={styles.spinningIcon} /> : <Box size={14} />} Reindex KB
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => void handleClearKnowledgeBaseData()} 
                      disabled={!activeKnowledgeBaseId}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Eraser size={14} /> Clear Data
                    </Button>
                    <Button variant="ghost" onClick={() => void deleteActiveKnowledgeBase()} disabled={knowledgeBases.length <= 1 || !activeKnowledgeBaseId}>
                      <Trash2 size={14} /> Delete KB
                    </Button>
                  </div>
                </div>

                {activeKnowledgeBase?.description && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px', lineHeight: 1.5 }}>
                    {activeKnowledgeBase.description}
                  </div>
                )}
                {maintenanceMessage && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{maintenanceMessage}</div>
                )}
                {knowledgeBaseError && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--accent-red)' }}>{knowledgeBaseError}</div>
                )}
              </div>
            </Modal>

            {persistencePhase === 'prompt' && restorePrompt && (
              <div className={styles.resumeBanner}>
                <div className={styles.resumeBannerIcon}>
                  <FolderClock size={20} />
                </div>
                <div className={styles.resumeBannerContent}>
                  <div className={styles.resumeBannerTitle}>發現上次未完成的處理紀錄</div>
                  <div className={styles.resumeBannerText}>
                    已保存 {restorePrompt.files.length} 個檔案的執行紀錄。上次保存時間：{formatSavedAt(restorePrompt.snapshot.savedAt)}。其中 {countRunnablePaths(restorePrompt.snapshot) > 0 ? `${countRunnablePaths(restorePrompt.snapshot)} 個檔案可直接接續` : '所有檔案都已完成，可保留紀錄或重新開始'}。{restorePrompt.snapshot.activeKnowledgeBaseId ? ' 恢復後會切回當時的 active knowledge base。' : ''}
                  </div>
                </div>
                <div className={styles.resumeBannerActions}>
                  <Button variant="primary" onClick={handleRestoreSession}><RotateCcw size={14} /> 恢復接續</Button>
                  <Button variant="secondary" onClick={() => void handleDiscardStoredSession()}><Trash2 size={14} /> 清空紀錄</Button>
                </div>
              </div>
            )}

            {persistencePhase === 'ready' && sortedFiles.length > 0 && (
              <div className={styles.persistenceSummary}>
                目前已保存 {sortedFiles.length} 個檔案的執行紀錄，其中 {resumablePaths.length} 個仍可接續處理。Active KB：{activeKnowledgeBase?.name || '未指定'}。
              </div>
            )}

            <div className={styles.processAccordionList}>
              {orderedEntries.length === 0 ? (
                <div className={styles.processEmptyState}>
                  {persistencePhase === 'checking' ? 'Checking previous session...' : 'Upload files and press Start to begin RAG extraction step-by-step.'}
                </div>
              ) : (
                orderedEntries.map(entry => {
                  const isExpanded = !!expandedPaths[entry.path];

                  return (
                    <section key={entry.path} className={`${styles.processCard} ${styles[`processCard${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`] || ''}`}>
                      <button type="button" className={styles.processCardHeader} onClick={() => toggleExpanded(entry.path)}>
                        <div className={styles.processCardHeaderLeft}>
                          <ChevronRight size={18} className={`${styles.processChevron} ${isExpanded ? styles.processChevronExpanded : ''}`} />
                          <div className={styles.processCardTitleGroup}>
                            <div className={styles.processCardTitle}>{entry.displayPath}</div>
                            <div className={styles.processCardMetaRow}>
                              <span className={`${styles.processStatusBadge} ${styles[`processStatus${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`]}`}>
                                {entry.status === 'processing'
                                  ? <LoaderCircle size={14} className={styles.spinningIcon} />
                                  : entry.status === 'completed'
                                    ? <CheckCircle2 size={14} />
                                    : entry.status === 'error'
                                      ? <AlertCircle size={14} />
                                      : <Clock3 size={14} />}
                                {getStatusLabel(entry.status)}
                              </span>
                              {entry.errorMessage && <span className={styles.processErrorText}>{entry.errorMessage}</span>}
                            </div>
                          </div>
                        </div>

                        <div className={styles.processCardHeaderRight}>
                          <span className={styles.processDurationLabel}>{entry.status === 'completed' ? '總時間' : '經過時間'}</span>
                          <ProcessDurationValue entry={entry} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className={styles.processCardBody}>
                          <ProcessTimeline entry={entry} showStructuredOutput />
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>

      <FilePreviewModal
        isOpen={!!selectedPreviewFile && !!selectedPreviewEntry}
        file={selectedPreviewFile}
        entry={selectedPreviewEntry}
        onClose={() => setSelectedPreviewPath(null)}
      />

      <RagQueryPanel knowledgeBaseId={activeKnowledgeBaseId} knowledgeBaseName={activeKnowledgeBase?.name} />
    </div>
  );
}
