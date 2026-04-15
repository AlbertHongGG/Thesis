'use client';

import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderClock,
  LoaderCircle,
  Play,
  SkipForward,
  Square,
  Trash2,
} from 'lucide-react';
import { DropZone, type ExtendedFile } from '@/components/ui/DropZone';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
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
import { formatDuration, formatSavedAt, getDisplayPath, getStatusLabel } from '@/lib/workbench/formatting';
import { getOrderedFileIds } from '@/lib/workbench/treeState';
import { useWorkbenchQueueState, workbenchQueue } from '@/lib/workbench/ingestQueue';
import type {
  FileProcessEntry,
  FileProcessStatus,
  ProcessStepEntry,
  WorkbenchFileRecord,
} from '@/lib/workbench/types';
import { useLiveNow } from '@/lib/workbench/useLiveNow';
import { useKnowledgeBaseWorkspace } from '@/modules/shared/client/KnowledgeBaseWorkspaceProvider';
import { cloneIngestResult } from '@/modules/workspace/client/ingestSnapshot';
import styles from '@/app/page.module.css';

type PersistencePhase = 'checking' | 'prompt' | 'ready';

interface RestorePromptState {
  snapshot: PersistedSessionSnapshot;
  files: PersistedFileRecord[];
}

function rebuildWorkbenchFile(record: PersistedFileRecord): WorkbenchFileRecord {
  const file = new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  }) as ExtendedFile;

  file.path = record.workbenchPath;

  return {
    id: record.id,
    file,
    name: record.name,
    type: record.type,
    size: record.size,
    lastModified: record.lastModified,
    originalPath: record.originalPath,
    workbenchPath: record.workbenchPath,
    sourceSyncStatus: record.sourceSyncStatus,
    sourceSyncError: record.sourceSyncError,
    syncedCanonicalPath: record.syncedCanonicalPath,
    sourceId: record.sourceId,
    knowledgeBaseId: record.knowledgeBaseId,
  };
}

function normalizeRestoredEntry(entry: PersistedFileProcessEntry): FileProcessEntry {
  const restoredAt = Date.now();
  const normalizedSteps: ProcessStepEntry[] = entry.steps.map(step => ({
    ...step,
    status: step.status === 'running' ? 'completed' : step.status,
    completedAt: step.completedAt ?? restoredAt,
  }));

  return {
    fileId: entry.fileId,
    path: entry.path,
    displayPath: entry.displayPath,
    status: entry.status,
    steps: normalizedSteps,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    result: cloneIngestResult(entry.result),
    errorMessage: entry.errorMessage,
  };
}

function countRunnablePaths(snapshot: PersistedSessionSnapshot) {
  return Object.values(snapshot.processEntries).filter(entry => {
    const status = entry?.status ?? 'idle';
    return status === 'idle' || status === 'processing';
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

function renderPersistenceBadge(entry: FileProcessEntry) {
  if (!entry.result) {
    return null;
  }

  const committed = entry.result.dbWritten !== false;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.22rem 0.55rem',
        borderRadius: 999,
        border: committed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
        background: committed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        color: committed ? '#047857' : '#b91c1c',
        fontSize: '0.78rem',
        fontWeight: 600,
      }}
    >
      {committed ? 'Committed' : 'Commit Failed'}
    </span>
  );
}

