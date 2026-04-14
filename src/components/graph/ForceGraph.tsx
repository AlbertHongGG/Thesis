'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export interface GraphNode {
  id: string;
  name: string;
  group: string;
  val: number;
  type: 'document' | 'chunk';
  summary?: string;
  content?: string;
  keywords?: string[];
  sourceType?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'child' | 'related';
  label?: string;
  score?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface ForceGraphProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

export const ForceGraph: React.FC<ForceGraphProps> = ({ data, onNodeClick, selectedNodeId }) => {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick(node);
      
      if (fgRef.current) {
        // Aim at node from outside it
        const distance = 100;
        const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, 1);
        
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(2.5, 600);
      }
    },
    [onNodeClick]
  );

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNodeId === node.id;
    const isDoc = node.type === 'document';
    
    // Size logic
    let size = isDoc ? 8 : 4;
    // Boost size if zoomed out, shrink if zoomed in, to keep them visible but not overwhelming
    size = Math.max(1.5, size / Math.pow(globalScale, 0.5));
    
    // Colors based on css variables 
    // using direct hex since we are in canvas
    const docColor = '#3b82f6'; // var(--accent-primary)
    const chunkColor = '#8baef9'; // var(--accent-secondary)
    const selectedColor = '#f59e0b'; // Amber for highlight
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, isSelected ? size * 1.5 : size, 0, 2 * Math.PI, false);
    
    if (isSelected) {
      ctx.fillStyle = selectedColor;
      ctx.shadowColor = selectedColor;
      ctx.shadowBlur = 10 * globalScale;
    } else {
      ctx.fillStyle = isDoc ? docColor : chunkColor;
      ctx.shadowBlur = 0;
    }
    
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow
    
    // Text labels for documents only. Do not draw text for chunk nodes.
    if (isDoc) {
      const label = node.name || '';
      // Dynamically scale font size.
      const fontSize = Math.max(10 / globalScale, 4);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.roundRect(
        node.x - bckgDimensions[0] / 2, 
        node.y + size + fontSize * 0.5 - bckgDimensions[1] / 2, 
        bckgDimensions[0], 
        bckgDimensions[1],
        4 / globalScale
      );
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#f59e0b' : '#334155';
      ctx.fillText(label, node.x, node.y + size + fontSize * 0.5);
    }
  }, [selectedNodeId]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeColor={(node: any) => node.type === 'document' ? '#3b82f6' : '#8baef9'}
        nodeRelSize={6}
        nodeCanvasObject={paintNode}
        
        // Links config
        linkColor={(link: any) => link.type === 'child' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(59, 130, 246, 0.2)'}
        linkWidth={(link: any) => link.type === 'child' ? 1.5 : 0.8}
        linkLineDash={(link: any) => link.type === 'related' ? [2, 2] : undefined}
        
        // Particles for relation links
        linkDirectionalParticles={(link: any) => link.type === 'related' ? 2 : 0}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => '#3b82f6'}
        
        onNodeClick={handleNodeClick}
        
        // Physics config
        d3VelocityDecay={0.3}
        warmupTicks={200}
        cooldownTicks={100}
        
        backgroundColor="#f8fafc" // var(--bg-primary)
      />
    </div>
  );
};
