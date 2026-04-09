'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Database,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Play,
  Settings,
  SkipForward,
  Sparkles,
  Square,
} from 'lucide-react';
import { DropZone, ExtendedFile } from '@/components/ui/DropZone';
import { FileTree } from '@/components/ui/FileTree';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

interface ProcessStep {
  message: string;
}

interface IngestResult {
  type: 'document' | 'image';
  chunks?: number;
  summary?: string;
  processSteps?: ProcessStep[];
  description?: string;
}

type StreamEvent =
  | { type: 'step'; message: string }
  | { type: 'result'; result: IngestResult }
  | { type: 'error'; error: string };

type FileProcessStatus = 'idle' | 'processing' | 'completed' | 'error';
type StepStatus = 'running' | 'completed' | 'error';

interface ProcessStepEntry {
  id: number;
  message: string;
  status: StepStatus;
  startedAt: number;
  completedAt?: number;
}

interface FileProcessEntry {
  path: string;
  displayPath: string;
  status: FileProcessStatus;
  steps: ProcessStepEntry[];
  startedAt?: number;
  completedAt?: number;
  result?: IngestResult;
  errorMessage?: string;
}

const IMAGE_PATTERN = /\.(png|jpe?g|gif|webp)$/i;
const MARKDOWN_STEP_PREFIX = '完整圖片分析描述：';

function getDisplayPath(fullPath: string) {
  const parts = fullPath.split('/');
  if (parts.length > 1) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return fullPath;
}

function formatDuration(milliseconds: number) {
  const safeMilliseconds = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  return `${(safeMilliseconds / 1000).toFixed(1)}s`;
}

function getStatusLabel(status: FileProcessStatus) {
  if (status === 'processing') return '處理中';
  if (status === 'completed') return '已完成';
  if (status === 'error') return '失敗';
  return '待處理';
}

function getStepStatusLabel(status: StepStatus) {
  if (status === 'running') return '執行中';
  if (status === 'error') return '失敗';
  return '完成';
}

function getMarkdownStepContent(message: string) {
  if (!message.startsWith(MARKDOWN_STEP_PREFIX)) {
    return null;
  }

  return message.slice(MARKDOWN_STEP_PREFIX.length).trim();
}

