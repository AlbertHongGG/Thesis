'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Eye, FileText, Image as ImageIcon, LoaderCircle, Rows3 } from 'lucide-react';
import Image from 'next/image';
import { Modal } from '@/components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import type { ExtendedFile } from '@/components/ui/DropZone';
import { ProcessTimeline } from '@/components/ui/ProcessTimeline';
import { formatDuration, formatFileSize, getStatusLabel } from '@/lib/workbench/formatting';
import { getPreviewKind, trimPreviewText } from '@/lib/workbench/filePreview';
import type { FileProcessEntry } from '@/lib/workbench/types';
import { useLiveNow } from '@/lib/workbench/useLiveNow';
import styles from './FilePreviewModal.module.css';

type PreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; kind: 'image' | 'text' | 'parsed-text'; content: string; metaLabel: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string };

interface FilePreviewModalProps {
  isOpen: boolean;
  file: ExtendedFile | null;
  entry: FileProcessEntry | null;
  onClose: () => void;
}

const LiveDurationBadge = ({ startedAt, completedAt, status }: { startedAt: number; completedAt: number | null; status: string }) => {
  const isProcessing = status === 'processing';
  const liveNow = useLiveNow(isProcessing);
  const durationText = useMemo(() => {
    return formatDuration((completedAt ?? liveNow ?? startedAt) - startedAt);
  }, [completedAt, liveNow, startedAt]);

  return (
    <span className={styles.metaBadge}>
      <Clock3 size={13} />
      耗時 {durationText}
    </span>
  );
};

