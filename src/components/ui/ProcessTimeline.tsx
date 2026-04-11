'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, CheckCircle2, Clock3, FileText, Image as ImageIcon, LoaderCircle, Rows3 } from 'lucide-react';
import { formatDuration, getStepStatusLabel } from '@/lib/workbench/formatting';
import type { FileProcessEntry } from '@/lib/workbench/types';
import { useLiveNow } from '@/lib/workbench/useLiveNow';
import styles from './ProcessTimeline.module.css';

interface ProcessTimelineProps {
  entry: FileProcessEntry;
  emptyMessage?: string;
  showStructuredOutput?: boolean;
}

const StructuredOutput = React.memo(({ entry }: { entry: FileProcessEntry }) => {
  const result = entry.result;

  if (!result) {
    return null;
  }

  return (
    <div className={styles.outputGroup}>
      {result.type === 'image' && result.description && (
        <section className={styles.outputCard}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <ImageIcon size={16} />
              圖片分析結果
            </div>
            {result.contextApplied && <div className={styles.outputMeta}>含文件上下文</div>}
          </div>
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.description}</ReactMarkdown>
          </div>
        </section>
      )}

      {result.type === 'document' && result.summary && (
        <section className={styles.outputCard}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <FileText size={16} />
              文件摘要
            </div>
            {typeof result.chunks === 'number' && <div className={styles.outputMeta}>{result.chunks} chunks</div>}
          </div>
          <div className={styles.outputText}>{result.summary}</div>
        </section>
      )}

      {result.type === 'document' && result.parsedTextPreview && (
        <section className={styles.outputCard}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <Rows3 size={16} />
              解析內容預覽
            </div>
          </div>
          <div className={styles.outputText}>{result.parsedTextPreview}</div>
        </section>
      )}

      {result.type === 'document' && result.chunkPreviews && result.chunkPreviews.length > 0 && (
        <section className={styles.outputCard}>
          <div className={styles.outputHeader}>
            <div className={styles.outputTitle}>
              <Rows3 size={16} />
              Chunk 預覽
            </div>
          </div>
          <div className={styles.chunkList}>
            {result.chunkPreviews.map(chunk => (
              <div key={`${entry.path}-chunk-${chunk.index}`} className={styles.chunkItem}>
                <div className={styles.chunkLabel}>Chunk {chunk.index + 1} · {chunk.charCount} chars</div>
                <div className={styles.chunkPreview}>{chunk.preview}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});

export const ProcessTimeline = ({
  entry,
  emptyMessage = '尚未開始處理這個檔案。',
  showStructuredOutput = true,
}: ProcessTimelineProps) => {
  const liveNow = useLiveNow(entry.status === 'processing' || entry.steps.some(step => step.status === 'running'));
  const currentNow = entry.status === 'processing' ? liveNow : (entry.completedAt ?? liveNow);

  return (
    <div className={styles.container}>
      {showStructuredOutput && <StructuredOutput entry={entry} />}

      {entry.steps.length === 0 ? (
        <div className={styles.empty}>{emptyMessage}</div>
      ) : (
        <div className={styles.stepList}>
          {entry.steps.map(step => {
            const stepEnd = step.completedAt ?? currentNow;
            const stepDuration = formatDuration(stepEnd - step.startedAt);

            return (
              <div key={`${entry.path}-${step.id}`} className={styles.stepItem}>
                <div className={styles.stepContent}>
                  <div className={styles.stepMessage}>{step.message}</div>
                </div>
                <div className={styles.stepMeta}>
                  <span className={`${styles.stepStatus} ${styles[`step${step.status.charAt(0).toUpperCase()}${step.status.slice(1)}`]}`}>
                    {step.status === 'running'
                      ? <LoaderCircle size={14} className={styles.spinningIcon} />
                      : step.status === 'completed'
                        ? <CheckCircle2 size={14} />
                        : <AlertCircle size={14} />}
                    {getStepStatusLabel(step.status)}
                  </span>
                  <span className={styles.stepDuration}>
                    {step.status === 'running' ? <Clock3 size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> : null}
                    {stepDuration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};