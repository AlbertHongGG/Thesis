import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, CheckCircle2, ChevronRight,
  Clock3, File, FileText, Folder, Image as ImageIcon, 
  LoaderCircle, Trash2
} from 'lucide-react';
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
  if (IMAGE_FILE_PATTERN.test(name)) return <ImageIcon size={15} className={styles.iconImage} strokeWidth={2.2} />;
  if (DOCUMENT_FILE_PATTERN.test(name)) return <FileText size={15} className={styles.iconDoc} strokeWidth={2.2} />;
  return <File size={15} className={styles.iconDefault} strokeWidth={2.2} />;
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

const StatusIcon = React.memo(({ status }: { status: FileProcessStatus | undefined }) => {
  const safeStatus = status ?? 'idle';
  
  switch (safeStatus) {
    case 'processing': return <LoaderCircle size={14} className={`${styles.statusIcon} ${styles.iconSpin} ${styles.colorProcessing}`} strokeWidth={2.5} />;
    case 'completed': return <CheckCircle2 size={14} className={`${styles.statusIcon} ${styles.colorCompleted}`} strokeWidth={2.5} />;
    case 'error': return <AlertCircle size={14} className={`${styles.statusIcon} ${styles.colorError}`} strokeWidth={2.5} />;
    default: return <Clock3 size={14} className={`${styles.statusIcon} ${styles.colorIdle}`} strokeWidth={2.5} />;
  }
});
StatusIcon.displayName = 'StatusIcon';

type FileLeafProps = {
  node: TreeNode;
  level: number;
  status: FileProcessStatus | undefined;
  isHighlighted: boolean;
  isSelected: boolean;
  onSelect: (node: TreeNode) => void;
  onDelete: (path: string) => void;
};

