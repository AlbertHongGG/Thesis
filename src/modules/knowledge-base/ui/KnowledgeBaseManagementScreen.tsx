'use client';

import React, { useMemo, useState } from 'react';
import { Box, Database, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useKnowledgeBaseWorkspace } from '@/modules/shared/client/KnowledgeBaseWorkspaceProvider';
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  runKnowledgeBaseMaintenance,
} from '@/lib/client/knowledgeBaseApi';
import type { KnowledgeBaseMaintenanceAction } from '@/domain/operations/types';
import styles from './KnowledgeBaseManagementScreen.module.css';

export function KnowledgeBaseManagementScreen() {
  const {
    knowledgeBases,
    activeKnowledgeBase,
    activeKnowledgeBaseId,
    isLoadingKnowledgeBases,
    refreshKnowledgeBases,
    selectKnowledgeBase,
  } = useKnowledgeBaseWorkspace();
  const { toast } = useToast();
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('');
  const [isCreatingKnowledgeBase, setIsCreatingKnowledgeBase] = useState(false);
  const [maintenanceState, setMaintenanceState] = useState<KnowledgeBaseMaintenanceAction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedKnowledgeBases = useMemo(
    () => [...knowledgeBases].sort((left, right) => left.name.localeCompare(right.name, 'en-US')),
    [knowledgeBases],
  );
  const canDeleteActiveKnowledgeBase = Boolean(activeKnowledgeBaseId) && knowledgeBases.length > 1;

  const handleCreateKnowledgeBase = async () => {
    const trimmedName = newKnowledgeBaseName.trim();

    if (!trimmedName) {
      return;
    }

    setIsCreatingKnowledgeBase(true);

    try {
      const created = await createKnowledgeBase({ name: trimmedName });
      setNewKnowledgeBaseName('');
      await refreshKnowledgeBases(created.id);
      selectKnowledgeBase(created.id);
      toast(`Knowledge base "${created.name}" created.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setIsCreatingKnowledgeBase(false);
    }
  };

  const handleRunMaintenance = async (action: KnowledgeBaseMaintenanceAction) => {
    if (!activeKnowledgeBaseId || !activeKnowledgeBase) {
      return;
    }

    setMaintenanceState(action);

    try {
      const result = await runKnowledgeBaseMaintenance(activeKnowledgeBaseId, action);
      await refreshKnowledgeBases(activeKnowledgeBaseId);

      toast(
        action === 'reindex'
          ? `Reindex completed: ${result.unitCount} units, profile v${result.profileVersion ?? '-'}.`
          : `Knowledge profile rebuilt: v${result.profileVersion ?? '-'}.`,
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setMaintenanceState(null);
    }
  };

  const handleDeleteKnowledgeBase = async () => {
    if (!activeKnowledgeBaseId || !activeKnowledgeBase || knowledgeBases.length <= 1) {
      return;
    }

    if (!window.confirm(`Delete knowledge base "${activeKnowledgeBase.name}"? This will remove its stored sources and units.`)) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteKnowledgeBase(activeKnowledgeBaseId);
      await refreshKnowledgeBases();
      toast(`Knowledge base "${activeKnowledgeBase.name}" deleted.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.panelTitle}>Knowledge Base</h2>
        </div>

        <div className={styles.fieldStack}>
          <div className={styles.field}>
            <span className={styles.label}>Current</span>
            <Select
              value={activeKnowledgeBaseId ?? ''}
              onChange={value => selectKnowledgeBase(value)}
              options={sortedKnowledgeBases.map(knowledgeBase => ({ value: knowledgeBase.id, label: knowledgeBase.name }))}
              placeholder={isLoadingKnowledgeBases ? 'Loading...' : 'Select knowledge base'}
            />
          </div>

          {activeKnowledgeBase ? (
            <div className={styles.statsRow}>
              <span className={styles.stat}>{activeKnowledgeBase.sourceCount} sources</span>
              <span className={styles.stat}>{activeKnowledgeBase.unitCount} units</span>
              <span className={styles.stat}>profile v{activeKnowledgeBase.profileVersion}</span>
              <span className={styles.stat}>{activeKnowledgeBase.status}</span>
            </div>
          ) : (
            <div className={styles.empty}>
              {isLoadingKnowledgeBases ? 'Loading knowledge bases...' : 'No knowledge base available.'}
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Create new</span>
            <div className={styles.createRow}>
              <Input
                value={newKnowledgeBaseName}
                onChange={event => setNewKnowledgeBaseName(event.target.value)}
                placeholder="New knowledge base"
              />
              <Button variant="secondary" onClick={() => void handleCreateKnowledgeBase()} isLoading={isCreatingKnowledgeBase} disabled={!newKnowledgeBaseName.trim()}>
                <Database size={16} /> Create
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => void handleDeleteKnowledgeBase()} isLoading={isDeleting} disabled={!canDeleteActiveKnowledgeBase}>
            <Trash2 size={16} /> Delete current
          </Button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.panelTitle}>Maintenance</h2>
        </div>

        {!activeKnowledgeBase ? (
          <div className={styles.empty}>Select a knowledge base first.</div>
        ) : (
          <div className={styles.actionList}>
            <div className={styles.actionRow}>
              <div className={styles.actionBody}>
                <div className={styles.actionTitle}>Rebuild Profile</div>
                <div className={styles.actionHint}>Refresh summary and key terms.</div>
              </div>
              <Button variant="secondary" onClick={() => void handleRunMaintenance('rebuild-profile')} isLoading={maintenanceState === 'rebuild-profile'}>
                <RotateCcw size={16} /> Rebuild
              </Button>
            </div>

            <div className={styles.actionRow}>
              <div className={styles.actionBody}>
                <div className={styles.actionTitle}>Reindex</div>
                <div className={styles.actionHint}>Recreate embeddings and relation links.</div>
              </div>
              <Button variant="secondary" onClick={() => void handleRunMaintenance('reindex')} isLoading={maintenanceState === 'reindex'}>
                <Box size={16} /> Reindex
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
