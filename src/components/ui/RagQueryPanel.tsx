'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, FileText, DatabaseZap, Search, X, LoaderCircle } from 'lucide-react';
import styles from './RagQueryPanel.module.css';

interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  summary: string;
  similarity: number;
}

export function RagQueryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsQuerying(true);
    setHasResults(false);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 5 }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setResults(data.results || []);
      setHasResults(true);
    } catch (err: any) {
      console.error('Search failed:', err);
      setErrorMsg(err.message || 'An error occurred while searching.');
      setHasResults(true);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setQuery('');
      setIsQuerying(false);
      setHasResults(false);
      setResults([]);
      setErrorMsg(null);
    }, 300);
  };


  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      <div className={styles.overlayWrapper}>
        {isOpen ? (
          <motion.div
            layoutId="rag-panel"
            className={styles.panelContainer}
            style={{ borderRadius: 16 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          >
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <Sparkles size={18} className="text-gradient" />
                RAG Search
              </div>
              <button type="button" className={styles.closeButton} onClick={handleClose}>
                <X size={18} />
              </button>
            </div>

            <form className={styles.inputWrapper} onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className={styles.inputField}
                placeholder="Search knowledge base..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (hasResults && e.target.value.trim() === '') {
                     setHasResults(false);
                  }
                }}
              />

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isQuerying || !query.trim()}
              >
                {isQuerying ? <LoaderCircle size={18} className={styles.spinner} /> : <Search size={18} />}
              </button>
            </form>

            <AnimatePresence initial={false}>
              {hasResults && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className={styles.resultsSection}>
                    <div className={styles.resultsSectionTitle}>
                      <DatabaseZap size={14} /> Retrieved Results
                    </div>
                    
                    <div className={styles.cardGrid}>
                      {errorMsg && (
                        <div style={{ color: 'var(--accent-red)', padding: '1rem', fontSize: '0.9rem' }}>
                          {errorMsg}
                        </div>
                      )}
                      
                      {!errorMsg && results.length === 0 && (
                        <div style={{ color: 'var(--text-muted)', padding: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
                          找不到相關結果。請嘗試不同的關鍵字。
                        </div>
                      )}

                      {!errorMsg && results.map((result, idx) => (
                        <motion.div 
                          key={result.id} 
                          className={styles.resultCard}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + idx * 0.05 }}
                        >
                          <div className={styles.cardHeader}>
                            <div className={styles.cardIcon}>
                              <FileText size={16} />
                            </div>
                            <div className={styles.scoreBadge}>
                              ~{Math.round(result.similarity * 100)}% Match
                            </div>
                          </div>
                          <div className={styles.cardBody}>
                            <div className={styles.cardTitle}>{result.summary || '未命名片段'}</div>
                            <div className={styles.cardSnippet}>{result.content}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div style={{ position: 'relative' }}>
            <motion.button
              layoutId="rag-panel"
              className={styles.fabButton}
              style={{ borderRadius: 28 }}
              onClick={() => setIsOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            >
              <Search size={22} />
            </motion.button>
          </div>
        )}
      </div>
    </>
  );
}
