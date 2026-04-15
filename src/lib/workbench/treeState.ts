import type { ExtendedFile } from '@/components/ui/DropZone';
import type {
  WorkbenchDropPosition,
  WorkbenchFileNode,
  WorkbenchFileRecord,
  WorkbenchFolderNode,
  WorkbenchRenderNode,
  WorkbenchTreeNode,
  WorkbenchTreeState,
} from './types';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function compareNodeNames(left: string, right: string) {
  return left.localeCompare(right);
}

function compareNodes(left: WorkbenchTreeNode, right: WorkbenchTreeNode) {
  if (left.kind !== right.kind) {
    return left.kind === 'folder' ? -1 : 1;
  }

  return compareNodeNames(left.name, right.name);
}

function cloneTreeState(tree: WorkbenchTreeState): WorkbenchTreeState {
  const nextNodes: Record<string, WorkbenchTreeNode> = {};

  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    nextNodes[nodeId] = node.kind === 'folder'
      ? { ...node, childIds: [...node.childIds] }
      : { ...node };
  }

  return {
    rootNodeIds: [...tree.rootNodeIds],
    nodes: nextNodes,
  };
}

function getSiblingIds(tree: WorkbenchTreeState, parentId: string | null) {
  if (!parentId) {
    return tree.rootNodeIds;
  }

  const parentNode = tree.nodes[parentId];
  if (!parentNode || parentNode.kind !== 'folder') {
    throw new Error('Parent folder not found.');
  }

  return parentNode.childIds;
}

function setSiblingIds(tree: WorkbenchTreeState, parentId: string | null, nextSiblingIds: string[]) {
  if (!parentId) {
    tree.rootNodeIds = nextSiblingIds;
    return;
  }

  const parentNode = tree.nodes[parentId];
  if (!parentNode || parentNode.kind !== 'folder') {
    throw new Error('Parent folder not found.');
  }

  tree.nodes[parentId] = {
    ...parentNode,
    childIds: nextSiblingIds,
  };
}

function createFolderNode(name: string, parentId: string | null): WorkbenchFolderNode {
  return {
    id: createId('folder'),
    kind: 'folder',
    name,
    parentId,
    childIds: [],
  };
}

function createFileNode(fileId: string, name: string, parentId: string | null): WorkbenchFileNode {
  return {
    id: createId('file-node'),
    kind: 'file',
    name,
    parentId,
    fileId,
  };
}

function insertNodeByDefaultOrder(tree: WorkbenchTreeState, parentId: string | null, node: WorkbenchTreeNode) {
  const siblingIds = [...getSiblingIds(tree, parentId)];
  const insertIndex = siblingIds.findIndex(siblingId => compareNodes(node, tree.nodes[siblingId]) < 0);

  if (insertIndex === -1) {
    siblingIds.push(node.id);
  } else {
    siblingIds.splice(insertIndex, 0, node.id);
  }

  setSiblingIds(tree, parentId, siblingIds);
}

function getPathParts(path: string) {
  return path.split('/').filter(Boolean);
}

function getParentPath(path: string) {
  const parts = getPathParts(path);
  return parts.slice(0, -1).join('/');
}

function getNodePath(tree: WorkbenchTreeState, nodeId: string): string {
  const segments: string[] = [];
  let currentNode: WorkbenchTreeNode | undefined = tree.nodes[nodeId];

  while (currentNode) {
    segments.unshift(currentNode.name);
    currentNode = currentNode.parentId ? tree.nodes[currentNode.parentId] : undefined;
  }

  return segments.join('/');
}

function updateDescendantFilePaths(tree: WorkbenchTreeState, files: WorkbenchFileRecord[], nodeId: string) {
  const fileIndexMap = new Map(files.map((file, index) => [file.id, index]));
  const changedFileIds: string[] = [];

  const visit = (currentNodeId: string) => {
    const currentNode = tree.nodes[currentNodeId];
    if (!currentNode) {
      return;
    }

    if (currentNode.kind === 'file') {
      const fileIndex = fileIndexMap.get(currentNode.fileId);
      if (fileIndex === undefined) {
        return;
      }

      const nextPath = getNodePath(tree, currentNode.id);
      const currentFile = files[fileIndex];

      if (currentFile.workbenchPath === nextPath) {
        return;
      }

      currentFile.workbenchPath = nextPath;
      currentFile.file.path = nextPath;
      changedFileIds.push(currentFile.id);
      return;
    }

    currentNode.childIds.forEach(visit);
  };

  visit(nodeId);

  return changedFileIds;
}

function collectFileIds(tree: WorkbenchTreeState, nodeId: string): string[] {
  const node = tree.nodes[nodeId];
  if (!node) {
    return [];
  }

  if (node.kind === 'file') {
    return [node.fileId];
  }

  return node.childIds.flatMap(childId => collectFileIds(tree, childId));
}

