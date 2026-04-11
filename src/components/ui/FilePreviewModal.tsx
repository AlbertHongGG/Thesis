'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Eye, FileText, Image as ImageIcon, LoaderCircle, Rows3 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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

export const FilePreviewModal = ({ isOpen, file, entry, onClose }: FilePreviewModalProps) => {
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const liveNow = useLiveNow(Boolean(isOpen && entry?.status === 'processing'));

  useEffect(() => {
    if (!isOpen || !file) return;

    const previewKind = getPreviewKind(file.name);
    let revoked = false;
    let objectUrl = '';

    const loadPreview = async () => {
      if (previewKind === 'image') {
        objectUrl = URL.createObjectURL(file);
        if (!revoked) {
          setPreviewState({ status: 'ready', kind: 'image', content: objectUrl, metaLabel: '原始圖片' });
        }
        return;
      }

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
        const parsedTextPreview = entry?.result?.parsedTextPreview;
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
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [entry?.result?.parsedTextPreview, entry?.status, file, isOpen]);

  const headerStatusClass = entry ? styles[`status${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`] : styles.statusIdle;
  const durationText = useMemo(() => {
    if (!entry?.startedAt) return '0.0s';
    return formatDuration((entry.completedAt ?? liveNow) - entry.startedAt);
  }, [entry, liveNow]);

  const modalTitle = file ? (
    <div className={styles.modalTitle}>
      <div className={styles.titleRow}>
        {getPreviewKind(file.name) === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}
        <h2 className={styles.titleText}>{file.name}</h2>
      </div>
      <div className={styles.pathText}>{file.path || file.name}</div>
      {entry && (
        <span className={`${styles.statusBadge} ${headerStatusClass}`}>
          {entry.status === 'processing'
            ? <LoaderCircle size={14} />
            : entry.status === 'completed'
              ? <CheckCircle2 size={14} />
              : entry.status === 'error'
                ? <AlertCircle size={14} />
                : <Clock3 size={14} />}
          {getStatusLabel(entry.status)}
        </span>
      )}
    </div>
  ) : undefined;

  const footer = (
    <div className={styles.footer}>
      <div className={styles.footerNote}>左側點選其他檔案即可快速切換 preview，不需要關閉這個視窗。</div>
      <div className={styles.footerStats}>
        {entry?.steps.length ? <span className={styles.metaBadge}>{entry.steps.length} steps</span> : null}
        <span className={styles.metaBadge}>耗時 {durationText}</span>
        <Button variant="secondary" onClick={onClose}>關閉</Button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} footer={footer} maxWidth="1280px">
      {file && entry ? (
        <div className={styles.body}>
          <div className={styles.previewPane}>
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Eye size={16} />
                  檔案 Preview
                </div>
                <div className={styles.metaList}>
                  <span className={styles.metaBadge}>{formatFileSize(file.size)}</span>
                  <span className={styles.metaBadge}>{previewState.status === 'ready' ? previewState.metaLabel : '內容準備中'}</span>
                </div>
              </div>
              <div className={styles.sectionBody}>
                {previewState.status === 'ready' && previewState.kind === 'image' && (
                  <Image src={previewState.content} alt={file.name} className={styles.imagePreview} width={1200} height={900} unoptimized />
                )}
                {previewState.status === 'ready' && previewState.kind !== 'image' && (
                  <pre className={styles.textPreview}>{previewState.content}</pre>
                )}
                {previewState.status === 'loading' && (
                  <div className={styles.previewState}>正在讀取檔案內容...</div>
                )}
                {previewState.status === 'unsupported' && (
                  <div className={styles.previewState}>{previewState.message}</div>
                )}
                {previewState.status === 'error' && (
                  <div className={styles.previewState}>Preview 載入失敗：{previewState.message}</div>
                )}
              </div>
            </section>
          </div>

          <div className={styles.tracePane}>
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Rows3 size={16} />
                  Trace 與輸出
                </div>
                <div className={styles.metaList}>
                  {entry.result?.previewKind && <span className={styles.metaBadge}>{entry.result.previewKind}</span>}
                  {entry.result?.type === 'image' && entry.result.contextApplied && <span className={styles.metaBadge}>context applied</span>}
                  {typeof entry.result?.chunks === 'number' && <span className={styles.metaBadge}>{entry.result.chunks} chunks</span>}
                </div>
              </div>
              <div className={styles.sectionBody}>
                <ProcessTimeline entry={entry} showStructuredOutput />
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};