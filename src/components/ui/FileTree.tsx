'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, ChevronDown, Clock3, File, FileText, Folder, Image as ImageIcon, LoaderCircle, Trash2 } from 'lucide-react';
import type { ExtendedFile } from './DropZone';
import { DOCUMENT_FILE_PATTERN, IMAGE_FILE_PATTERN } from '@/lib/workbench/filePreview';
import type { FileProcessStatus } from '@/lib/workbench/types';
import styles from './FileTree.module.css';

export type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  file?: ExtendedFile;
  children?: { [key: string]: TreeNode };
};

export function buildTree(files: ExtendedFile[]): TreeNode {
  const root: TreeNode = { name: 'root', path: '', isFile: false, children: {} };

  files.forEach(file => {
    const pathParts = (file.path || file.name).split('/').filter(Boolean);
    let currentDir = root;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isFile = i === pathParts.length - 1;

      if (!currentDir.children) currentDir.children = {};

      if (!currentDir.children[part]) {
        currentDir.children[part] = {
          name: part,
          path: pathParts.slice(0, i + 1).join('/'),
          isFile,
          file: isFile ? file : undefined,
          children: isFile ? undefined : {},
        };
      }

      currentDir = currentDir.children[part];
    }
  });

  return root;
}

const getFileIcon = (name: string) => {
  if (IMAGE_FILE_PATTERN.test(name)) return <ImageIcon size={16} className={styles.iconImage} />;
  if (DOCUMENT_FILE_PATTERN.test(name)) return <FileText size={16} className={styles.iconDoc} />;
  return <File size={16} className={styles.iconDefault} />;
};

type FolderStats = {
  total: number;
  completed: number;
  processing: number;
  error: number;
};

type FolderStatsMap = Record<string, FolderStats>;

function collectFolderStats(node: TreeNode, statuses: Record<string, FileProcessStatus | undefined>, statsMap: FolderStatsMap): FolderStats {
  if (node.isFile) {
    const status = statuses[node.path] ?? 'idle';
    return {
      total: 1,
      completed: status === 'completed' ? 1 : 0,
      processing: status === 'processing' ? 1 : 0,
      error: status === 'error' ? 1 : 0,
    };
  }

  const stats = Object.values(node.children ?? {}).reduce<FolderStats>((summary, child) => {
    const childStats = collectFolderStats(child, statuses, statsMap);
    return {
      total: summary.total + childStats.total,
      completed: summary.completed + childStats.completed,
      processing: summary.processing + childStats.processing,
      error: summary.error + childStats.error,
    };
  }, { total: 0, completed: 0, processing: 0, error: 0 });

  statsMap[node.path] = stats;
  return stats;
}

function renderStatusBadge(status: FileProcessStatus | undefined) {
  const safeStatus = status ?? 'idle';
  const badgeClass = styles[`status${safeStatus.charAt(0).toUpperCase()}${safeStatus.slice(1)}`];

  return (
    <span className={`${styles.statusBadge} ${badgeClass}`}>
      {safeStatus === 'processing'
        ? <LoaderCircle size={12} className={styles.spinningIcon} />
        : safeStatus === 'completed'
          ? <CheckCircle2 size={12} />
          : safeStatus === 'error'
            ? <AlertCircle size={12} />
            : <Clock3 size={12} />}
    </span>
  );
}

type TreeNodeRendererProps = {
  node: TreeNode;
  level?: number;
  highlightedPath?: string | null;
  selectedPath?: string | null;
  statuses: Record<string, FileProcessStatus | undefined>;
  folderStats: FolderStatsMap;
  onSelectFile?: (node: TreeNode) => void;
  onDelete?: (path: string) => void;
};

