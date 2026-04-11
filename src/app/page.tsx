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
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { DropZone, ExtendedFile } from '@/components/ui/DropZone';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { FileTree } from '@/components/ui/FileTree';
import { ProcessTimeline } from '@/components/ui/ProcessTimeline';
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
import { formatDuration, formatSavedAt, getDisplayPath, getStatusLabel } from '@/lib/workbench/formatting';
import { IMAGE_FILE_PATTERN } from '@/lib/workbench/filePreview';
import type { FileProcessEntry, FileProcessStatus, IngestResult, ProcessStepEntry } from '@/lib/workbench/types';
import { useLiveNow } from '@/lib/workbench/useLiveNow';
import styles from './page.module.css';

type StreamEvent =
  | { type: 'step'; message: string }
  | { type: 'result'; result: IngestResult }
  | { type: 'error'; error: string };
type PersistencePhase = 'checking' | 'prompt' | 'ready';

interface RestorePromptState {
  snapshot: PersistedSessionSnapshot;
  files: PersistedFileRecord[];
}


function rebuildExtendedFile(record: PersistedFileRecord): ExtendedFile {
  const file = new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  }) as ExtendedFile;

  file.path = record.path;
  return file;
}

function serializeResult(result?: IngestResult) {
  if (!result) return undefined;

  return {
    type: result.type,
    previewKind: result.previewKind,
    chunks: result.chunks,
    summary: result.summary,
    description: result.description,
    descriptionSnippet: result.descriptionSnippet,
    contextApplied: result.contextApplied,
    parsedTextPreview: result.parsedTextPreview,
    chunkPreviews: result.chunkPreviews,
  } satisfies IngestResult;
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
    result: entry.result,
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

  const duration = formatDuration((entry.completedAt ?? liveNow) - entry.startedAt);
  return <strong className={styles.processDurationValue}>{duration}</strong>;
});

export default function DataWorkbench() {
  const [files, setFiles] = useState<ExtendedFile[]>([]);
  const [processMode, setProcessMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);
  const [processEntries, setProcessEntries] = useState<Record<string, FileProcessEntry>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [globalContextValue, setGlobalContextValue] = useState('');
  const [persistencePhase, setPersistencePhase] = useState<PersistencePhase>('checking');
  const [restorePrompt, setRestorePrompt] = useState<RestorePromptState | null>(null);
  const globalContextRef = useRef<string>('');
  const lastPersistedFileSignatureRef = useRef('');

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

  const appendGlobalContext = useCallback((text: string) => {
    if (!text.trim()) return;
    globalContextRef.current += `\n${text}`;
    setGlobalContextValue(globalContextRef.current);
  }, []);

  useEffect(() => {
    let ignore = false;

    const hydrateSession = async () => {
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

    void hydrateSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (persistencePhase !== 'ready' || !canUseSessionPersistence()) {
      return;
    }

    if (allPaths.length === 0) {
      void clearStoredSession();
      return;
    }

    void saveSessionSnapshot({
      globalContext: globalContextValue,
      fileOrder: allPaths,
      processEntries: sessionEntries,
    }).catch(error => {
      console.error('Failed to save session snapshot:', error);
    });
  }, [allPaths, globalContextValue, persistencePhase, sessionEntries]);

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
      throw new Error(`HTTP ${res.status}`);
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

        const event = JSON.parse(line) as StreamEvent;

        if (event.type === 'step') {
          appendProcessStep(fullPath, event.message);
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
      const event = JSON.parse(buffer) as StreamEvent;

      if (event.type === 'step') {
        appendProcessStep(fullPath, event.message);
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
  }, [appendProcessStep, completeProcessingEntry]);

  const processFile = useCallback(async (file: ExtendedFile) => {
    const fullPath = file.path || file.name;

    setHighlightedPath(fullPath);
    ensureEntry(fullPath);
    startProcessingEntry(fullPath);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('globalContext', globalContextRef.current);

      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      const result = await processStreamResponse(res, fullPath);

      if (result.summary) {
        appendGlobalContext(result.summary);
      }
      if (result.description) {
        appendGlobalContext(result.description);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      failProcessingEntry(fullPath, message);
    } finally {
      setCurrentIndex(prev => prev + 1);
    }
  }, [appendGlobalContext, ensureEntry, failProcessingEntry, processStreamResponse, startProcessingEntry]);

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
      globalContextRef.current = '';
      setGlobalContextValue('');
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
      globalContextRef.current = '';
      setGlobalContextValue('');
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
    globalContextRef.current = '';
    setGlobalContextValue('');
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
    globalContextRef.current = restorePrompt.snapshot.globalContext;
    setGlobalContextValue(restorePrompt.snapshot.globalContext);
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
            <div className={styles.badge}><Box size={14} /> <b>pgvector</b></div>
          </div>
        </div>

        <nav className={styles.navMenu}>
          <Button variant="secondary"><Database size={16} /> Data Source</Button>
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>RAG Knowledge Extraction Engine</h3>

              {files.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {processMode === 'playing' ? (
                    <Button variant="secondary" onClick={handlePause}><Square size={14} /> Stop</Button>
                  ) : (
                    <Button variant="primary" onClick={handlePlay}><Play size={14} /> {currentIndex > 0 && currentIndex < sortedFiles.length ? 'Resume' : 'Start Auto'}</Button>
                  )}
                  <Button variant="secondary" onClick={() => void handleNext()} disabled={processMode === 'playing'}><SkipForward size={14} /> Next Step</Button>
                </div>
              )}
            </div>

            {persistencePhase === 'prompt' && restorePrompt && (
              <div className={styles.resumeBanner}>
                <div className={styles.resumeBannerIcon}>
                  <FolderClock size={20} />
                </div>
                <div className={styles.resumeBannerContent}>
                  <div className={styles.resumeBannerTitle}>發現上次未完成的處理紀錄</div>
                  <div className={styles.resumeBannerText}>
                    已保存 {restorePrompt.files.length} 個檔案的執行紀錄。上次保存時間：{formatSavedAt(restorePrompt.snapshot.savedAt)}。其中 {countRunnablePaths(restorePrompt.snapshot) > 0 ? `${countRunnablePaths(restorePrompt.snapshot)} 個檔案可直接接續` : '所有檔案都已完成，可保留紀錄或重新開始'}。
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
                目前已保存 {sortedFiles.length} 個檔案的執行紀錄，其中 {resumablePaths.length} 個仍可接續處理。
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
    </div>
  );
}