export function WorkbenchScreen() {
  const { files, tree, processEntries, processMode, currentFileId, activeKnowledgeBaseId } = useWorkbenchQueueState();
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState<string | null>(null);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [persistencePhase, setPersistencePhase] = useState<PersistencePhase>('checking');
  const [restorePrompt, setRestorePrompt] = useState<RestorePromptState | null>(null);
  const { toast } = useToast();
  const {
    activeKnowledgeBase,
    activeKnowledgeBaseId: workspaceKnowledgeBaseId,
    isLoadingKnowledgeBases,
    selectKnowledgeBase,
  } = useKnowledgeBaseWorkspace();

  useEffect(() => {
    workbenchQueue.setActiveKnowledgeBaseId(workspaceKnowledgeBaseId);
  }, [workspaceKnowledgeBaseId]);

  const fileMap = useMemo(() => new Map(files.map(file => [file.id, file])), [files]);

  const sortedFiles = useMemo(() => {
    return getOrderedFileIds(tree)
      .map(fileId => fileMap.get(fileId) ?? null)
      .filter((file): file is WorkbenchFileRecord => file !== null);
  }, [fileMap, tree]);

  const highlightedPath = useMemo(() => {
    if (!highlightedFileId) {
      return null;
    }

    return fileMap.get(highlightedFileId)?.workbenchPath ?? null;
  }, [fileMap, highlightedFileId]);

  const selectedPreviewFile = useMemo(
    () => (selectedPreviewFileId ? fileMap.get(selectedPreviewFileId) ?? null : null),
    [fileMap, selectedPreviewFileId],
  );

  const buildInitialEntry = useCallback((file: WorkbenchFileRecord): FileProcessEntry => ({
    fileId: file.id,
    path: file.workbenchPath,
    displayPath: getDisplayPath(file.workbenchPath),
    status: 'idle',
    steps: [],
  }), []);

  const selectedPreviewEntry = useMemo(() => {
    if (!selectedPreviewFile) {
      return null;
    }

    return processEntries[selectedPreviewFile.id] ?? buildInitialEntry(selectedPreviewFile);
  }, [buildInitialEntry, processEntries, selectedPreviewFile]);

  const allFileIds = useMemo(
    () => sortedFiles.map(file => file.id),
    [sortedFiles],
  );

  const currentQueueIndex = useMemo(() => {
    if (!currentFileId) {
      return sortedFiles.length;
    }

    const index = allFileIds.indexOf(currentFileId);
    return index === -1 ? sortedFiles.length : index;
  }, [allFileIds, currentFileId, sortedFiles.length]);

  const resumableFileIds = useMemo(
    () => allFileIds.filter(fileId => {
      const status = processEntries[fileId]?.status ?? 'idle';
      return status === 'idle' || status === 'processing';
    }),
    [allFileIds, processEntries],
  );

  const fileStatuses = useMemo(() => {
    const nextStatuses: Record<string, FileProcessStatus | undefined> = {};

    for (const fileId of allFileIds) {
      nextStatuses[fileId] = processEntries[fileId]?.status;
    }

    return nextStatuses;
  }, [allFileIds, processEntries]);

  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      const runtimeSnapshot = workbenchQueue.getSnapshot();

      if (runtimeSnapshot.activeKnowledgeBaseId && runtimeSnapshot.activeKnowledgeBaseId !== workspaceKnowledgeBaseId) {
        selectKnowledgeBase(runtimeSnapshot.activeKnowledgeBaseId, { replace: true });
      }

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

        if (ignore) {
          return;
        }

        if (restorableSession && restorableSession.files.length > 0) {
          setRestorePrompt({
            snapshot: restorableSession.snapshot,
            files: restorableSession.files,
          });
          setPersistencePhase('prompt');
          return;
        }

        setPersistencePhase('ready');
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
  }, [selectKnowledgeBase, workspaceKnowledgeBaseId]);

  useEffect(() => {
    if (!selectedPreviewFileId) {
      return;
    }

    if (!fileMap.has(selectedPreviewFileId)) {
      setSelectedPreviewFileId(null);
    }
  }, [fileMap, selectedPreviewFileId]);

  useEffect(() => {
    if (!highlightedFileId) {
      return;
    }

    if (!fileMap.has(highlightedFileId)) {
      setHighlightedFileId(null);
    }
  }, [fileMap, highlightedFileId]);

  const handleDelete = async (nodeId: string) => {
    if (persistencePhase === 'prompt' && canUseSessionPersistence()) {
      await clearStoredSession().catch(error => {
        console.error('Failed to clear stored session before delete:', error);
      });
      setRestorePrompt(null);
      setPersistencePhase('ready');
    }

    const removedFileIds = workbenchQueue.deleteNode(nodeId);
    if (removedFileIds.length === 0) {
      return;
    }

    const removedSet = new Set(removedFileIds);
    setExpandedEntryIds(prev => Object.fromEntries(
      Object.entries(prev).filter(([fileId]) => !removedSet.has(fileId)),
    ));

    if (highlightedFileId && removedSet.has(highlightedFileId)) {
      setHighlightedFileId(null);
    }

    if (selectedPreviewFileId && removedSet.has(selectedPreviewFileId)) {
      setSelectedPreviewFileId(null);
    }
  };

  const handleMoveNode = useCallback(async (input: {
    sourceNodeId: string;
    targetNodeId: string | null;
    position: 'before' | 'after' | 'inside';
  }) => {
    try {
      await workbenchQueue.moveNode(input);
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  }, [toast]);

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

  const handleClear = async () => {
    await workbenchQueue.clear();
    setExpandedEntryIds({});
    setHighlightedFileId(null);
    setSelectedPreviewFileId(null);
    setRestorePrompt(null);
    setPersistencePhase('ready');
  };

  const handleRestoreSession = () => {
    if (!restorePrompt) {
      return;
    }

    const restoredFiles = restorePrompt.files.map(rebuildWorkbenchFile);
    const restoredEntries = Object.fromEntries(
      Object.entries(restorePrompt.snapshot.processEntries).map(([fileId, entry]) => [fileId, normalizeRestoredEntry(entry)]),
    );

    setExpandedEntryIds({});
    workbenchQueue.restoreSession({
      files: restoredFiles,
      tree: restorePrompt.snapshot.tree,
      processEntries: restoredEntries,
      currentFileId: restorePrompt.snapshot.currentFileId,
      activeKnowledgeBaseId: restorePrompt.snapshot.activeKnowledgeBaseId ?? workspaceKnowledgeBaseId ?? null,
    });

    if (restorePrompt.snapshot.activeKnowledgeBaseId) {
      selectKnowledgeBase(restorePrompt.snapshot.activeKnowledgeBaseId, { replace: true });
    }

    setHighlightedFileId(null);
    setSelectedPreviewFileId(null);
    setRestorePrompt(null);
    setPersistencePhase('ready');
  };

  const orderedEntries = sortedFiles.map(file => processEntries[file.id] ?? buildInitialEntry(file));

  return (
    <>
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
                <DropZone onDrop={droppedFiles => void handleDrop(droppedFiles)} isCompact />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 className={styles.sidebarSectionTitle} style={{ margin: 0 }}>Files ({files.length})</h3>
                    <Button variant="ghost" onClick={() => void handleClear()} style={{ padding: '4px 8px', fontSize: '0.8rem', height: 'auto' }}>Clear</Button>
                  </div>
                  <FileTree
                    tree={tree}
                    files={files}
                    onDelete={nodeId => void handleDelete(nodeId)}
                    onMove={handleMoveNode}
                    highlightedPath={highlightedPath}
                    selectedFileId={selectedPreviewFileId}
                    statuses={fileStatuses}
                    onSelectFile={fileId => setSelectedPreviewFileId(fileId)}
                    isStructureLocked={workbenchQueue.isStructureLocked()}
                  />
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <motion.main layout className={styles.mainPanel} style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
          <div className={styles.workingArea}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>RAG Knowledge Extraction Engine</h3>
                <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  Active KB: {activeKnowledgeBase?.name || (isLoadingKnowledgeBases ? 'Loading knowledge base...' : 'No knowledge base selected')}
                  {activeKnowledgeBase ? <span>{activeKnowledgeBase.sourceCount} sources · {activeKnowledgeBase.unitCount} units</span> : null}
                </div>
              </div>

              {files.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {processMode === 'playing' ? (
                    <Button variant="secondary" onClick={() => workbenchQueue.pauseProcessing()}><Square size={14} /> Stop</Button>
                  ) : (
                    <Button variant="primary" onClick={() => workbenchQueue.startProcessing()} disabled={!activeKnowledgeBaseId || isLoadingKnowledgeBases}><Play size={14} /> {currentQueueIndex > 0 && currentQueueIndex < sortedFiles.length ? 'Resume' : 'Start Auto'}</Button>
                  )}
                  <Button variant="secondary" onClick={() => void workbenchQueue.processNext()} disabled={processMode === 'playing' || !activeKnowledgeBaseId || isLoadingKnowledgeBases}><SkipForward size={14} /> Next Step</Button>
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
                    已保存 {restorePrompt.files.length} 個檔案的執行紀錄。上次保存時間：{formatSavedAt(restorePrompt.snapshot.savedAt)}。其中 {countRunnablePaths(restorePrompt.snapshot) > 0 ? `${countRunnablePaths(restorePrompt.snapshot)} 個檔案可直接接續` : '所有檔案都已完成，可保留紀錄或重新開始'}。{restorePrompt.snapshot.activeKnowledgeBaseId ? ' 恢復後會切回當時的 active knowledge base。' : ''}
                  </div>
                </div>
                <div className={styles.resumeBannerActions}>
                  <Button variant="primary" onClick={handleRestoreSession}>恢復接續</Button>
                  <Button variant="secondary" onClick={() => void handleClear()}><Trash2 size={14} /> 清空紀錄</Button>
                </div>
              </div>
            )}

            {persistencePhase === 'ready' && sortedFiles.length > 0 && (
              <div className={styles.persistenceSummary}>
                目前已保存 {sortedFiles.length} 個檔案的執行紀錄，其中 {resumableFileIds.length} 個仍可接續處理。Active KB：{activeKnowledgeBase?.name || '未指定'}。完成分析後會額外顯示是否已成功提交到知識庫。
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
                    <DropZone onDrop={droppedFiles => void handleDrop(droppedFiles)} isHero />
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
                      const isExpanded = !!expandedEntryIds[entry.fileId];

                      return (
                        <section key={entry.fileId} className={`${styles.processCard} ${styles[`processCard${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`] || ''}`}>
                          <button type="button" className={styles.processCardHeader} onClick={() => {
                            setExpandedEntryIds(prev => ({
                              ...prev,
                              [entry.fileId]: !prev[entry.fileId],
                            }));
                            setHighlightedFileId(entry.fileId);
                          }}>
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
                                  {renderPersistenceBadge(entry)}
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
        onClose={() => setSelectedPreviewFileId(null)}
      />

      <RagQueryPanel knowledgeBaseId={activeKnowledgeBaseId} knowledgeBaseName={activeKnowledgeBase?.name} />
    </>
  );
}
