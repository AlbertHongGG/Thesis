'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import styles from './DropZone.module.css';

export interface ExtendedFile extends File {
  path?: string;
}

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (callback: (file: File) => void) => void;
  createReader?: () => {
    readEntries: (callback: (entries: FileSystemEntryLike[]) => void) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

interface DropZoneProps {
  onDrop: (files: ExtendedFile[]) => void;
  accept?: string;
  multiple?: boolean;
  isCompact?: boolean;
}

export const DropZone = ({ onDrop, accept, multiple = true, isCompact = false }: DropZoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const getFilesFromEntry = async (entry: FileSystemEntryLike, path = ''): Promise<ExtendedFile[]> => {
    if (entry.isFile && entry.file) {
      const readFile = entry.file.bind(entry);
      return new Promise((resolve) => {
        readFile((file: File) => {
          const extendedFile = file as ExtendedFile;
          extendedFile.path = path + file.name;
          resolve([extendedFile]);
        });
      });
    } else if (entry.isDirectory && entry.createReader) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries: FileSystemEntryLike[]) => {
          const promises = entries.map(e => getFilesFromEntry(e, path + entry.name + '/'));
          const files = await Promise.all(promises);
          resolve(files.flat());
        });
      });
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.items) {
      const promises = Array.from(e.dataTransfer.items)
        .map(item => (item as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null)
        .filter(entry => entry !== null)
        .map(entry => getFilesFromEntry(entry));
        
      const fileArrays = await Promise.all(promises);
      onDrop(fileArrays.flat());
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop(Array.from(e.dataTransfer.files) as ExtendedFile[]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).map(f => {
        const ef = f as ExtendedFile;
        // input element might have webkitRelativePath for directories
        ef.path = ef.webkitRelativePath || ef.name;
        return ef;
      });
      onDrop(files);
    }
  };

  return (
    <motion.div
      className={`${styles.container} ${isDragActive ? styles.active : ''} ${isCompact ? styles.compact : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <div className={styles.iconWrapper}>
        <UploadCloud size={isCompact ? 24 : 40} />
      </div>
      <div className={styles.title}>{isCompact ? 'Drop more files' : 'Click or drag to drop files here'}</div>
      {!isCompact && (
        <div className={styles.description}>
          Supports PDF, DOCX, TXT, JSON and Image files for RAG vectorization.
        </div>
      )}
    </motion.div>
  );
};
