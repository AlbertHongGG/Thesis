'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type ForceGraphInstance = {
  centerAt: (x?: number, y?: number, ms?: number) => void;
  zoom: (scale: number, ms?: number) => void;
};

export interface GraphNode {
  id: string;
  name: string;
  fullName?: string;
  group: string;
  val: number;
  type: 'source' | 'unit' | 'folder';
  summary?: string;
  content?: string;
  terms?: string[];
  entities?: string[];
  sourceType?: string;
  unitType?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'child' | 'related' | 'hierarchy';
  label?: string;
  score?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

type ForceGraphCanvasProps = {
  width: number;
  height: number;
  graphData: GraphData;
  nodeColor: (node: GraphNode) => string;
  nodeRelSize: number;
  nodeCanvasObject: (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  linkColor: (link: GraphLink) => string;
  linkWidth: (link: GraphLink) => number;
  linkLineDash: (link: GraphLink) => number[] | null;
  linkDirectionalParticles: (link: GraphLink) => number;
  linkDirectionalParticleSpeed: number;
  linkDirectionalParticleWidth: number;
  linkDirectionalParticleColor: () => string;
  onNodeClick: (node: GraphNode) => void;
  d3VelocityDecay: number;
  warmupTicks: number;
  cooldownTicks: number;
  backgroundColor: string;
};

const ForceGraphCanvas = ForceGraph2D as unknown as React.ForwardRefExoticComponent<
  ForceGraphCanvasProps & React.RefAttributes<ForceGraphInstance>
>;

interface ForceGraphProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

export const ForceGraph: React.FC<ForceGraphProps> = ({ data, onNodeClick, selectedNodeId }) => {
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateDimensions = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;

      if (width === 0 || height === 0) {
        return;
      }

      setDimensions(prev => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }

        return { width, height };
      });
    };

    updateDimensions();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateDimensions();
      });

      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick(node);
      
      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(2.5, 600);
      }
    },
    [onNodeClick]
  );

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNodeId === node.id;
    const isDoc = node.type === 'source';
    const isFolder = node.type === 'folder';
    const nodeX = node.x ?? 0;
    const nodeY = node.y ?? 0;
    
    // Size logic
    let size = isFolder ? 12 : (isDoc ? 8 : 4);
    // Boost size if zoomed out, shrink if zoomed in, to keep them visible but not overwhelming
    size = Math.max(1.5, size / Math.pow(globalScale, 0.5));
    
    // Colors based on css variables 
    // using direct hex since we are in canvas
    const folderColor = '#64748b'; // slate-500
    const docColor = '#3b82f6'; // blue-500
    const unitColor = '#8baef9'; // lighter blue
    const selectedColor = '#f59e0b'; // Amber for highlight
    
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, isSelected ? size * 1.5 : size, 0, 2 * Math.PI, false);
    
    if (isSelected) {
      ctx.fillStyle = selectedColor;
      ctx.shadowColor = selectedColor;
      ctx.shadowBlur = 10 * globalScale;
    } else {
      ctx.fillStyle = isFolder ? folderColor : (isDoc ? docColor : unitColor);
      ctx.shadowBlur = 0;
    }
    
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow
    
    // Text labels for sources and folders only. Do not draw text for unit nodes.
    if (isDoc || isFolder) {
      const label = node.name || '';
      // Dynamically scale font size.
      const fontSize = Math.max((isFolder ? 12 : 10) / globalScale, 4);
      ctx.font = `${isFolder ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.roundRect(
        nodeX - bckgDimensions[0] / 2, 
        nodeY + size + fontSize * 0.5 - bckgDimensions[1] / 2, 
        bckgDimensions[0], 
        bckgDimensions[1],
        4 / globalScale
      );
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#f59e0b' : (isFolder ? '#475569' : '#334155');
      ctx.fillText(label, nodeX, nodeY + size + fontSize * 0.5);
    }
  }, [selectedNodeId]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraphCanvas
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeColor={(node) => node.type === 'folder' ? '#64748b' : (node.type === 'source' ? '#3b82f6' : '#8baef9')}
        nodeRelSize={6}
        nodeCanvasObject={paintNode}
        
        // Links config
        linkColor={(link) => {
          if (link.type === 'child' || link.type === 'hierarchy') return 'rgba(148, 163, 184, 0.4)';
          return 'rgba(59, 130, 246, 0.2)'; // related
        }}
        linkWidth={(link) => (link.type === 'child' || link.type === 'hierarchy') ? 1.5 : 0.8}
        linkLineDash={(link) => link.type === 'related' ? [2, 2] : null}
        
        // Particles for relation links
        linkDirectionalParticles={(link) => link.type === 'related' ? 2 : 0}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => '#3b82f6'}
        
        onNodeClick={handleNodeClick}
        
        // Physics config
        d3VelocityDecay={0.3}
        warmupTicks={200}
        cooldownTicks={100}
        
        backgroundColor="rgba(0, 0, 0, 0)"
      />
    </div>
  );
};
