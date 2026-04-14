'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoaderCircle, AlertCircle, ArrowLeft, Sparkles, Cpu, Image as ImageIcon, Box, Database, Network, FileText, Settings } from 'lucide-react';
import { ForceGraph, GraphData, GraphNode } from '@/components/graph/ForceGraph';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';
import mainStyles from '../page.module.css';

function GraphWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const kbId = searchParams.get('kbId');

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
  }, [kbId]);

  return (
    <div className={mainStyles.layoutContainer}>
      <header className={mainStyles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className={mainStyles.logo} style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <Sparkles className="text-gradient" size={24} />
            <span className="text-gradient">ThesisGen</span>
          </div>
          <div className={mainStyles.badgesRow} style={{ marginTop: 0 }}>
            <div className={mainStyles.badge}><Cpu size={14} /> <b>qwen3.5:27b</b></div>
            <div className={mainStyles.badge}><ImageIcon size={14} /> <b>qwen3-vl:32b</b></div>
            <div className={mainStyles.badge}><Box size={14} /> <b>embeddings</b></div>
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
            Document Source
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotChunk}`}></span>
            Knowledge Chunk
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendLine} ${styles.legendLineParent}`}></span>
            Parent Relation
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendLine} ${styles.legendLineRelated}`}></span>
            Semantic Link
          </div>
        </div>
      )}

      <NodeDetailPanel 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)} 
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