function collectNodeIds(tree: WorkbenchTreeState, nodeId: string): string[] {
  const node = tree.nodes[nodeId];
  if (!node) {
    return [];
  }

  if (node.kind === 'file') {
    return [nodeId];
  }

  return [nodeId, ...node.childIds.flatMap(childId => collectNodeIds(tree, childId))];
}

function isDescendantNode(tree: WorkbenchTreeState, ancestorNodeId: string, targetNodeId: string | null) {
  if (!targetNodeId) {
    return false;
  }

  let currentNode = tree.nodes[targetNodeId];
  while (currentNode?.parentId) {
    if (currentNode.parentId === ancestorNodeId) {
      return true;
    }
    currentNode = tree.nodes[currentNode.parentId];
  }

  return false;
}

function hasSiblingNameConflict(tree: WorkbenchTreeState, parentId: string | null, sourceNodeId: string, name: string) {
  return getSiblingIds(tree, parentId).some(siblingId => siblingId !== sourceNodeId && tree.nodes[siblingId]?.name === name);
}

export function createWorkbenchFileRecord(file: ExtendedFile): WorkbenchFileRecord {
  const initialPath = file.path || file.name;
  file.path = initialPath;

  return {
    id: createId('file'),
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    originalPath: initialPath,
    workbenchPath: initialPath,
    sourceSyncStatus: 'unsynced',
  };
}

export function createEmptyWorkbenchTreeState(): WorkbenchTreeState {
  return {
    rootNodeIds: [],
    nodes: {},
  };
}

export function insertWorkbenchFile(tree: WorkbenchTreeState, file: WorkbenchFileRecord): WorkbenchTreeState {
  const nextTree = cloneTreeState(tree);
  const pathParts = getPathParts(file.workbenchPath);

  if (pathParts.length === 0) {
    return nextTree;
  }

  let parentId: string | null = null;

  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const folderName = pathParts[index];
    const existingFolderId: string | undefined = getSiblingIds(nextTree, parentId).find(siblingId => {
      const siblingNode = nextTree.nodes[siblingId];
      return siblingNode?.kind === 'folder' && siblingNode.name === folderName;
    });

    if (existingFolderId) {
      parentId = existingFolderId;
      continue;
    }

    const folderNode = createFolderNode(folderName, parentId);
    nextTree.nodes[folderNode.id] = folderNode;
    insertNodeByDefaultOrder(nextTree, parentId, folderNode);
    parentId = folderNode.id;
  }

  const fileNode = createFileNode(file.id, pathParts[pathParts.length - 1], parentId);
  nextTree.nodes[fileNode.id] = fileNode;
  insertNodeByDefaultOrder(nextTree, parentId, fileNode);

  return nextTree;
}

export function buildInitialWorkbenchTree(files: WorkbenchFileRecord[]) {
  return files.reduce((tree, file) => insertWorkbenchFile(tree, file), createEmptyWorkbenchTreeState());
}

export function getOrderedFileIds(tree: WorkbenchTreeState) {
  const orderedFileIds: string[] = [];

  const visit = (nodeId: string) => {
    const node = tree.nodes[nodeId];
    if (!node) {
      return;
    }

    if (node.kind === 'file') {
      orderedFileIds.push(node.fileId);
      return;
    }

    node.childIds.forEach(visit);
  };

  tree.rootNodeIds.forEach(visit);
  return orderedFileIds;
}

export function buildWorkbenchRenderTree(tree: WorkbenchTreeState): WorkbenchRenderNode[] {
  const visit = (nodeId: string): WorkbenchRenderNode | null => {
    const node = tree.nodes[nodeId];
    if (!node) {
      return null;
    }

    if (node.kind === 'file') {
      return {
        id: node.id,
        name: node.name,
        kind: 'file',
        path: getNodePath(tree, node.id),
        fileId: node.fileId,
      };
    }

    return {
      id: node.id,
      name: node.name,
      kind: 'folder',
      path: getNodePath(tree, node.id),
      children: node.childIds
        .map(visit)
        .filter((child): child is WorkbenchRenderNode => child !== null),
    };
  };

  return tree.rootNodeIds
    .map(visit)
    .filter((node): node is WorkbenchRenderNode => node !== null);
}

export function findFileByPath(files: WorkbenchFileRecord[], workbenchPath: string) {
  return files.find(file => file.workbenchPath === workbenchPath) ?? null;
}

export function findFileNodeId(tree: WorkbenchTreeState, fileId: string) {
  const match = Object.values(tree.nodes).find(node => node.kind === 'file' && node.fileId === fileId);
  return match?.id ?? null;
}