const TreeNodeRenderer = React.memo(({ node, level = 0, highlightedPath, selectedPath, statuses, folderStats, onSelectFile, onDelete }: TreeNodeRendererProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // Auto-expand if highlightedPath is a child of this node
  React.useEffect(() => {
    if (highlightedPath && !node.isFile && node.path) {
      if (highlightedPath.startsWith(node.path + '/')) {
        setIsOpen(true);
      }
    }
  }, [highlightedPath, node.path, node.isFile]);
  const childrenNodes = React.useMemo(() => (node.children ? Object.values(node.children).sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
  }) : []), [node.children]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(node.path);
  };

  if (node.name === 'root') {
    return (
      <div className={styles.treeRoot}>
        {childrenNodes.map((child, idx) => (
          <TreeNodeRenderer key={child.path || idx} node={child} level={0} highlightedPath={highlightedPath} selectedPath={selectedPath} statuses={statuses} folderStats={folderStats} onSelectFile={onSelectFile} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  if (node.isFile) {
    const isHighlighted = highlightedPath === node.path;
    const isSelected = selectedPath === node.path;

    return (
      <div className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${isHighlighted ? styles.highlighted : ''}`}>
        <div
          className={styles.nodeItem}
          style={{ marginLeft: `${level * 16}px` }}
          role="button"
          tabIndex={0}
          onClick={() => onSelectFile?.(node)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectFile?.(node);
            }
          }}
        >
          <div className={styles.nodeMain}>
            {getFileIcon(node.name)}
            <span className={styles.nodeName}>{node.name}</span>
          </div>
          <div className={styles.nodeMeta}>
            {renderStatusBadge(statuses[node.path])}
          </div>
        </div>
        <button type="button" className={styles.deleteBtn} onClick={handleDeleteClick} aria-label={`Delete ${node.name}`}>
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  const stats = folderStats[node.path] ?? { total: 0, completed: 0, processing: 0, error: 0 };

  return (
    <div className={styles.folderNode}>
      <div
        className={`${styles.nodeRow} ${highlightedPath === node.path ? styles.highlighted : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
      >
        <div className={styles.nodeItem} style={{ marginLeft: `${level * 16}px`, paddingLeft: '12px' }}>
          <div className={styles.nodeMain}>
            <span className={styles.chevron}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <Folder size={16} className={styles.iconFolder} />
            <span className={styles.nodeName}>{node.name}</span>
          </div>
          <div className={styles.nodeMeta}>
            {stats.error > 0 && <span className={`${styles.countBadge} ${styles.countError}`}>{stats.error} err</span>}
            {stats.processing > 0 && <span className={`${styles.countBadge} ${styles.countProcessing}`}>{stats.processing} run</span>}
            <span className={styles.countBadge}>{stats.completed}/{stats.total}</span>
          </div>
        </div>
        <button type="button" className={styles.deleteBtn} onClick={handleDeleteClick} aria-label={`Delete ${node.name}`}>
          <Trash2 size={14} />
        </button>
      </div>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={styles.childrenContainer}
          >
            {childrenNodes.map((child, idx) => (
              <TreeNodeRenderer key={child.path || idx} node={child} level={level + 1} highlightedPath={highlightedPath} selectedPath={selectedPath} statuses={statuses} folderStats={folderStats} onSelectFile={onSelectFile} onDelete={onDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const FileTree = ({ 
  files, 
  onDelete,
  highlightedPath,
  selectedPath,
  statuses = {},
  onSelectFile,
}: { 
  files: ExtendedFile[]; 
  onDelete?: (path: string) => void;
  highlightedPath?: string | null;
  selectedPath?: string | null;
  statuses?: Record<string, FileProcessStatus | undefined>;
  onSelectFile?: (node: TreeNode) => void;
}) => {
  if (!files || files.length === 0) return <div className={styles.empty}>Empty selection</div>;
  const tree = React.useMemo(() => buildTree(files), [files]);
  const folderStats = React.useMemo(() => {
    const statsMap: FolderStatsMap = {};
    collectFolderStats(tree, statuses, statsMap);
    return statsMap;
  }, [statuses, tree]);
  return <div className={styles.container}><TreeNodeRenderer node={tree} highlightedPath={highlightedPath} selectedPath={selectedPath} statuses={statuses} folderStats={folderStats} onSelectFile={onSelectFile} onDelete={onDelete} /></div>;
};