export const FilePreviewModal = ({ isOpen, file, entry, onClose }: FilePreviewModalProps) => {
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const previewKind = file ? getPreviewKind(file.name) : 'unsupported';
  const imageObjectUrl = useMemo(() => {
    if (!isOpen || !file || previewKind !== 'image') {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file, isOpen, previewKind]);

  useEffect(() => {
    if (!imageObjectUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  useEffect(() => {
    if (!isOpen || !file || previewKind === 'image') {
      return;
    }

    let revoked = false;

    const loadPreview = async () => {
      if (previewKind === 'text') {
        setPreviewState({ status: 'loading' });
        try {
          const rawText = await file.text();
          const { text } = trimPreviewText(rawText);
          if (!revoked) {
            setPreviewState({ status: 'ready', kind: 'text', content: text, metaLabel: '原始檔案內容' });
          }
        } catch (error) {
          if (!revoked) {
            setPreviewState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
          }
        }
        return;
      }

      if (previewKind === 'parsed-text') {
        const parsedTextPreview = entry?.result?.rawPreview;
        if (parsedTextPreview) {
          setPreviewState({ status: 'ready', kind: 'parsed-text', content: parsedTextPreview, metaLabel: '解析後內容預覽' });
          return;
        }

        if (entry?.status === 'processing') {
          setPreviewState({ status: 'unsupported', message: '這個檔案正在處理中，解析後內容完成後會自動顯示在這裡。' });
          return;
        }

        setPreviewState({ status: 'unsupported', message: '這個檔案類型需要先完成 ingest，才能顯示解析後的文字預覽。' });
        return;
      }

      setPreviewState({ status: 'unsupported', message: '目前這個檔案類型沒有提供 preview。' });
    };

    void loadPreview();

    return () => {
      revoked = true;
    };
  }, [entry?.result, entry?.status, file, isOpen, previewKind]);

  const resolvedPreviewState = useMemo<PreviewState>(() => {
    if (!isOpen || !file) {
      return { status: 'idle' };
    }

    if (previewKind === 'image') {
      if (!imageObjectUrl) {
        return { status: 'loading' };
      }

      return { status: 'ready', kind: 'image', content: imageObjectUrl, metaLabel: '原始圖片' };
    }

    return previewState;
  }, [file, imageObjectUrl, isOpen, previewKind, previewState]);

  const headerStatusClass = entry ? styles[`status${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`] : styles.statusIdle;

  const modalTitle = file ? (
    <div className={styles.modalTitle}>
      <div className={styles.titleInfo}>
        <div className={styles.titleRow}>
          {previewKind === 'image' ? <ImageIcon size={20} className={styles.titleIcon} /> : <FileText size={20} className={styles.titleIcon} />}
          <h2 className={styles.titleText}>{file.name}</h2>
        </div>
        <div className={styles.pathText}>{file.path || file.name}</div>
      </div>
      {entry && (
        <div className={styles.titleStats}>
          <span className={`${styles.statusBadge} ${headerStatusClass}`}>
            {entry.status === 'processing' ? <LoaderCircle size={14} className={styles.spinningIcon} /> :
             entry.status === 'completed' ? <CheckCircle2 size={14} /> :
             entry.status === 'error' ? <AlertCircle size={14} /> : <Clock3 size={14} />}
            {getStatusLabel(entry.status)}
          </span>
          {entry.steps.length ? <span className={styles.metaBadge}>{entry.steps.length} 個步驟</span> : null}
          {entry.startedAt ? <LiveDurationBadge startedAt={entry.startedAt} completedAt={entry.completedAt ?? null} status={entry.status} /> : null}
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="1400px">
      <AnimatePresence>
        {file && entry && (
          <motion.div 
            className={styles.body}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.previewPane}>
              <motion.section className={styles.sectionCard} layout>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Eye size={16} className={styles.sectionIcon} />
                    檔案 Preview
                  </div>
                  <div className={styles.metaList}>
                    <span className={styles.metaBadge}>{formatFileSize(file.size)}</span>
                    <span className={styles.metaBadgeBadgeBlue}>{resolvedPreviewState.status === 'ready' ? resolvedPreviewState.metaLabel : '內容準備中'}</span>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  {resolvedPreviewState.status === 'ready' && resolvedPreviewState.kind === 'image' && (
                    <motion.div className={styles.imagePreviewFrame} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                      <Image src={resolvedPreviewState.content} alt={file.name} className={styles.imagePreview} width={1200} height={900} unoptimized />
                    </motion.div>
                  )}
                  {resolvedPreviewState.status === 'ready' && resolvedPreviewState.kind !== 'image' && (
                    <motion.pre className={styles.textPreview} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{resolvedPreviewState.content}</motion.pre>
                  )}
                  {resolvedPreviewState.status === 'loading' && (
                    <motion.div className={styles.previewState} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <LoaderCircle size={20} className={styles.spinningIcon} /> 正在讀取檔案內容...
                    </motion.div>
                  )}
                  {resolvedPreviewState.status === 'unsupported' && (
                    <motion.div className={styles.previewState} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{resolvedPreviewState.message}</motion.div>
                  )}
                  {resolvedPreviewState.status === 'error' && (
                    <motion.div className={styles.previewStateError} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <AlertCircle size={20} /> Preview 載入失敗：{resolvedPreviewState.message}
                    </motion.div>
                  )}
                </div>
              </motion.section>
            </div>

            <div className={styles.tracePane}>
              <motion.section className={styles.sectionCardAlt} layout>
                <div className={styles.sectionHeaderAlt}>
                  <div className={styles.sectionTitle}>
                    <Rows3 size={16} className={styles.sectionIcon} />
                    處理歷程與語意輸出
                  </div>
                  <div className={styles.metaList}>
                    {entry.result?.previewKind && <span className={styles.metaBadge}>{entry.result.previewKind}</span>}
                    {entry.result?.contextApplied && <span className={styles.metaBadgeTheme}>含知識庫脈絡</span>}
                    {entry.result && <span className={styles.metaBadgeOrange}>{entry.result.totalUnitCount} units</span>}
                  </div>
                </div>
                <div className={styles.sectionBodyAlt}>
                  <ProcessTimeline entry={entry} showStructuredOutput />
                </div>
              </motion.section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};