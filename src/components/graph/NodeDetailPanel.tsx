'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, AlignLeft, Hash } from 'lucide-react';
import type { GraphNode } from './ForceGraph';
import styles from './NodeDetailPanel.module.css';

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, onClose }) => {
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
                <span className={`${styles.badge} ${node.type === 'chunk' ? styles.badgeChunk : ''}`}>
                  {node.type === 'document' ? 'Document' : 'Knowledge Chunk'}
                </span>
                <h3 className={styles.title}>{node.name}</h3>
              </div>
              <button className={styles.closeButton} onClick={onClose} aria-label="Close panel">
                <X size={20} />
              </button>
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

              {node.keywords && node.keywords.length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>
                    <Hash /> Keywords
                  </h4>
                  <div className={styles.tagContainer}>
                    {node.keywords.map((kw, idx) => (
                      <span key={idx} className={styles.tag}>{kw}</span>
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
