'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Folder, FileText, Image as ImageIcon, File, Trash2 } from 'lucide-react';
import type { ExtendedFile } from './DropZone';
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
  if (name.match(/\.(png|jpe?g|gif|svg|webp)$/i)) return <ImageIcon size={16} className={styles.iconImage} />;
  if (name.match(/\.(pdf|txt|docx|doc)$/i)) return <FileText size={16} className={styles.iconDoc} />;
  return <File size={16} className={styles.iconDefault} />;
};

type TreeNodeRendererProps = {
  node: TreeNode;
  level?: number;
  onDelete?: (path: string) => void;
};

const TreeNodeRenderer = ({ node, level = 0, onDelete }: TreeNodeRendererProps) => {
  // Folders are CLOSED by default now (isOpen = false)
  const [isOpen, setIsOpen] = useState(false);
  const childrenNodes = node.children ? Object.values(node.children).sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
  }) : [];

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(node.path);
  };

  if (node.name === 'root') {
    return (
      <div className={styles.treeRoot}>
        {childrenNodes.map((child, idx) => (
          <TreeNodeRenderer key={idx} node={child} level={0} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  if (node.isFile) {
    return (
      <div className={styles.nodeItem}>
        <div style={{ marginLeft: `${level * 16}px`, display: 'flex', alignItems: 'center', flex: 1 }}>
            {getFileIcon(node.name)}
            <span className={styles.nodeName}>{node.name}</span>
        </div>
        <div className={styles.deleteBtn} onClick={handleDeleteClick}>
          <Trash2 size={14} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.folderNode}>
      <div
        className={styles.nodeItem}
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: '12px' }}
      >
        <div style={{ marginLeft: `${level * 16}px`, display: 'flex', alignItems: 'center', flex: 1 }}>
            <span className={styles.chevron}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <Folder size={16} className={styles.iconFolder} />
            <span className={styles.nodeName}>{node.name}</span>
        </div>
        <div className={styles.deleteBtn} onClick={handleDeleteClick}>
          <Trash2 size={14} />
        </div>
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
              <TreeNodeRenderer key={idx} node={child} level={level + 1} onDelete={onDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FileTree = ({ 
  files, 
  onDelete 
}: { 
  files: ExtendedFile[]; 
  onDelete?: (path: string) => void;
}) => {
  if (!files || files.length === 0) return <div className={styles.empty}>Empty selection</div>;
  const tree = buildTree(files);
  return <div className={styles.container}><TreeNodeRenderer node={tree} onDelete={onDelete} /></div>;
};
