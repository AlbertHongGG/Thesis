import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  LoaderCircle,
  Trash2,
} from 'lucide-react';
import { DOCUMENT_FILE_PATTERN, IMAGE_FILE_PATTERN } from '@/lib/workbench/filePreview';
import { buildWorkbenchRenderTree } from '@/lib/workbench/treeState';
import type {
  FileProcessStatus,
  WorkbenchDropPosition,
  WorkbenchFileRecord,
  WorkbenchRenderNode,
  WorkbenchTreeState,
} from '@/lib/workbench/types';
import styles from './FileTree.module.css';

type FolderStats = {
  total: number;
  completed: number;
  processing: number;
  error: number;
};

type FolderStatsMap = Record<string, FolderStats>;

type DropHint = {
  targetNodeId: string | null;
  position: WorkbenchDropPosition;
};

type NodeRendererProps = {
  node: WorkbenchRenderNode;
  level: number;
  highlightedPath?: string | null;
  selectedFileId?: string | null;
  statuses: Record<string, FileProcessStatus | undefined>;
  folderStats: FolderStatsMap;
  onSelectFile: (fileId: string) => void;
  onDelete: (nodeId: string) => void;
  onMove?: (input: { sourceNodeId: string; targetNodeId: string | null; position: WorkbenchDropPosition }) => void | Promise<void>;
  isStructureLocked: boolean;
  draggedNodeId: string | null;
  dropHint: DropHint | null;
  setDraggedNodeId: (nodeId: string | null) => void;
  setDropHint: (hint: DropHint | null) => void;
};

const getFileIcon = (name: string) => {
  if (IMAGE_FILE_PATTERN.test(name)) {
    return <ImageIcon size={15} className={styles.iconImage} strokeWidth={2.2} />;
  }

  if (DOCUMENT_FILE_PATTERN.test(name)) {
    return <FileText size={15} className={styles.iconDoc} strokeWidth={2.2} />;
  }

  return <File size={15} className={styles.iconDefault} strokeWidth={2.2} />;
};

function collectFolderStats(node: WorkbenchRenderNode, statuses: Record<string, FileProcessStatus | undefined>, statsMap: FolderStatsMap): FolderStats {
  if (node.kind === 'file') {
    const status = (node.fileId ? statuses[node.fileId] : undefined) ?? 'idle';
    return {
      total: 1,
      completed: status === 'completed' ? 1 : 0,
      processing: status === 'processing' ? 1 : 0,
      error: status === 'error' ? 1 : 0,
    };
  }

  const stats = (node.children ?? []).reduce<FolderStats>((summary, child) => {
    const childStats = collectFolderStats(child, statuses, statsMap);
    return {
      total: summary.total + childStats.total,
      completed: summary.completed + childStats.completed,
      processing: summary.processing + childStats.processing,
      error: summary.error + childStats.error,
    };
  }, { total: 0, completed: 0, processing: 0, error: 0 });

  statsMap[node.id] = stats;
  return stats;
}

const StatusIcon = React.memo(({ status }: { status: FileProcessStatus | undefined }) => {
  const safeStatus = status ?? 'idle';

  switch (safeStatus) {
    case 'processing':
      return <LoaderCircle size={14} className={`${styles.statusIcon} ${styles.iconSpin} ${styles.colorProcessing}`} strokeWidth={2.5} />;
    case 'completed':
      return <CheckCircle2 size={14} className={`${styles.statusIcon} ${styles.colorCompleted}`} strokeWidth={2.5} />;
    case 'error':
      return <AlertCircle size={14} className={`${styles.statusIcon} ${styles.colorError}`} strokeWidth={2.5} />;
    default:
      return <Clock3 size={14} className={`${styles.statusIcon} ${styles.colorIdle}`} strokeWidth={2.5} />;
  }
});
StatusIcon.displayName = 'StatusIcon';

function resolveDropPosition(node: WorkbenchRenderNode, event: React.DragEvent<HTMLDivElement>): WorkbenchDropPosition {
  const bounds = event.currentTarget.getBoundingClientRect();
  const offsetY = event.clientY - bounds.top;
  const ratio = bounds.height > 0 ? offsetY / bounds.height : 0.5;

  if (node.kind === 'folder') {
    if (ratio < 0.25) {
      return 'before';
    }

    if (ratio > 0.75) {
      return 'after';
    }

    return 'inside';
  }

  return ratio < 0.5 ? 'before' : 'after';
}

