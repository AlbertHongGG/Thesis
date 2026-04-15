'use client';

import React from 'react';
import { FileText, Network, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useKnowledgeBaseWorkspace } from '@/modules/shared/client/KnowledgeBaseWorkspaceProvider';
import styles from './AppShell.module.css';

type AppShellSection = 'workbench' | 'graph' | 'settings';

interface AppShellProps {
  section: AppShellSection;
  children: React.ReactNode;
}

export function AppShell({ section, children }: AppShellProps) {
  const { navigateWithKnowledgeBase } = useKnowledgeBaseWorkspace();

  return (
    <div className={styles.layout}>
      <header className={styles.topHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.brand}>
            <Sparkles className="text-gradient" size={22} />
            <span className="text-gradient">ThesisGen</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <nav className={styles.nav}>
            <Button variant={section === 'workbench' ? 'secondary' : 'ghost'} onClick={() => navigateWithKnowledgeBase('/')}>
              <FileText size={16} /> RAG Workspace
            </Button>
            <Button variant={section === 'graph' ? 'secondary' : 'ghost'} onClick={() => navigateWithKnowledgeBase('/graph')}>
              <Network size={16} /> Visualize Graph
            </Button>
            <Button variant={section === 'settings' ? 'secondary' : 'ghost'} onClick={() => navigateWithKnowledgeBase('/settings')}>
              <Settings size={16} /> Settings
            </Button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
