import { compareWorkbenchFileNames } from './filePriority';

export type FilePathLike = {
  name: string;
  path?: string;
};

export type FileOrderingNode<TFile extends FilePathLike = FilePathLike> = {
  name: string;
  path: string;
  isFile: boolean;
  file?: TFile;
  children?: Record<string, FileOrderingNode<TFile>>;
};

function compareNodeNames(left: string, right: string) {
  return compareWorkbenchFileNames(left, right);
}

export function compareFileOrderingNodes<TFile extends FilePathLike>(
  left: FileOrderingNode<TFile>,
  right: FileOrderingNode<TFile>,
) {
  if (left.isFile !== right.isFile) {
    return left.isFile ? 1 : -1;
  }

  return compareNodeNames(left.name, right.name);
}

export function sortFileOrderingChildren<TFile extends FilePathLike>(
  children?: Record<string, FileOrderingNode<TFile>>,
) {
  return Object.values(children ?? {}).sort(compareFileOrderingNodes);
}

export function buildFileOrderingTree<TFile extends FilePathLike>(files: TFile[]): FileOrderingNode<TFile> {
  const root: FileOrderingNode<TFile> = {
    name: 'root',
    path: '',
    isFile: false,
    children: {},
  };

  files.forEach(file => {
    const pathParts = (file.path || file.name).split('/').filter(Boolean);
    let currentNode = root;

    for (let index = 0; index < pathParts.length; index += 1) {
      const part = pathParts[index];
      const isFile = index === pathParts.length - 1;

      if (!currentNode.children) {
        currentNode.children = {};
      }

      if (!currentNode.children[part]) {
        currentNode.children[part] = {
          name: part,
          path: pathParts.slice(0, index + 1).join('/'),
          isFile,
          file: isFile ? file : undefined,
          children: isFile ? undefined : {},
        };
      }

      currentNode = currentNode.children[part];
    }
  });

  return root;
}

export function orderFilesByTree<TFile extends FilePathLike>(files: TFile[]) {
  const orderedFiles: TFile[] = [];
  const root = buildFileOrderingTree(files);

  const visit = (node: FileOrderingNode<TFile>) => {
    if (node.isFile) {
      if (node.file) {
        orderedFiles.push(node.file);
      }
      return;
    }

    sortFileOrderingChildren(node.children).forEach(visit);
  };

  visit(root);

  return orderedFiles;
}