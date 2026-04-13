'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Clock3, Database, FileText, Image as ImageIcon, Link2, LoaderCircle, Rows3, Tag, Check } from 'lucide-react';
import { formatDuration, getStepStatusLabel } from '@/lib/workbench/formatting';
import type { FileProcessEntry } from '@/lib/workbench/types';
import { useLiveNow } from '@/lib/workbench/useLiveNow';
import styles from './ProcessTimeline.module.css';

interface ProcessTimelineProps {
  entry: FileProcessEntry;
  emptyMessage?: string;
  showStructuredOutput?: boolean;
}

const StepLiveDuration = ({ startedAt, completedAt, status }: { startedAt: number; completedAt: number | null; status: string }) => {
  const isRunning = status === 'running';
  const liveNow = useLiveNow(isRunning);
  
  const stepDuration = useMemo(() => {
    const stepEnd = completedAt ?? liveNow ?? startedAt;
    return formatDuration(stepEnd - startedAt);
  }, [completedAt, liveNow, startedAt]);

  return (
    <span className={styles.stepDuration}>
      {isRunning ? <Clock3 size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} className={styles.spinningIcon} /> : null}
      {stepDuration}
    </span>
  );
};

const StructuredOutput = React.memo(({ entry }: { entry: FileProcessEntry }) => {
  const result = entry.result;

  if (!result) {
    return null;
  }

  return (
    <div className={styles.outputGroup}>
      {result.type === 'image' && result.description && (
        <motion.section className={styles.outputCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <ImageIcon size={16} className={styles.headerIcon} />
              圖片分析結果
            </div>
            {result.contextApplied && <div className={styles.outputMeta}>含知識庫上下文</div>}
          </div>
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.description}</ReactMarkdown>
          </div>
        </motion.section>
      )}

      {result.knowledgeContext && (
        <motion.section className={styles.outputCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <Database size={16} className={styles.headerIcon} />
              知識庫上下文
            </div>
            <div className={styles.outputMeta}>{result.knowledgeContext.knowledgeBaseName || result.knowledgeBaseId}</div>
          </div>
          <div className={styles.chunkMetaRow}>
            <div className={styles.chunkMetaTitle}><Rows3 size={13} /> 檢索摘要</div>
            <div className={styles.chunkMetaText}>
              {result.knowledgeContext.profileSummary || '本次未使用持久化知識庫摘要。'}
            </div>
          </div>
          {result.knowledgeContext.retrievalQuery && (
            <div className={styles.chunkMetaRow}>
              <div className={styles.chunkMetaTitle}><Tag size={13} /> Retrieval Query</div>
              <div className={styles.chunkMetaText}>{result.knowledgeContext.retrievalQuery}</div>
            </div>
          )}
          {result.knowledgeContext.usedSources.length > 0 && (
            <div className={styles.chunkMetaRow}>
              <div className={styles.chunkMetaTitle}><Link2 size={13} /> 來源</div>
              <div className={styles.chunkRelationList}>
                {result.knowledgeContext.usedSources.map(source => (
                  <div key={`${result.knowledgeBaseId}-${source.sourceId}`} className={styles.chunkRelationItem}>
                    <span className={styles.chunkRelationLabel}>{source.label}</span>
                    <span className={styles.chunkRelationScore}>
                        {typeof source.similarity === 'number' ? `${Math.round(source.similarity * 100)}%` : source.kind}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.section>
      )}

      {result.type === 'document' && result.summary && (
        <motion.section className={styles.outputCard} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <FileText size={16} className={styles.headerIcon} />
              文件摘要
            </div>
            <div className={styles.outputMeta}>{result.chunkCount} chunks</div>
          </div>
          <div className={styles.outputText}>{result.summary}</div>
        </motion.section>
      )}

      {result.type === 'document' && result.chunkAnalyses.length > 0 && (
        <motion.section className={styles.outputCard} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <Rows3 size={16} className={styles.headerIcon} />
              Chunk 語意分析
            </div>
            <div className={styles.outputMeta}>{result.chunkAnalyses.length}/{result.chunkCount}</div>
          </div>
          <div className={styles.chunkList}>
            {result.chunkAnalyses.map((chunk, idx) => (
              <motion.div key={`${entry.path}-chunk-${chunk.index}`} className={styles.chunkItem}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.5) }}>
                <div className={styles.chunkLabel}>
                  Chunk {chunk.index + 1}
                  <span className={styles.charCountBadge}>{chunk.charCount} chars</span>
                  <span className={`${styles.chunkStatusBadge} ${chunk.status === 'error' ? styles.chunkStatusError : styles.chunkStatusReady}`}>
                    {chunk.status === 'error' ? '分析失敗' : '分析完成'}
                  </span>
                </div>
                <div className={styles.chunkSummary}>{chunk.summary}</div>
                <div className={styles.chunkPreview}>{chunk.preview}</div>
                {chunk.keywords.length > 0 && (
                  <div className={styles.chunkMetaRow}>
                    <div className={styles.chunkMetaTitle}><Tag size={13} /> 關鍵詞</div>
                    <div className={styles.chunkTokenList}>
                      {chunk.keywords.map(keyword => (
                        <span key={`${chunk.id}-${keyword}`} className={styles.chunkToken}>{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}
                {chunk.bridgingContext && (
                  <div className={styles.chunkMetaRow}>
                    <div className={styles.chunkMetaTitle}><Rows3 size={13} /> 相鄰脈絡</div>
                    <div className={styles.chunkMetaText}>{chunk.bridgingContext}</div>
                  </div>
                )}
                {chunk.relatedChunks.length > 0 && (
                  <div className={styles.chunkMetaRow}>
                    <div className={styles.chunkMetaTitle}><Link2 size={13} /> 關聯 Chunk</div>
                    <div className={styles.chunkRelationList}>
                      {chunk.relatedChunks.map(relation => (
                        <div key={`${chunk.id}-${relation.chunkId}`} className={styles.chunkRelationItem}>
                          <span className={styles.chunkRelationLabel}>{relation.label}</span>
                          <span className={styles.chunkRelationScore}>{relation.score.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {chunk.errorMessage && <div className={styles.chunkError}>{chunk.errorMessage}</div>}
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
});
StructuredOutput.displayName = 'StructuredOutput';

export const ProcessTimeline = ({
  entry,
  emptyMessage = '尚未開始處理這個檔案。',
  showStructuredOutput = true,
}: ProcessTimelineProps) => {

  return (
    <div className={styles.container}>
      {showStructuredOutput && <StructuredOutput entry={entry} />}

      {entry.steps.length === 0 ? (
        <div className={styles.empty}>{emptyMessage}</div>
      ) : (
        <div className={styles.stepList}>
          <AnimatePresence>
            {entry.steps.map((step, idx) => {
              const isRunning = step.status === 'running';

              return (
                <motion.div 
                  key={`${entry.path}-${step.id}`} 
                  className={`${styles.stepItem} ${isRunning ? styles.stepItemRunning : ''}`}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 400, delay: Math.min(0.04 * idx, 0.2) }}
                  layout
                >
                  <div className={styles.stepContent}>
                    <div className={styles.stepIconWrapper}>
                      {step.status === 'running'
                        ? <LoaderCircle size={16} className={styles.spinningIconMain} />
                        : step.status === 'completed'
                          ? <Check size={16} className={styles.successIcon} />
                          : <AlertCircle size={16} className={styles.errorIcon} />}
                    </div>
                    <div className={styles.stepMessage}>{step.message}</div>
                  </div>
                  <div className={styles.stepMeta}>
                    <span className={`${styles.stepStatus} ${styles[`step${step.status.charAt(0).toUpperCase()}${step.status.slice(1)}`]}`}>
                      {getStepStatusLabel(step.status)}
                    </span>
                    <StepLiveDuration startedAt={step.startedAt} completedAt={step.completedAt ?? null} status={step.status} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};