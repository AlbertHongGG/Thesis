'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, Trash2 } from 'lucide-react';
import { ForceGraph, type GraphData, type GraphNode } from '@/components/graph/ForceGraph';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { deleteKnowledgeGraphTarget, fetchKnowledgeGraph } from '@/lib/client/graphApi';
import { useKnowledgeBaseWorkspace } from '@/modules/shared/client/KnowledgeBaseWorkspaceProvider';
import styles from '@/app/graph/page.module.css';

export function GraphWorkspaceScreen() {
  const { activeKnowledgeBase, activeKnowledgeBaseId, isLoadingKnowledgeBases } = useKnowledgeBaseWorkspace();
  const { toast } = useToast();
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const loadGraph = useCallback(async () => {
    if (!activeKnowledgeBaseId) {
      setData(null);
      setError(isLoadingKnowledgeBases ? null : 'No active knowledge base selected.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setData(await fetchKnowledgeGraph(activeKnowledgeBaseId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeKnowledgeBaseId, isLoadingKnowledgeBases]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const handleDeleteNode = async (node: GraphNode) => {
    try {
      if (!activeKnowledgeBaseId) {
        throw new Error('No active knowledge base selected.');
      }

      if (node.type === 'folder') {
        await deleteKnowledgeGraphTarget({
          knowledgeBaseId: activeKnowledgeBaseId,
          folderPath: node.id.replace('folder:', ''),
        });
      } else {
        await deleteKnowledgeGraphTarget({
          knowledgeBaseId: activeKnowledgeBaseId,
          documentId: node.id,
        });
      }

      setSelectedNode(null);
      toast('Deleted node successfully.', 'success');
      await loadGraph();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (!activeKnowledgeBaseId) {
      return;
    }

    if (!window.confirm('Are you absolutely sure you want to delete all sources and embeddings for the active knowledge base? This cannot be undone.')) {
      return;
    }

    try {
      toast('Clearing all data...', 'info');
      await deleteKnowledgeGraphTarget({ knowledgeBaseId: activeKnowledgeBaseId, deleteAll: true });
      setSelectedNode(null);
      toast('All data successfully cleared.', 'success');
      await loadGraph();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <>
      <div className={styles.graphContainer}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <LoaderCircle size={48} className={styles.spinner} />
            <p>{activeKnowledgeBase ? `Building graph projection for ${activeKnowledgeBase.name}...` : 'Building graph projection...'}</p>
          </div>
        )}

        {error && !loading && (
          <div className={styles.errorOverlay}>
            <AlertCircle size={48} />
            <h2>Visualization Error</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <ForceGraph
            data={data}
            onNodeClick={setSelectedNode}
            selectedNodeId={selectedNode?.id}
          />
        )}
      </div>

      {!loading && !error && data && (
        <div className={styles.legend}>
          <h4 className={styles.legendTitle}>Graph Legend</h4>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotDoc}`}></span>
            Knowledge Source
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotChunk}`}></span>
            Knowledge Unit
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendLine} ${styles.legendLineParent}`}></span>
            Parent Relation
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendLine} ${styles.legendLineRelated}`}></span>
            Semantic Link
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="secondary"
              onClick={handleDeleteAll}
              style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', background: 'transparent' }}
            >
              <Trash2 size={14} /> Clear Active KB Data
            </Button>
          </div>
        </div>
      )}

      <NodeDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onDelete={handleDeleteNode}
      />
    </>
  );
}