export function moveWorkbenchNode(input: {
  tree: WorkbenchTreeState;
  files: WorkbenchFileRecord[];
  sourceNodeId: string;
  targetNodeId: string | null;
  position: WorkbenchDropPosition;
}) {
  const nextTree = cloneTreeState(input.tree);
  const nextFiles = input.files.map(file => ({ ...file, file: Object.assign(file.file, { path: file.workbenchPath }) }));
  const sourceNode = nextTree.nodes[input.sourceNodeId];

  if (!sourceNode) {
    throw new Error('Dragged node not found.');
  }

  if (input.targetNodeId === input.sourceNodeId) {
    return { tree: nextTree, files: nextFiles, changedFileIds: [] };
  }

  let newParentId: string | null;
  let insertIndex: number;

  if (input.targetNodeId === null) {
    newParentId = null;
    insertIndex = nextTree.rootNodeIds.length;
  } else {
    const targetNode = nextTree.nodes[input.targetNodeId];
    if (!targetNode) {
      throw new Error('Drop target not found.');
    }

    if (input.position === 'inside') {
      if (targetNode.kind !== 'folder') {
        throw new Error('Files cannot contain child nodes.');
      }

      if (sourceNode.kind === 'folder' && isDescendantNode(nextTree, sourceNode.id, targetNode.id)) {
        throw new Error('Cannot move a folder into its own descendant.');
      }

      newParentId = targetNode.id;
      insertIndex = targetNode.childIds.length;
    } else {
      newParentId = targetNode.parentId;
      const targetSiblingIds = getSiblingIds(nextTree, newParentId);
      const targetIndex = targetSiblingIds.indexOf(targetNode.id);
      insertIndex = targetIndex + (input.position === 'after' ? 1 : 0);
    }
  }

  if (sourceNode.kind === 'folder' && isDescendantNode(nextTree, sourceNode.id, newParentId)) {
    throw new Error('Cannot move a folder into its own descendant.');
  }

  if (hasSiblingNameConflict(nextTree, newParentId, sourceNode.id, sourceNode.name)) {
    throw new Error(`A node named "${sourceNode.name}" already exists in the target folder.`);
  }

  const oldParentId = sourceNode.parentId;
  const oldSiblingIds = [...getSiblingIds(nextTree, oldParentId)];
  const oldIndex = oldSiblingIds.indexOf(sourceNode.id);

  if (oldIndex === -1) {
    throw new Error('Dragged node position is invalid.');
  }

  oldSiblingIds.splice(oldIndex, 1);
  setSiblingIds(nextTree, oldParentId, oldSiblingIds);

  const adjustedInsertIndex = oldParentId === newParentId && oldIndex < insertIndex
    ? insertIndex - 1
    : insertIndex;
  const newSiblingIds = [...getSiblingIds(nextTree, newParentId)];
  newSiblingIds.splice(adjustedInsertIndex, 0, sourceNode.id);
  setSiblingIds(nextTree, newParentId, newSiblingIds);

  nextTree.nodes[sourceNode.id] = {
    ...sourceNode,
    parentId: newParentId,
  } as WorkbenchTreeNode;

  const changedFileIds = updateDescendantFilePaths(nextTree, nextFiles, sourceNode.id);

  return {
    tree: nextTree,
    files: nextFiles,
    changedFileIds,
  };
}

export function deleteWorkbenchNode(input: {
  tree: WorkbenchTreeState;
  files: WorkbenchFileRecord[];
  nodeId: string;
}) {
  const nextTree = cloneTreeState(input.tree);
  const node = nextTree.nodes[input.nodeId];

  if (!node) {
    return {
      tree: nextTree,
      files: [...input.files],
      removedFileIds: [] as string[],
      removedPaths: [] as string[],
    };
  }

  const parentId = node.parentId;
  const siblingIds = [...getSiblingIds(nextTree, parentId)].filter(siblingId => siblingId !== input.nodeId);
  setSiblingIds(nextTree, parentId, siblingIds);

  const removedFileIds = collectFileIds(nextTree, input.nodeId);
  const removedPaths = input.files
    .filter(file => removedFileIds.includes(file.id))
    .map(file => file.workbenchPath);
  const removedNodeIds = collectNodeIds(nextTree, input.nodeId);

  removedNodeIds.forEach(nodeId => {
    delete nextTree.nodes[nodeId];
  });

  return {
    tree: nextTree,
    files: input.files.filter(file => !removedFileIds.includes(file.id)),
    removedFileIds,
    removedPaths,
  };
}

export function collectPathSyncItems(files: WorkbenchFileRecord[], fileIds: string[]) {
  return files.flatMap(file => {
    if (!fileIds.includes(file.id)) {
      return [];
    }

    if (!file.sourceId || !file.knowledgeBaseId) {
      return [];
    }

    if (file.workbenchPath === file.syncedCanonicalPath) {
      return [];
    }

    return [{
      fileId: file.id,
      sourceId: file.sourceId,
      knowledgeBaseId: file.knowledgeBaseId,
      canonicalPath: file.workbenchPath,
    }];
  });
}

export function getDisplayPathForFile(file: WorkbenchFileRecord) {
  return file.workbenchPath;
}

export function getFileNameFromPath(path: string) {
  const parts = getPathParts(path);
  return parts[parts.length - 1] ?? path;
}

export function getParentFolderPath(path: string) {
  return getParentPath(path);
}