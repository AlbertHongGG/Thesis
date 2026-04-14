'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, AlignLeft, Hash, Trash2 } from 'lucide-react';
import type { GraphNode } from './ForceGraph';
import styles from './NodeDetailPanel.module.css';

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  onDelete?: (node: GraphNode) => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, onClose, onDelete }) => {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          className={styles.panelWrapper}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className={styles.panel}>
            <div className={styles.header}>
              <div className={styles.titleGroup}>
                <span className={`${styles.badge} ${node.type === 'unit' ? styles.badgeChunk : ''}`}>
                  {node.type === 'source' ? 'Source' : node.type === 'unit' ? 'Knowledge Unit' : 'Folder'}
                </span>
                <h3 className={styles.title}>{node.fullName || node.name}</h3>
              </div>
              <div className={styles.actionsGroup}>
                {onDelete && node.type !== 'unit' && (
                  <button 
                    className={`${styles.iconButton} ${styles.dangerButton}`} 
                    onClick={() => {
                        if (confirm(`Are you sure you want to delete this ${node.type}?`)) {
                            onDelete(node);
                        }
                    }} 
                    aria-label="Delete node"
                    title={`Delete ${node.type}`}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button className={styles.iconButton} onClick={onClose} aria-label="Close panel">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className={styles.content}>
              {node.summary && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>
                    <FileText /> Summary
                  </h4>
                  <div className={styles.bodyText}>{node.summary}</div>
                </div>
              )}

              {node.content && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>
                    <AlignLeft /> Content
                  </h4>
                  <div className={styles.bodyText}>{node.content}</div>
                </div>
              )}

              {node.terms && node.terms.length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>
                    <Hash /> Terms
                  </h4>
                  <div className={styles.tagContainer}>
                    {node.terms.map((kw, idx) => (
                      <span key={idx} className={styles.tag}>{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {node.entities && node.entities.length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>
                    <Hash /> Entities
                  </h4>
                  <div className={styles.tagContainer}>
                    {node.entities.map((entity, idx) => (
                      <span key={idx} className={styles.tag}>{entity}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