const FileLeaf = React.memo(({ node, level, status, isHighlighted, isSelected, onSelect, onDelete }: FileLeafProps) => {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.path);
  };

  return (
    <motion.div 
      layout="position"
      className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${isHighlighted ? styles.highlighted : ''}`}
    >
      <div
        className={styles.nodeItem}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node);
          }
        }}
      >
        {isSelected && (
          <motion.div
            layoutId="active-file-bg"
            className={styles.activeBackground}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
        <div className={styles.nodeContent}>
          {getFileIcon(node.name)}
          <span className={styles.nodeName}>{node.name}</span>
        </div>
        <div className={styles.nodeMeta}>
          <StatusIcon status={status} />
        </div>
      </div>
      <button type="button" className={styles.deleteBtn} onClick={handleDeleteClick} aria-label="Delete">
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </motion.div>
  );
});
FileLeaf.displayName = 'FileLeaf';

type FolderNodeProps = {
  node: TreeNode;
  level: number;
  highlightedPath?: string | null;
  selectedPath?: string | null;
  statuses: Record<string, FileProcessStatus | undefined>;
  folderStats: FolderStatsMap;
  onSelectFile: (node: TreeNode) => void;
  onDelete: (path: string) => void;
};

const FolderBranch = ({ node, level, highlightedPath, selectedPath, statuses, folderStats, onSelectFile, onDelete }: FolderNodeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isForcedOpen = Boolean(highlightedPath && !node.isFile && node.path && highlightedPath.startsWith(node.path + '/'));
  const isExpanded = isOpen || isForcedOpen;

  const childrenNodes = useMemo(() => (node.children ? Object.values(node.children).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  }) : []), [node.children]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.path);
  };

  const isHighlightedRoot = highlightedPath === node.path;
  const stats = folderStats[node.path] ?? { total: 0, completed: 0, processing: 0, error: 0 };
  const allCompleted = stats.total > 0 && stats.completed === stats.total;

  return (
    <motion.div layout="position" className={styles.folderNode}>
      <div
        className={`${styles.nodeRow} ${styles.folderRow} ${isHighlightedRoot ? styles.highlighted : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(p => !p);
          }
        }}
      >
        <div className={`${styles.nodeItem} ${styles.folderItem}`} style={{ paddingLeft: `${level * 16 + 8}px` }}>
          <div className={styles.nodeContent}>
             <motion.div 
               animate={{ rotate: isExpanded ? 90 : 0 }} 
               transition={{ type: "spring", stiffness: 300, damping: 20 }}
               className={styles.chevron}
             >
               <ChevronRight size={14} strokeWidth={2.5} />
             </motion.div>
            <Folder size={15} className={`${styles.iconFolder} ${isExpanded ? styles.iconFolderOpen : ''}`} strokeWidth={2.2} fill="currentColor" fillOpacity={isExpanded ? 0.2 : 0.1} />
            <span className={styles.nodeName}>{node.name}</span>
          </div>
          
          <div className={styles.nodeMetaFolder}>
            {stats.error > 0 && (
               <span className={`${styles.statsPill} ${styles.pillError}`}>
                 {stats.error} err
               </span>
            )}
            {stats.processing > 0 && (
               <span className={`${styles.statsPill} ${styles.pillProcessing}`}>
                 <LoaderCircle size={10} className={styles.iconSpin} />
                 {stats.processing}
               </span>
            )}
            <span className={`${styles.statsPill} ${allCompleted ? styles.pillSuccess : styles.pillDefault}`}>
               {stats.completed}/{stats.total}
            </span>
          </div>
        </div>
        <button type="button" className={styles.deleteBtn} onClick={handleDeleteClick} aria-label="Delete Folder">
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { type: "spring", stiffness: 400, damping: 35 }, opacity: { duration: 0.2 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: { type: "spring", stiffness: 400, damping: 40 }, opacity: { duration: 0.2 } } }}
            className={styles.childrenContainer}
            style={{ overflow: 'hidden' }}
          >
            {childrenNodes.map((child) => 
               child.isFile ? (
                 <FileLeaf 
                   key={child.path} 
                   node={child} 
                   level={level + 1} 
                   status={statuses[child.path]} 
                   isHighlighted={highlightedPath === child.path}
                   isSelected={selectedPath === child.path}
                   onSelect={onSelectFile}
                   onDelete={onDelete}
                 />
               ) : (
                 <FolderBranch 
                   key={child.path} 
                   node={child} 
                   level={level + 1} 
                   highlightedPath={highlightedPath}
                   selectedPath={selectedPath}
                   statuses={statuses}
                   folderStats={folderStats}
                   onSelectFile={onSelectFile}
                   onDelete={onDelete}
                 />
               )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const FileTree = ({ 
  files, 
  onDelete = () => {},
  highlightedPath,
  selectedPath,
  statuses = {},
  onSelectFile = () => {},
}: { 
  files: ExtendedFile[]; 
  onDelete?: (path: string) => void;
  highlightedPath?: string | null;
  selectedPath?: string | null;
  statuses?: Record<string, FileProcessStatus | undefined>;
  onSelectFile?: (node: TreeNode) => void;
}) => {
  const tree = useMemo(() => buildTree(files), [files]);
  
  const folderStats = useMemo(() => {
    const statsMap: FolderStatsMap = {};
    collectFolderStats(tree, statuses, statsMap);
    return statsMap;
  }, [statuses, tree]);

  const rootChildren = useMemo(() => {
    if (!tree.children) return [];
    return Object.values(tree.children).sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [tree.children]);

  if (!files || files.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={styles.empty}
      >
        <File size={24} className={styles.emptyIcon} strokeWidth={1.5} />
        <span>No files selected</span>
      </motion.div>
    );
  }

  return (
    <div className={styles.container}>
      <AnimatePresence initial={false}>
        <div className={styles.treeRoot}>
          {rootChildren.map((child) => 
            child.isFile ? (
              <FileLeaf 
                key={child.path} 
                node={child} 
                level={0} 
                status={statuses[child.path]} 
                isHighlighted={highlightedPath === child.path}
                isSelected={selectedPath === child.path}
                onSelect={onSelectFile}
                onDelete={onDelete}
              />
            ) : (
              <FolderBranch 
                key={child.path} 
                node={child} 
                level={0} 
                highlightedPath={highlightedPath}
                selectedPath={selectedPath}
                statuses={statuses}
                folderStats={folderStats}
                onSelectFile={onSelectFile}
                onDelete={onDelete}
              />
            )
          )}
        </div>
      </AnimatePresence>
    </div>
  );
};
