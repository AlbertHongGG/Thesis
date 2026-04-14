'use client';

import { motion, AnimatePresence } from 'framer-motion';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useToast } from '@/components/ui/Toast';
import {
  canUseSessionPersistence,
  clearStoredSession,
  loadRestorableSession,
  type PersistedFileProcessEntry,
  type PersistedFileRecord,
  type PersistedSessionSnapshot,
} from '@/lib/storage/sessionStore';
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  type KnowledgeBaseMaintenanceAction,
  type KnowledgeBaseRecord,
} from '@/features/ingest/knowledge';
import { formatDuration, formatSavedAt, getDisplayPath, getStatusLabel } from '@/lib/workbench/formatting';
import { IMAGE_FILE_PATTERN } from '@/lib/workbench/filePreview';
import { useWorkbenchQueueState, workbenchQueue } from '@/lib/workbench/ingestQueue';
import type {
  FileProcessEntry,
  FileProcessStatus,
  IngestUnit,
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
  unitCount: 0,
  profileVersion: 0,
};


function rebuildExtendedFile(record: PersistedFileRecord): ExtendedFile {
  const file = new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  }) as ExtendedFile;

  file.path = record.path;
  return file;
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

function normalizeRestoredResult(result?: IngestResult) {
  return serializeResult(result);
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
  const { files, processEntries, processMode, currentIndex, activeKnowledgeBaseId } = useWorkbenchQueueState();
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('');
  const [isCreatingKnowledgeBase, setIsCreatingKnowledgeBase] = useState(false);
  const [maintenanceState, setMaintenanceState] = useState<{ action: KnowledgeBaseMaintenanceAction; knowledgeBaseId: string } | null>(null);
  const [persistencePhase, setPersistencePhase] = useState<PersistencePhase>('checking');
  const [restorePrompt, setRestorePrompt] = useState<RestorePromptState | null>(null);
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] = useState(false);
  const { toast } = useToast();

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

  const fileStatuses = useMemo(() => {
    const nextStatuses: Record<string, FileProcessStatus | undefined> = {};

    for (const path of allPaths) {
      nextStatuses[path] = processEntries[path]?.status;
    }

    return nextStatuses;
  }, [allPaths, processEntries]);

  const refreshKnowledgeBases = useCallback(async (preferredKnowledgeBaseId?: string | null) => {
    try {
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
      const currentActiveKnowledgeBaseId = workbenchQueue.getSnapshot().activeKnowledgeBaseId;
      const candidate = preferredKnowledgeBaseId ?? currentActiveKnowledgeBaseId ?? nextKnowledgeBases[0]?.id ?? null;
      const resolvedKnowledgeBaseId = candidate && nextKnowledgeBases.some(knowledgeBase => knowledgeBase.id === candidate)
        ? candidate
        : (nextKnowledgeBases[0]?.id ?? null);

      workbenchQueue.setActiveKnowledgeBaseId(resolvedKnowledgeBaseId);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      toast(error instanceof Error ? error.message : String(error), 'error');
      setKnowledgeBases([FALLBACK_KNOWLEDGE_BASE]);
      workbenchQueue.setActiveKnowledgeBaseId(preferredKnowledgeBaseId ?? FALLBACK_KNOWLEDGE_BASE_ID);
    }
  }, [toast]);

  const createKnowledgeBase = useCallback(async () => {
    const trimmedName = newKnowledgeBaseName.trim();

    if (!trimmedName) {
      return;
    }

    setIsCreatingKnowledgeBase(true);

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
      workbenchQueue.setActiveKnowledgeBaseId(created.id);
      setNewKnowledgeBaseName('');
      toast(`Knowledge base "${created.name}" created.`, 'success');
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setIsCreatingKnowledgeBase(false);
    }
  }, [newKnowledgeBaseName, toast]);

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
        workbenchQueue.stopProcessing();
      }

      await refreshKnowledgeBases();
      toast(`Knowledge base deleted.`, 'success');
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  }, [activeKnowledgeBaseId, knowledgeBases, processMode, refreshKnowledgeBases, toast]);

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
    toast(action === 'reindex' ? 'Reindexing KB...' : 'Rebuilding profile...', 'info');

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
        unitCount: number;
        profileVersion?: number;
      };

      toast(
        action === 'reindex'
          ? `Reindex completed: ${result.unitCount} units. Profile v${result.profileVersion ?? '-'}.`
          : `Knowledge profile rebuilt successfully!`,
        'success'
      );
      await refreshKnowledgeBases(activeKnowledgeBaseId);
    } catch (error) {
      console.error('Knowledge base maintenance failed:', error);
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setMaintenanceState(null);
    }
  }, [activeKnowledgeBase, activeKnowledgeBaseId, refreshKnowledgeBases, toast]);

  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      const runtimeSnapshot = workbenchQueue.getSnapshot();
      await refreshKnowledgeBases(runtimeSnapshot.activeKnowledgeBaseId);

      if (workbenchQueue.hasActiveRuntime()) {
        if (!ignore) {
          setPersistencePhase('ready');
        }
        return;
      }

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
    if (!selectedPreviewPath) return;

    const previewStillExists = sortedFiles.some(file => (file.path || file.name) === selectedPreviewPath);
    if (!previewStillExists) {
      setSelectedPreviewPath(null);
    }
  }, [selectedPreviewPath, sortedFiles]);

  const handleDelete = async (path: string) => {
    if (persistencePhase === 'prompt' && canUseSessionPersistence()) {
      await clearStoredSession().catch(error => {
        console.error('Failed to clear stored session before delete:', error);
      });
      setRestorePrompt(null);
      setPersistencePhase('ready');
    }

    workbenchQueue.deleteByPath(path);
    setExpandedPaths(prev => {
      const nextExpanded = { ...prev };
      for (const key of Object.keys(nextExpanded)) {
        if (key.startsWith(path)) {
          delete nextExpanded[key];
        }
      }
      return nextExpanded;
    });
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

    workbenchQueue.addFiles(newFiles);
  };

  const handlePlay = () => {
    workbenchQueue.startProcessing();
  };

  const handlePause = () => workbenchQueue.pauseProcessing();

  const handleNext = async () => {
    if (currentIndex >= sortedFiles.length) return;
    await workbenchQueue.processNext();
  };

  const handleClear = async () => {
    await workbenchQueue.clear();
    setExpandedPaths({});
    setHighlightedPath(null);
    setSelectedPreviewPath(null);
    setRestorePrompt(null);
    setPersistencePhase('ready');
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

    setExpandedPaths({});
    const restoredNextRunnableIndex = restorePrompt.snapshot.fileOrder.findIndex(path => {
      const entry = restoredEntries[path];
      return (entry?.status ?? 'idle') !== 'completed';
    });
    workbenchQueue.restoreSession({
      files: restoredFiles,
      processEntries: restoredEntries,
      currentIndex: restoredNextRunnableIndex === -1 ? restorePrompt.snapshot.fileOrder.length : restoredNextRunnableIndex,
      activeKnowledgeBaseId: restorePrompt.snapshot.activeKnowledgeBaseId ?? null,
    });
    setHighlightedPath(null);
    setSelectedPreviewPath(null);
    if (restorePrompt.snapshot.activeKnowledgeBaseId) {
      void refreshKnowledgeBases(restorePrompt.snapshot.activeKnowledgeBaseId);
    }
    setRestorePrompt(null);
    setPersistencePhase('ready');
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

      <motion.div layout className={styles.mainWrapper} style={{ display: 'flex', gap: '1px', background: 'var(--border-color)', flex: 1, overflow: 'hidden' }}>
        <AnimatePresence initial={false}>
          {files.length > 0 && (
            <motion.aside 
              className={styles.sidebarContainer}
              initial={{ width: 0, opacity: 0, x: -50 }}
              animate={{ width: 360, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -50 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', padding: files.length > 0 ? 'var(--space-5)' : 0 }}
            >
              <div style={{ width: 320, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <DropZone onDrop={files => void handleDrop(files)} isCompact={true} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', marginTop: '0.75rem' }}>
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
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <motion.main layout className={styles.mainPanel} style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
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
                      {activeKnowledgeBase ? `${activeKnowledgeBase.sourceCount} sources · ${activeKnowledgeBase.unitCount} units` : 'No KB loaded'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Select Knowledge Base</label>
                  <Select
                    value={activeKnowledgeBaseId ?? ''}
                    onChange={val => workbenchQueue.setActiveKnowledgeBaseId(val)}
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
                    <Button variant="ghost" onClick={() => void deleteActiveKnowledgeBase()} disabled={knowledgeBases.length <= 1 || !activeKnowledgeBaseId}>
                      <Trash2 size={14} /> Delete KB
                    </Button>
                  </div>
                </div>

                {activeKnowledgeBase?.description && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: '8px', lineHeight: 1.5 }}>
                    {activeKnowledgeBase.description}
                  </div>
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
              <AnimatePresence mode="wait">
                {orderedEntries.length === 0 ? (
                  <motion.div 
                    key="empty-state"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}
                  >
                    <DropZone onDrop={files => void handleDrop(files)} isHero={true} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="entry-list"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, staggerChildren: 0.1 }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  >
                    {orderedEntries.map(entry => {
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
                })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.main>
      </motion.div>

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