export default function DataWorkbench() {
  const [files, setFiles] = useState<ExtendedFile[]>([]);
  const [processMode, setProcessMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const [processEntries, setProcessEntries] = useState<Record<string, FileProcessEntry>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  const globalContextRef = useRef<string>('');

  const sortedFiles = useMemo(() => {
    const docs = files.filter(file => !IMAGE_PATTERN.test(file.name));
    const imgs = files.filter(file => IMAGE_PATTERN.test(file.name));
    return [...docs, ...imgs];
  }, [files]);

  const hasActiveProcessing = useMemo(
    () => Object.values(processEntries).some(entry => entry.status === 'processing'),
    [processEntries],
  );

  useEffect(() => {
    if (!hasActiveProcessing) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 200);

    return () => window.clearInterval(timer);
  }, [hasActiveProcessing]);

  const buildInitialEntry = useCallback((fullPath: string): FileProcessEntry => ({
    path: fullPath,
    displayPath: getDisplayPath(fullPath),
    status: 'idle',
    steps: [],
  }), []);

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
        globalContextRef.current += `\n${result.summary}`;
      }
      if (result.description) {
        globalContextRef.current += `\n${result.description}`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      failProcessingEntry(fullPath, message);
    } finally {
      setCurrentIndex(prev => prev + 1);
    }
  }, [ensureEntry, failProcessingEntry, processStreamResponse, startProcessingEntry]);

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

  const handleDelete = (path: string) => {
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
  };

  const handleDrop = (newFiles: ExtendedFile[]) => {
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

  const handleClear = () => {
    setFiles([]);
    setProcessEntries({});
    setExpandedPaths({});
    setCurrentIndex(0);
    setProcessMode('idle');
    setHighlightedPath(null);
    globalContextRef.current = '';
  };

  const toggleExpanded = (fullPath: string) => {
    setExpandedPaths(prev => ({
      ...prev,
      [fullPath]: !prev[fullPath],
    }));
    setHighlightedPath(fullPath);
  };

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
          <DropZone onDrop={handleDrop} isCompact={files.length > 0} />

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 className={styles.sidebarSectionTitle} style={{ margin: 0 }}>Files ({files.length})</h3>
                <Button variant="ghost" onClick={handleClear} style={{ padding: '4px 8px', fontSize: '0.8rem', height: 'auto' }}>Clear</Button>
              </div>
              <FileTree files={files} onDelete={handleDelete} highlightedPath={highlightedPath} />
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
                  <Button variant="secondary" onClick={handleNext} disabled={processMode === 'playing'}><SkipForward size={14} /> Next Step</Button>
                </div>
              )}
            </div>

            <div className={styles.processAccordionList}>
              {orderedEntries.length === 0 ? (
                <div className={styles.processEmptyState}>Upload files and press Start to begin RAG extraction step-by-step.</div>
              ) : (
                orderedEntries.map(entry => {
                  const isExpanded = !!expandedPaths[entry.path];
                  const headerDuration = entry.startedAt ? formatDuration((entry.completedAt ?? now) - entry.startedAt) : '0.0s';

                  return (
                    <section key={entry.path} className={`${styles.processCard} ${styles[`processCard${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`] || ''}`}>
                      <button type="button" className={styles.processCardHeader} onClick={() => toggleExpanded(entry.path)}>
                        <div className={styles.processCardHeaderLeft}>
                          <ChevronRight size={18} className={`${styles.processChevron} ${isExpanded ? styles.processChevronExpanded : ''}`} />
                          <div className={styles.processCardTitleGroup}>
                            <div className={styles.processCardTitle}>{entry.displayPath}</div>
                            <div className={styles.processCardMetaRow}>
                              <span className={`${styles.processStatusBadge} ${styles[`processStatus${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`]}`}>
                                {entry.status === 'processing' ? <LoaderCircle size={14} className={styles.spinningIcon} /> : entry.status === 'completed' ? <CheckCircle2 size={14} /> : entry.status === 'error' ? <AlertCircle size={14} /> : <Clock3 size={14} />}
                                {getStatusLabel(entry.status)}
                              </span>
                              {entry.errorMessage && <span className={styles.processErrorText}>{entry.errorMessage}</span>}
                            </div>
                          </div>
                        </div>

                        <div className={styles.processCardHeaderRight}>
                          <span className={styles.processDurationLabel}>{entry.status === 'completed' ? '總時間' : '經過時間'}</span>
                          <strong className={styles.processDurationValue}>{headerDuration}</strong>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className={styles.processCardBody}>
                          {entry.steps.length === 0 ? (
                            <div className={styles.processEmptyInner}>尚未開始處理這個檔案。</div>
                          ) : (
                            <div className={styles.processStepList}>
                              {entry.steps.map(step => {
                                const stepEnd = step.completedAt ?? now;
                                const stepDuration = formatDuration(stepEnd - step.startedAt);
                                const markdownContent = getMarkdownStepContent(step.message);

                                return (
                                  <div key={`${entry.path}-${step.id}`} className={styles.processStepItem}>
                                    <div className={styles.processStepContent}>
                                      {markdownContent ? (
                                        <div className={styles.processStepMarkdownCard}>
                                          <div className={styles.processStepMarkdownTitle}>完整圖片分析描述</div>
                                          <div className={styles.processStepMarkdown}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                              {markdownContent}
                                            </ReactMarkdown>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className={styles.processStepMessage}>{step.message}</div>
                                      )}
                                    </div>
                                    <div className={styles.processStepMeta}>
                                      <span className={`${styles.processStepStatus} ${styles[`processStep${step.status.charAt(0).toUpperCase()}${step.status.slice(1)}`]}`}>
                                        {getStepStatusLabel(step.status)}
                                      </span>
                                      <span className={styles.processStepDuration}>{stepDuration}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
    </div>
  );
}
