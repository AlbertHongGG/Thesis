import { describe, expect, it } from 'vitest';
import type { WorkbenchFileRecord } from './types';
import {
  buildInitialWorkbenchTree,
  collectPathSyncItems,
  createWorkbenchFileRecord,
  deleteWorkbenchNode,
  findFileNodeId,
  getOrderedFileIds,
  moveWorkbenchNode,
} from './treeState';

function createFile(path: string) {
  const file = new File(['content'], path.split('/').pop() || path, { type: 'text/markdown' }) as File & { path?: string };
  file.path = path;
  return createWorkbenchFileRecord(file);
}

function getFileByName(files: WorkbenchFileRecord[], name: string) {
  const file = files.find(item => item.name === name);
  if (!file) {
    throw new Error(`File ${name} not found`);
  }

  return file;
}

describe('treeState', () => {
  it('builds the initial tree using default folder-first order', () => {
    const files = [
      createFile('文件資料/紀錄.md'),
      createFile('文件資料/AgentSkills/spec-a/step-a.md'),
      createFile('文件資料/專案計畫/1-1/plan-1.md'),
    ];

    const tree = buildInitialWorkbenchTree(files);
    const orderedNames = getOrderedFileIds(tree).map(fileId => files.find(file => file.id === fileId)?.workbenchPath);

    expect(orderedNames).toEqual([
      '文件資料/專案計畫/1-1/plan-1.md',
      '文件資料/AgentSkills/spec-a/step-a.md',
      '文件資料/紀錄.md',
    ]);
  });

  it('moves a completed file into another folder and marks it for path sync', () => {
    const files = [
      createFile('文件資料/紀錄.md'),
      createFile('文件資料/AgentSkills/spec-a/step-a.md'),
      createFile('文件資料/專案計畫/1-1/plan-1.md'),
    ];
    const completedFile = getFileByName(files, '紀錄.md');
    completedFile.sourceId = 'source-1';
    completedFile.knowledgeBaseId = 'kb-1';
    completedFile.syncedCanonicalPath = completedFile.workbenchPath;
    completedFile.sourceSyncStatus = 'synced';

    const tree = buildInitialWorkbenchTree(files);
    const sourceNodeId = findFileNodeId(tree, completedFile.id);
    const targetFolderId = Object.values(tree.nodes).find(node => node.kind === 'folder' && node.name === '專案計畫')?.id;

    if (!sourceNodeId || !targetFolderId) {
      throw new Error('Required nodes not found');
    }

    const moved = moveWorkbenchNode({
      tree,
      files,
      sourceNodeId,
      targetNodeId: targetFolderId,
      position: 'inside',
    });

    const movedFile = getFileByName(moved.files, '紀錄.md');
    movedFile.sourceSyncStatus = 'pending-path-sync';
    const syncItems = collectPathSyncItems(moved.files, moved.changedFileIds);

    expect(movedFile.workbenchPath).toBe('文件資料/專案計畫/紀錄.md');
    expect(syncItems).toEqual([
      {
        fileId: movedFile.id,
        sourceId: 'source-1',
        knowledgeBaseId: 'kb-1',
        canonicalPath: '文件資料/專案計畫/紀錄.md',
      },
    ]);
  });

  it('deletes a folder subtree together with descendant files', () => {
    const files = [
      createFile('文件資料/紀錄.md'),
      createFile('文件資料/AgentSkills/spec-a/step-a.md'),
    ];
    const tree = buildInitialWorkbenchTree(files);
    const folderNodeId = Object.values(tree.nodes).find(node => node.kind === 'folder' && node.name === 'AgentSkills')?.id;

    if (!folderNodeId) {
      throw new Error('Folder node not found');
    }

    const deleted = deleteWorkbenchNode({ tree, files, nodeId: folderNodeId });

    expect(deleted.files.map(file => file.workbenchPath)).toEqual(['文件資料/紀錄.md']);
    expect(deleted.removedPaths).toEqual(['文件資料/AgentSkills/spec-a/step-a.md']);
  });
});