function useDragDropHandlers(props: Pick<NodeRendererProps, 'node' | 'onMove' | 'isStructureLocked' | 'draggedNodeId' | 'setDraggedNodeId' | 'setDropHint'>) {
  const { node, onMove, isStructureLocked, draggedNodeId, setDraggedNodeId, setDropHint } = props;

  return {
    draggable: !isStructureLocked,
    onDragStartCapture: (event: React.DragEvent<HTMLDivElement>) => {
      if (isStructureLocked) {
        event.preventDefault();
        return;
      }

      setDraggedNodeId(node.id);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.id);
    },
    onDragEndCapture: () => {
      setDraggedNodeId(null);
      setDropHint(null);
    },
    onDragOverCapture: (event: React.DragEvent<HTMLDivElement>) => {
      if (!onMove || isStructureLocked || draggedNodeId === node.id) {
        return;
      }

      event.preventDefault();
      setDropHint({ targetNodeId: node.id, position: resolveDropPosition(node, event) });
    },
    onDropCapture: async (event: React.DragEvent<HTMLDivElement>) => {
      if (!onMove || isStructureLocked || draggedNodeId === node.id) {
        return;
      }

      event.preventDefault();
      const sourceNodeId = draggedNodeId || event.dataTransfer.getData('text/plain');
      const position = resolveDropPosition(node, event);

      setDraggedNodeId(null);
      setDropHint(null);

      if (!sourceNodeId) {
        return;
      }

      await onMove({ sourceNodeId, targetNodeId: node.id, position });
    },
  };
}

