/**
 * @file MultiFileEditor.tsx
 * @description Vibe 多文件项目编辑器 — 支持多文件 Tab 切换和文件树
 */

import { useState, useCallback } from 'react';
import {
  File, FolderOpen, Plus, X, ChevronRight, ChevronDown,
  FileCode, FileText, FileJson, Trash2, Edit3, Check,
} from 'lucide-react';
import type { ProjectFile, VibeProject } from './types';

// ─── 文件图标映射 ─────────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, { icon: typeof File; color: string }> = {
  html:       { icon: FileCode, color: 'text-orange-500' },
  css:        { icon: FileCode, color: 'text-sky-500' },
  javascript: { icon: FileCode, color: 'text-yellow-500' },
  typescript: { icon: FileCode, color: 'text-blue-500' },
  tsx:        { icon: FileCode, color: 'text-blue-400' },
  jsx:        { icon: FileCode, color: 'text-yellow-400' },
  json:       { icon: FileJson, color: 'text-green-500' },
  markdown:   { icon: FileText, color: 'text-slate-500' },
};

const getFileIcon = (language: string) => FILE_ICONS[language] || { icon: File, color: 'text-slate-400' };

// ─── 文件树节点 ──────────────────────────────────────────────────────────────

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  file?: ProjectFile;
}

