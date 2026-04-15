'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { KnowledgeBaseRecord } from '@/domain/knowledge/types';
import { createKnowledgeBase, listKnowledgeBases } from '@/lib/client/knowledgeBaseApi';
import {
  DEFAULT_KNOWLEDGE_BASE_ID,
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
} from '@/domain/knowledge/defaults';

type KnowledgeBaseWorkspaceContextValue = {
  knowledgeBases: KnowledgeBaseRecord[];
  activeKnowledgeBaseId: string | null;
  activeKnowledgeBase: KnowledgeBaseRecord | null;
  isLoadingKnowledgeBases: boolean;
  refreshKnowledgeBases: (preferredKnowledgeBaseId?: string | null) => Promise<void>;
  selectKnowledgeBase: (knowledgeBaseId: string | null, options?: { replace?: boolean; pathname?: string }) => void;
  navigateWithKnowledgeBase: (pathname: string, options?: { replace?: boolean }) => void;
};

const KnowledgeBaseWorkspaceContext = createContext<KnowledgeBaseWorkspaceContextValue | undefined>(undefined);

function buildHref(pathname: string, searchParams: URLSearchParams, knowledgeBaseId: string | null) {
  const nextParams = new URLSearchParams(searchParams);

  if (knowledgeBaseId) {
    nextParams.set('kbId', knowledgeBaseId);
  } else {
    nextParams.delete('kbId');
  }

  const search = nextParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function readLocationSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function readLocationKnowledgeBaseId() {
  return readLocationSearchParams().get('kbId');
}

export function KnowledgeBaseWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = useState<string | null>(null);
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true);
  const activeKnowledgeBaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeKnowledgeBaseIdRef.current = activeKnowledgeBaseId;
  }, [activeKnowledgeBaseId]);

  const syncUrl = useCallback((nextPathname: string, knowledgeBaseId: string | null, replace = true) => {
    const href = buildHref(nextPathname, readLocationSearchParams(), knowledgeBaseId);

    if (replace) {
      router.replace(href, { scroll: false });
      return;
    }

    router.push(href, { scroll: false });
  }, [router]);

  const refreshKnowledgeBases = useCallback(async (preferredKnowledgeBaseId?: string | null) => {
    setIsLoadingKnowledgeBases(true);

    try {
      let nextKnowledgeBases = await listKnowledgeBases();

      if (nextKnowledgeBases.length === 0) {
        nextKnowledgeBases = [await createKnowledgeBase({
          id: DEFAULT_KNOWLEDGE_BASE_ID,
          slug: DEFAULT_KNOWLEDGE_BASE_SLUG,
          name: DEFAULT_KNOWLEDGE_BASE_NAME,
          description: 'Default knowledge base for thesis research ingestion.',
        })];
      }

      setKnowledgeBases(nextKnowledgeBases);

      const requestedKnowledgeBaseId = preferredKnowledgeBaseId
        ?? readLocationKnowledgeBaseId()
        ?? activeKnowledgeBaseIdRef.current
        ?? nextKnowledgeBases[0]?.id
        ?? null;
      const resolvedKnowledgeBaseId = requestedKnowledgeBaseId && nextKnowledgeBases.some(knowledgeBase => knowledgeBase.id === requestedKnowledgeBaseId)
        ? requestedKnowledgeBaseId
        : (nextKnowledgeBases[0]?.id ?? null);

      setActiveKnowledgeBaseId(resolvedKnowledgeBaseId);

      if (resolvedKnowledgeBaseId !== readLocationKnowledgeBaseId()) {
        syncUrl(pathname, resolvedKnowledgeBaseId, true);
      }
    } finally {
      setIsLoadingKnowledgeBases(false);
    }
  }, [pathname, syncUrl]);

  useEffect(() => {
    void refreshKnowledgeBases();
  }, [refreshKnowledgeBases]);

  const selectKnowledgeBase = useCallback((knowledgeBaseId: string | null, options?: { replace?: boolean; pathname?: string }) => {
    setActiveKnowledgeBaseId(knowledgeBaseId);
    syncUrl(options?.pathname ?? pathname, knowledgeBaseId, options?.replace ?? true);
  }, [pathname, syncUrl]);

  const navigateWithKnowledgeBase = useCallback((nextPathname: string, options?: { replace?: boolean }) => {
    syncUrl(nextPathname, activeKnowledgeBaseId, options?.replace ?? false);
  }, [activeKnowledgeBaseId, syncUrl]);

  const activeKnowledgeBase = useMemo(
    () => knowledgeBases.find(knowledgeBase => knowledgeBase.id === activeKnowledgeBaseId) ?? null,
    [activeKnowledgeBaseId, knowledgeBases],
  );

  const value = useMemo<KnowledgeBaseWorkspaceContextValue>(() => ({
    knowledgeBases,
    activeKnowledgeBaseId,
    activeKnowledgeBase,
    isLoadingKnowledgeBases,
    refreshKnowledgeBases,
    selectKnowledgeBase,
    navigateWithKnowledgeBase,
  }), [activeKnowledgeBase, activeKnowledgeBaseId, isLoadingKnowledgeBases, knowledgeBases, navigateWithKnowledgeBase, refreshKnowledgeBases, selectKnowledgeBase]);

  return (
    <KnowledgeBaseWorkspaceContext.Provider value={value}>
      {children}
    </KnowledgeBaseWorkspaceContext.Provider>
  );
}

export function useKnowledgeBaseWorkspace() {
  const context = useContext(KnowledgeBaseWorkspaceContext);

  if (!context) {
    throw new Error('useKnowledgeBaseWorkspace must be used within KnowledgeBaseWorkspaceProvider');
  }

  return context;
}