const FileLeaf = React.memo((props: NodeRendererProps) => {
  const {
    node,
    level,
    statuses,
    selectedFileId,
    highlightedPath,
    onSelectFile,
    onDelete,
    dropHint,
    draggedNodeId,
  } = props;
  const dragHandlers = useDragDropHandlers(props);
  const status = node.fileId ? statuses[node.fileId] : undefined;
  const isHighlighted = highlightedPath === node.path;
  const isSelected = selectedFileId === node.fileId;
  const isDropBefore = dropHint?.targetNodeId === node.id && dropHint.position === 'before';
  const isDropAfter = dropHint?.targetNodeId === node.id && dropHint.position === 'after';
  const isDragging = draggedNodeId === node.id;

  return (
    <motion.div
      layout="position"
      className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${isHighlighted ? styles.highlighted : ''} ${isDragging ? styles.dragging : ''} ${isDropBefore ? styles.dropBefore : ''} ${isDropAfter ? styles.dropAfter : ''}`}
      {...dragHandlers}
    >
      <div
        className={styles.nodeItem}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        role="button"
        tabIndex={0}
        onClick={() => node.fileId && onSelectFile(node.fileId)}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && node.fileId) {
            event.preventDefault();
            onSelectFile(node.fileId);
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
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
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
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(node.id);
        }}
        aria-label="Delete"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </motion.div>
  );
});
FileLeaf.displayName = 'FileLeaf';

const FolderBranch = (props: NodeRendererProps) => {
  const {
    node,
    level,
    highlightedPath,
    folderStats,
    onDelete,
    dropHint,
    draggedNodeId,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const dragHandlers = useDragDropHandlers(props);
  const isForcedOpen = Boolean(highlightedPath && node.path && highlightedPath.startsWith(`${node.path}/`));
  const isExpanded = isOpen || isForcedOpen;
  const isHighlightedRoot = highlightedPath === node.path;
  const stats = folderStats[node.id] ?? { total: 0, completed: 0, processing: 0, error: 0 };
  const allCompleted = stats.total > 0 && stats.completed === stats.total;
  const isDropBefore = dropHint?.targetNodeId === node.id && dropHint.position === 'before';
  const isDropAfter = dropHint?.targetNodeId === node.id && dropHint.position === 'after';
  const isDropInside = dropHint?.targetNodeId === node.id && dropHint.position === 'inside';
  const isDragging = draggedNodeId === node.id;

  return (
    <motion.div layout="position" className={styles.folderNode}>
      <div
        className={`${styles.nodeRow} ${styles.folderRow} ${isHighlightedRoot ? styles.highlighted : ''} ${isDragging ? styles.dragging : ''} ${isDropBefore ? styles.dropBefore : ''} ${isDropAfter ? styles.dropAfter : ''} ${isDropInside ? styles.dropInside : ''}`}
        {...dragHandlers}
      >
        <div
          className={`${styles.nodeItem} ${styles.folderItem}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setIsOpen(current => !current)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsOpen(current => !current);
            }
          }}
        >
          <div className={styles.nodeContent}>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(node.id);
          }}
          aria-label="Delete Folder"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { type: 'spring', stiffness: 400, damping: 35 }, opacity: { duration: 0.2 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: { type: 'spring', stiffness: 400, damping: 40 }, opacity: { duration: 0.2 } } }}
            className={styles.childrenContainer}
            style={{ overflow: 'hidden' }}
          >
            {(node.children ?? []).map(child => child.kind === 'file'
              ? (
                <FileLeaf
                  key={child.id}
                  {...props}
                  node={child}
                  level={level + 1}
                />
              )
              : (
                <FolderBranch
                  key={child.id}
                  {...props}
                  node={child}
                  level={level + 1}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const FileTree = ({
  tree,
  files,
  onDelete = () => {},
  onMove,
  highlightedPath,
  selectedFileId,
  statuses = {},
  onSelectFile = () => {},
  isStructureLocked = false,
}: {
  tree: WorkbenchTreeState;
  files: WorkbenchFileRecord[];
  onDelete?: (nodeId: string) => void;
  onMove?: (input: { sourceNodeId: string; targetNodeId: string | null; position: WorkbenchDropPosition }) => void | Promise<void>;
  highlightedPath?: string | null;
  selectedFileId?: string | null;
  statuses?: Record<string, FileProcessStatus | undefined>;
  onSelectFile?: (fileId: string) => void;
  isStructureLocked?: boolean;
}) => {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const renderTree = useMemo(() => buildWorkbenchRenderTree(tree), [tree]);

  const folderStats = useMemo(() => {
    const statsMap: FolderStatsMap = {};
    renderTree.forEach(node => collectFolderStats(node, statuses, statsMap));
    return statsMap;
  }, [renderTree, statuses]);

  if (!files || files.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.empty}>
        <File size={24} className={styles.emptyIcon} strokeWidth={1.5} />
        <span>No files selected</span>
      </motion.div>
    );
  }

  const sharedProps = {
    highlightedPath,
    selectedFileId,
    statuses,
    folderStats,
    onSelectFile,
    onDelete,
    onMove,
    isStructureLocked,
    draggedNodeId,
    dropHint,
    setDraggedNodeId,
    setDropHint,
  } satisfies Omit<NodeRendererProps, 'node' | 'level'>;

  return (
    <div className={styles.container}>
      <AnimatePresence initial={false}>
        <div className={styles.treeRoot}>
          {renderTree.map(child => child.kind === 'file'
            ? (
              <FileLeaf
                key={child.id}
                {...sharedProps}
                node={child}
                level={0}
              />
            )
            : (
              <FolderBranch
                key={child.id}
                {...sharedProps}
                node={child}
                level={0}
              />
            ))}
          {onMove && !isStructureLocked && (
            <div
              className={`${styles.rootDropZone} ${dropHint?.targetNodeId === null ? styles.rootDropZoneActive : ''}`}
              onDragOver={(event) => {
                if (!draggedNodeId) {
                  return;
                }

                event.preventDefault();
                setDropHint({ targetNodeId: null, position: 'inside' });
              }}
              onDrop={async (event) => {
                const sourceNodeId = draggedNodeId || event.dataTransfer.getData('text/plain');
                setDraggedNodeId(null);
                setDropHint(null);

                if (!sourceNodeId) {
                  return;
                }

                await onMove({ sourceNodeId, targetNodeId: null, position: 'inside' });
              }}
            >
              拖曳到這裡可移到最外層
            </div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
};