/** 将扁平文件列表构建为树结构 */
const buildFileTree = (files: ProjectFile[]): FileTreeNode[] => {
  const root: FileTreeNode = { name: '', path: '', isDir: true, children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (isLast) {
        current.children.push({
          name: part,
          path: currentPath,
          isDir: false,
          children: [],
          file,
        });
      } else {
        let dir = current.children.find(c => c.isDir && c.name === part);
        if (!dir) {
          dir = { name: part, path: currentPath, isDir: true, children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // 排序：目录在前，文件在后
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(n => ({ ...n, children: sortNodes(n.children) }));
  };

  return sortNodes(root.children);
};

// ─── 文件树组件 ──────────────────────────────────────────────────────────────

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}

const FileTreeItem = ({ node, depth, activeFile, onSelect, onDelete, expandedDirs, onToggleDir }: FileTreeItemProps) => {
  const isExpanded = expandedDirs.has(node.path);
  const isActive = activeFile === node.path;

  if (node.isDir) {
    return (
      <div>
        <button
          className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-slate-100 rounded transition-colors`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onToggleDir(node.path)}
          tabIndex={0}
          aria-label={node.name}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
          <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-slate-600 font-medium">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => (
          <FileTreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            onSelect={onSelect}
            onDelete={onDelete}
            expandedDirs={expandedDirs}
            onToggleDir={onToggleDir}
          />
        ))}
      </div>
    );
  }

  const { icon: Icon, color } = getFileIcon(node.file?.language || '');

  return (
    <div className="group flex items-center">
      <button
        className={`flex-1 flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
          isActive ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-100 text-slate-600'
        }`}
        style={{ paddingLeft: `${depth * 12 + 20}px` }}
        onClick={() => onSelect(node.path)}
        tabIndex={0}
        aria-label={node.name}
      >
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={isActive ? 'font-medium' : ''}>{node.name}</span>
        {node.file?.isEntry && (
          <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded">入口</span>
        )}
      </button>
      <button
        className="hidden group-hover:flex p-0.5 text-slate-300 hover:text-red-400 transition-colors mr-1"
        onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
        tabIndex={0}
        aria-label="删除文件"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

// ─── 多文件编辑器主组件 ──────────────────────────────────────────────────────

interface MultiFileEditorProps {
  project: VibeProject;
  onUpdateFile: (path: string, content: string) => void;
  onAddFile: (file: ProjectFile) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
}

const MultiFileEditor = ({ project, onUpdateFile, onAddFile, onDeleteFile, onRenameFile }: MultiFileEditorProps) => {
  const [activeFile, setActiveFile] = useState<string>(project.entryFile || project.files[0]?.path || '');
  const [openTabs, setOpenTabs] = useState<string[]>([project.entryFile || project.files[0]?.path || '']);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['src', 'src/components']));
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const fileTree = buildFileTree(project.files);
  const currentFile = project.files.find(f => f.path === activeFile);

  const handleSelectFile = useCallback((path: string) => {
    setActiveFile(path);
    if (!openTabs.includes(path)) {
      setOpenTabs(prev => [...prev, path]);
    }
  }, [openTabs]);

  const handleCloseTab = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(p => p !== path);
      if (activeFile === path && next.length > 0) {
        setActiveFile(next[next.length - 1]);
      }
      return next;
    });
  }, [activeFile]);

  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleAddFile = () => {
    if (!newFileName.trim()) return;
    const path = newFileName.trim();
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, ProjectFile['language']> = {
      html: 'html', css: 'css', js: 'javascript', ts: 'typescript',
      tsx: 'tsx', jsx: 'jsx', json: 'json', md: 'markdown',
    };
    onAddFile({
      path,
      content: '',
      language: langMap[ext] || 'typescript',
    });
    setNewFileName('');
    setShowNewFile(false);
    handleSelectFile(path);
  };

  return (
    <div className="flex h-full border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* 文件树侧边栏 */}
      <div className="w-56 border-r border-slate-200 flex flex-col flex-shrink-0 bg-slate-50">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">文件</span>
          <button
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            onClick={() => setShowNewFile(true)}
            tabIndex={0}
            aria-label="新建文件"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 新建文件输入 */}
        {showNewFile && (
          <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 bg-white">
            <input
              className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400"
              placeholder="src/NewFile.tsx"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFile();
                if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); }
              }}
              autoFocus
            />
            <button className="p-0.5 text-emerald-500 hover:text-emerald-700" onClick={handleAddFile} tabIndex={0} aria-label="确认">
              <Check className="w-3 h-3" />
            </button>
            <button className="p-0.5 text-slate-400 hover:text-slate-600" onClick={() => { setShowNewFile(false); setNewFileName(''); }} tabIndex={0} aria-label="取消">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 文件树 */}
        <div className="flex-1 overflow-y-auto py-1">
          {fileTree.map(node => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              onSelect={handleSelectFile}
              onDelete={onDeleteFile}
              expandedDirs={expandedDirs}
              onToggleDir={handleToggleDir}
            />
          ))}
        </div>

        {/* 项目信息 */}
        <div className="px-3 py-2 border-t border-slate-200 text-[10px] text-slate-400">
          {project.files.length} 个文件 · {project.projectType}
        </div>
      </div>

      {/* 编辑区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab 栏 */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 overflow-x-auto flex-shrink-0">
          {openTabs.map(tabPath => {
            const file = project.files.find(f => f.path === tabPath);
            const fileName = tabPath.split('/').pop() || tabPath;
            const { icon: Icon, color } = getFileIcon(file?.language || '');
            const isActive = activeFile === tabPath;

            return (
              <div
                key={tabPath}
                className={`group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-slate-200 flex-shrink-0 transition-colors ${
                  isActive ? 'bg-white text-slate-800 border-b-2 border-b-sky-500' : 'text-slate-500 hover:bg-slate-100'
                }`}
                onClick={() => setActiveFile(tabPath)}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
              >
                <Icon className={`w-3 h-3 ${color}`} />
                <span className={isActive ? 'font-medium' : ''}>{fileName}</span>
                <button
                  className="hidden group-hover:flex p-0.5 text-slate-300 hover:text-slate-600 rounded transition-colors"
                  onClick={(e) => handleCloseTab(tabPath, e)}
                  tabIndex={0}
                  aria-label="关闭标签"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 代码编辑区 */}
        <div className="flex-1 overflow-hidden">
          {currentFile ? (
            <textarea
              className="w-full h-full p-4 font-mono text-xs text-slate-700 bg-white resize-none outline-none leading-relaxed"
              value={currentFile.content}
              onChange={(e) => onUpdateFile(activeFile, e.target.value)}
              spellCheck={false}
              aria-label={`编辑 ${activeFile}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              选择一个文件开始编辑
            </div>
          )}
        </div>

        {/* 状态栏 */}
        {currentFile && (
          <div className="flex items-center justify-between px-3 py-1 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-400">
            <span>{currentFile.path}</span>
            <div className="flex items-center gap-3">
              <span>{currentFile.language}</span>
              <span>{currentFile.content.split('\n').length} 行</span>
              <span>{currentFile.content.length} 字符</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiFileEditor;
