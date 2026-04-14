'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoaderCircle, AlertCircle, ArrowLeft, Sparkles, Cpu, Image as ImageIcon, Box, Database, Network, FileText, Settings, Trash2 } from 'lucide-react';
import { ForceGraph, GraphData, GraphNode } from '@/components/graph/ForceGraph';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';
import mainStyles from '../page.module.css';

function GraphWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const kbId = searchParams.get('kbId');
  const { toast } = useToast();

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!kbId) {
      setError('No Knowledge Base ID provided.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/graph?kbId=${encodeURIComponent(kbId)}`);
        if (!res.ok) {
          throw new Error('Failed to fetch graph data: ' + res.statusText);
        }
        const json = await res.json();
        
        if (json.error) {
          throw new Error(json.error);
        }

        // Post process to ensure unique nodes or filter orphans if desired
        setData({ nodes: json.nodes, links: json.links });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Assign fetchData to window object to trigger reload after delete
    // OR alternatively, handle deletion directly here
    (window as any).__refreshGraphData = fetchData;
    
  }, [kbId]);

  const handleDeleteNode = async (node: GraphNode) => {
    try {
      let params = new URLSearchParams({ kbId: kbId! });
      if (node.type === 'folder') {
        const folderPath = node.id.replace('folder:', '');
        params.append('folderPath', folderPath);
      } else {
        params.append('documentId', node.id);
      }

      const res = await fetch(`/api/graph?${params.toString()}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete node data');
      
      setSelectedNode(null);
      toast('Deleted node successfully.', 'success');
      if ((window as any).__refreshGraphData) {
        (window as any).__refreshGraphData();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you absolutely sure you want to delete ALL vector embeddings and documents? This cannot be undone.')) {
        return;
    }
    toast('Clearing all data...', 'info');
    try {
      const res = await fetch(`/api/graph?kbId=${kbId}&deleteAll=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear graph data');
      
      setSelectedNode(null);
      toast('All data successfully cleared.', 'success');
      if ((window as any).__refreshGraphData) {
        (window as any).__refreshGraphData();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className={mainStyles.layoutContainer}>
      <header className={mainStyles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className={mainStyles.logo} style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <Sparkles className="text-gradient" size={24} />
            <span className="text-gradient">ThesisGen</span>
          </div>
        </div>

        <nav className={mainStyles.navMenu}>
          <Button variant="ghost" onClick={() => router.push('/')}>
            <Database size={16} /> Knowledge Base
          </Button>
          <Button variant="secondary">
            <Network size={16} /> Visualize Graph
          </Button>
          <Button variant="ghost" onClick={() => router.push('/')}><FileText size={16} /> Writing Desk</Button>
          <Button variant="ghost" onClick={() => router.push('/')}><Settings size={16} /> Settings</Button>
        </nav>
      </header>

      <div className={styles.graphContainer}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <LoaderCircle size={48} className={styles.spinner} />
            <p>Simulating vector relationships...</p>
          </div>
        )}
        
        {error && (
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
              <Trash2 size={14} /> Clear All Data
            </Button>
          </div>
        </div>
      )}

      <NodeDetailPanel 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)} 
        onDelete={handleDeleteNode}
      />
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading graph settings...</div>}>
      <GraphWorkspace />
    </Suspense>
  )
}
