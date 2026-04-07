'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Database, FileText, Settings, Sparkles, Cpu, Image as ImageIcon, Box, Play, Square, SkipForward } from 'lucide-react';
import { DropZone, ExtendedFile } from '@/components/ui/DropZone';
import { FileTree } from '@/components/ui/FileTree';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function DataWorkbench() {
  const [files, setFiles] = useState<ExtendedFile[]>([]);
  const [processMode, setProcessMode] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const globalContextRef = useRef<string>('');

  // Sorting logic: documents first, images later
  const sortedFiles = React.useMemo(() => {
    const docs = files.filter(f => !f.name.match(/\.(png|jpe?g|gif|webp)$/i));
    const imgs = files.filter(f => f.name.match(/\.(png|jpe?g|gif|webp)$/i));
    return [...docs, ...imgs];
  }, [files]);

  useEffect(() => {
    let ignore = false;

    const processNext = async () => {
      if (processMode !== 'playing' || ignore) return;
      if (currentIndex >= sortedFiles.length) {
        setProcessMode('idle');
        setLogs(prev => [...prev, '✅ All files processed successfully.']);
        return;
      }

      const file = sortedFiles[currentIndex];
      setLogs(prev => [...prev, `⏳ Processing [${currentIndex + 1}/${sortedFiles.length}]: ${file.name}...`]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('globalContext', globalContextRef.current);
        
        // Let's await API response
        const res = await fetch('/api/ingest', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (!ignore) {
            if (data.success) {
               setLogs(prev => [...prev, `✨ Completed: ${file.name} - ${data.result.type === 'document' ? `(${data.result.chunks} Vector Chunks)` : `(Image Analyzed)`}`]);
               if (data.result.summary) {
                  globalContextRef.current += '\n' + data.result.summary;
               }
            } else {
               setLogs(prev => [...prev, `❌ Error [${file.name}]: ${data.error}`]);
            }
            setCurrentIndex(prev => prev + 1);
        }
      } catch (err: any) {
        if (!ignore) {
            setLogs(prev => [...prev, `❌ Network Error [${file.name}]: ${err.message}`]);
            setCurrentIndex(prev => prev + 1);
        }
      }
    };

    if (processMode === 'playing') {
      // Add a slight delay for UI fluidity
      const timer = setTimeout(() => {
        processNext();
      }, 500);
      return () => { ignore = true; clearTimeout(timer); };
    }
  }, [processMode, currentIndex, sortedFiles]);

  const handleDelete = (path: string) => {
    setFiles(prev => prev.filter(f => !(f.path || f.name).startsWith(path)));
    if (processMode !== 'idle') setProcessMode('idle');
  };

  const handleDrop = (newFiles: ExtendedFile[]) => {
    setFiles(prev => {
      const existingPaths = prev.map(f => f.path || f.name);
      const filteredNew = newFiles.filter(f => !existingPaths.includes(f.path || f.name));
      return [...prev, ...filteredNew];
    });
  };

  const handlePlay = () => {
    if (currentIndex >= sortedFiles.length) {
      setCurrentIndex(0);
      globalContextRef.current = '';
    }
    setProcessMode('playing');
  };

  const handlePause = () => {
    setProcessMode('paused');
  };

  const handleNext = async () => {
    if (currentIndex >= sortedFiles.length) return;
    setProcessMode('paused');
    
    const file = sortedFiles[currentIndex];
    setLogs(prev => [...prev, `⏳ [Manual-Step] Processing [${currentIndex + 1}/${sortedFiles.length}]: ${file.name}...`]);
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('globalContext', globalContextRef.current);
        
        const res = await fetch('/api/ingest', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.success) {
           setLogs(prev => [...prev, `✨ Completed: ${file.name} - ${data.result.type === 'document' ? `(${data.result.chunks} Vector Chunks)` : `(Image Analyzed)`}`]);
           if (data.result.summary) {
              globalContextRef.current += '\n' + data.result.summary;
           }
        } else {
           setLogs(prev => [...prev, `❌ Error [${file.name}]: ${data.error}`]);
        }
        setCurrentIndex(prev => prev + 1);
    } catch (err: any) {
        setLogs(prev => [...prev, `❌ Network Error: ${err.message}`]);
        setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className={styles.layoutContainer}>
      {/* Top Header */}
      <header className={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className={styles.logo}>
            <Sparkles className="text-gradient" size={24} />
            <span className="text-gradient">ThesisGen</span>
          </div>
          <div className={styles.badgesRow} style={{ marginTop: 0 }}>
            <div className={styles.badge}><Cpu size={14} /> <b>qwen3.5:27b</b></div>
            <div className={styles.badge}><ImageIcon size={14} /> <b>qwen3-vl:32b</b></div>
            <div className={styles.badge}><Box size={14} /> <b>pgvector</b></div>
          </div>
        </div>
        
        <nav className={styles.navMenu}>
          <Button variant="secondary"><Database size={16} /> Data Source</Button>
          <Button variant="ghost"><FileText size={16} /> Writing Desk</Button>
          <Button variant="ghost"><Settings size={16} /> Settings</Button>
        </nav>
      </header>

      {/* Main Layout Wrapper */}
      <div className={styles.mainWrapper}>
        
        {/* Left Sidebar (Ingest & Tree) */}
        <aside className={styles.sidebarContainer}>
          <DropZone onDrop={handleDrop} isCompact={files.length > 0} />

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 className={styles.sidebarSectionTitle} style={{ margin: 0 }}>Files ({files.length})</h3>
                <Button variant="ghost" onClick={() => { setFiles([]); setLogs([]); setCurrentIndex(0); setProcessMode('idle'); globalContextRef.current=''; }} style={{ padding: '4px 8px', fontSize: '0.8rem', height: 'auto' }}>Clear</Button>
              </div>
              <FileTree files={files} onDelete={handleDelete} />
            </div>
          )}
        </aside>
        
        {/* Right Main Working Panel */}
        <main className={styles.mainPanel}>
          <div className={styles.workingArea}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
               <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>RAG Knowledge Extraction Engine</h3>
               
               {files.length > 0 && (
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {processMode === 'playing' ? (
                      <Button variant="secondary" onClick={handlePause}><Square size={14} /> Stop</Button>
                    ) : (
                       <Button variant="primary" onClick={handlePlay}><Play size={14} /> {currentIndex > 0 && currentIndex < sortedFiles.length ? "Resume" : "Start Auto"}</Button>
                    )}
                    <Button variant="secondary" onClick={handleNext} disabled={processMode === 'playing'}><SkipForward size={14} /> Next Step</Button>
                 </div>
               )}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
               {logs.length === 0 ? (
                 <div style={{ color: 'var(--text-muted)' }}>Upload files and press Start to begin RAG extraction step-by-step.</div>
               ) : (
                 logs.map((log, i) => (
                   <div key={i} style={{ color: log.includes('✅') ? '#10b981' : log.includes('❌') ? '#ef4444' : log.includes('✨') ? 'var(--accent-primary)' : 'var(--text-secondary)', padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                     {log}
                   </div>
                 ))
               )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
