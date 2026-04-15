import { describe, expect, it } from 'vitest';
import { orderFilesByTree } from './fileOrdering';

type TestFile = {
  name: string;
  path: string;
};

describe('orderFilesByTree', () => {
  it('matches the sidebar tree order for nested folders and files', () => {
    const files: TestFile[] = [
      { name: '紀錄.md', path: '文件資料/紀錄.md' },
      { name: 'step-a.md', path: '文件資料/AgentSkills/spec-a/step-a.md' },
      { name: 'plan-2.md', path: '文件資料/專案計畫/2-1/plan-2.md' },
      { name: 'plan-1.md', path: '文件資料/專案計畫/1-1/plan-1.md' },
      { name: 'skill.md', path: '文件資料/AgentSkills/skill.md' },
    ];

    expect(orderFilesByTree(files).map(file => file.path)).toEqual([
      '文件資料/專案計畫/1-1/plan-1.md',
      '文件資料/專案計畫/2-1/plan-2.md',
      '文件資料/AgentSkills/spec-a/step-a.md',
      '文件資料/AgentSkills/skill.md',
      '文件資料/紀錄.md',
    ]);
  });

  it('keeps files after folders within the same level', () => {
    const files: TestFile[] = [
      { name: 'zeta.md', path: 'root/zeta.md' },
      { name: 'alpha.md', path: 'root/folder/alpha.md' },
      { name: 'beta.md', path: 'root/beta.md' },
    ];

    expect(orderFilesByTree(files).map(file => file.path)).toEqual([
      'root/folder/alpha.md',
      'root/beta.md',
      'root/zeta.md',
    ]);
  });

  it('prioritizes document and data files before images within the same level', () => {
    const files: TestFile[] = [
      { name: 'diagram.png', path: 'root/diagram.png' },
      { name: 'context.json', path: 'root/context.json' },
      { name: 'notes.md', path: 'root/notes.md' },
      { name: 'photo.jpeg', path: 'root/photo.jpeg' },
    ];

    expect(orderFilesByTree(files).map(file => file.path)).toEqual([
      'root/context.json',
      'root/notes.md',
      'root/diagram.png',
      'root/photo.jpeg',
    ]);
  });
});