import { useStore } from '@nanostores/react';
import { memo, useMemo, useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as Tabs from '@radix-ui/react-tabs';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from '~/lib/stores/files';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE, TerminalTabs } from './terminal/TerminalTabs';
import { workbenchStore } from '~/lib/stores/workbench';
import { Search } from './Search';
import { classNames } from '~/utils/classNames';
import { LockManager } from './LockManager';
import { ChatPanel } from './ChatPanel';
import { MarkdownRenderer } from './MarkdownRenderer';

interface EditorPanelProps {
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    fileHistory,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);
    const files = useStore(workbenchStore.files);
    const [showChat, setShowChat] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      if (!editorDocument || !unsavedFiles) {
        return false;
      }

      // Make sure unsavedFiles is a Set before calling has()
      return unsavedFiles instanceof Set && unsavedFiles.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    // Multi-tab functionality
    const [openTabs, setOpenTabs] = useState<string[]>(selectedFile ? [selectedFile] : []);
    const [activeTab, setActiveTab] = useState<string | undefined>(selectedFile);

    // Check if active file is a markdown file
    const isMarkdownFile = useMemo(() => {
      return activeTab?.toLowerCase().endsWith('.md') || activeTab?.toLowerCase().endsWith('.markdown');
    }, [activeTab]);

    // Handle file selection to open in a new tab
    const handleFileSelectWithTab = (filePath: string | undefined) => {
      if (filePath) {
        // Add file to tabs if not already open
        if (!openTabs.includes(filePath)) {
          setOpenTabs((prev) => [...prev, filePath]);
        }

        setActiveTab(filePath);
        onFileSelect?.(filePath);
      }
    };

    // Close a tab
    const closeTab = (filePath: string) => {
      const newTabs = openTabs.filter((tab) => tab !== filePath);
      setOpenTabs(newTabs);

      if (activeTab === filePath) {
        // If closing active tab, switch to another tab or clear selection
        if (newTabs.length > 0) {
          setActiveTab(newTabs[newTabs.length - 1]);
          onFileSelect?.(newTabs[newTabs.length - 1]);
        } else {
          setActiveTab(undefined);
          onFileSelect?.(undefined);
        }
      }
    };

    // Update open tabs when a new file is selected
    useEffect(() => {
      if (selectedFile && !openTabs.includes(selectedFile)) {
        setOpenTabs((prev) => [...prev, selectedFile]);
        setActiveTab(selectedFile);
      }
    }, [selectedFile, openTabs]);

    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15} collapsible className="border-r border-mindvex-elements-borderColor">
              <div className="h-full">
                <Tabs.Root defaultValue="files" className="flex flex-col h-full">
                  <PanelHeader className="w-full text-sm font-medium text-mindvex-elements-textSecondary px-1">
                    <div className="h-full flex-shrink-0 flex items-center justify-between w-full">
                      <Tabs.List className="h-full flex-shrink-0 flex items-center">
                        <Tabs.Trigger
                          value="files"
                          className={classNames(
                            'h-full bg-transparent hover:bg-mindvex-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-mindvex-elements-textTertiary hover:text-mindvex-elements-textPrimary data-[state=active]:text-mindvex-elements-textPrimary',
                          )}
                        >
                          Files
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="search"
                          className={classNames(
                            'h-full bg-transparent hover:bg-mindvex-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-mindvex-elements-textTertiary hover:text-mindvex-elements-textPrimary data-[state=active]:text-mindvex-elements-textPrimary',
                          )}
                        >
                          Search
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="locks"
                          className={classNames(
                            'h-full bg-transparent hover:bg-mindvex-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-mindvex-elements-textTertiary hover:text-mindvex-elements-textPrimary data-[state=active]:text-mindvex-elements-textPrimary',
                          )}
                        >
                          Locks
                        </Tabs.Trigger>
                      </Tabs.List>
                    </div>
                  </PanelHeader>

                  <Tabs.Content value="files" className="flex-grow overflow-auto focus-visible:outline-none">
                    <FileTree
                      className="h-full"
                      files={files}
                      hideRoot
                      collapsed={true}
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      rootFolder={WORK_DIR}
                      selectedFile={selectedFile}
                      onFileSelect={handleFileSelectWithTab}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="search" className="flex-grow overflow-auto focus-visible:outline-none">
                    <Search />
                  </Tabs.Content>

                  <Tabs.Content value="locks" className="flex-grow overflow-auto focus-visible:outline-none">
                    <LockManager />
                  </Tabs.Content>
                </Tabs.Root>
              </div>
            </Panel>

            <PanelResizeHandle />
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              {/* Tab bar */}
              <div className="flex overflow-x-auto bg-mindvex-elements-background-depth-2 border-b border-mindvex-elements-borderColor">
                {openTabs.map((filePath) => {
                  const fileName = filePath.split('/').pop() || filePath;
                  const isUnsaved = unsavedFiles?.has(filePath);

                  return (
                    <div
                      key={filePath}
                      className={`flex items-center px-3 py-2 text-sm border-r border-mindvex-elements-borderColor cursor-pointer ${
                        activeTab === filePath
                          ? 'bg-mindvex-elements-background-depth-1 text-mindvex-elements-textPrimary'
                          : 'bg-mindvex-elements-background-depth-2 text-mindvex-elements-textSecondary hover:bg-mindvex-elements-background-depth-3'
                      }`}
                      onClick={() => {
                        setActiveTab(filePath);
                        onFileSelect?.(filePath);
                      }}
                    >
                      <span className="truncate max-w-xs">{fileName}</span>
                      {isUnsaved && <span className="ml-1 text-orange-500">●</span>}
                      <button
                        className="ml-2 text-mindvex-elements-textTertiary hover:text-mindvex-elements-textPrimary"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(filePath);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="h-full flex flex-col overflow-hidden">
                {activeTab ? (
                  <>
                    {/* Markdown Preview Mode Switcher */}
                    {isMarkdownFile && (
                      <div className="flex items-center border-b border-mindvex-elements-borderColor bg-mindvex-elements-background-depth-2">
                        <button
                          onClick={() => setPreviewMode(false)}
                          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            !previewMode
                              ? 'bg-mindvex-elements-background-depth-1 text-mindvex-elements-textPrimary border-b-2 border-orange-500'
                              : 'text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary hover:bg-mindvex-elements-background-depth-3'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <div className="i-ph:code" />
                            Code
                          </div>
                        </button>
                        <button
                          onClick={() => setPreviewMode(true)}
                          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            previewMode
                              ? 'bg-mindvex-elements-background-depth-1 text-mindvex-elements-textPrimary border-b-2 border-orange-500'
                              : 'text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary hover:bg-mindvex-elements-background-depth-3'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <div className="i-ph:eye" />
                            Preview
                          </div>
                        </button>
                      </div>
                    )}
                    {/* Editor Controls */}
                    <div className="flex items-center justify-between p-2 bg-mindvex-elements-background-depth-2 border-b border-mindvex-elements-borderColor">
                      <div className="text-sm text-mindvex-elements-textSecondary truncate max-w-xs">
                        {activeTab}
                        {activeFileUnsaved && <span className="ml-2 text-orange-500">● Unsaved</span>}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={onFileSave}
                          disabled={!activeFileUnsaved}
                          className={`px-3 py-1.5 text-xs rounded-md ${activeFileUnsaved ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'} transition-colors`}
                        >
                          <div className="flex items-center gap-1">
                            <div className="i-ph:floppy-disk" />
                            Save
                          </div>
                        </button>
                        <button
                          onClick={onFileReset}
                          className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <div className="i-ph:clock-counter-clockwise" />
                            Restore
                          </div>
                        </button>
                        <button
                          onClick={() => setShowChat((prev) => !prev)}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                            showChat
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-mindvex-elements-background-depth-3 text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary'
                          }`}
                          title="Toggle AI Chat"
                        >
                          <div className="flex items-center gap-1">
                            <div className="i-ph:chat-circle-dots" />
                            Chat
                          </div>
                        </button>
                      </div>
                    </div>
                    <PanelGroup direction="horizontal">
                      <Panel className="h-full overflow-hidden modern-scrollbar" minSize={30}>
                        {isMarkdownFile && previewMode ? (
                          <MarkdownRenderer content={editorDocument?.value || ''} />
                        ) : (
                          <CodeMirrorEditor
                            theme={theme}
                            editable={!isStreaming}
                            settings={editorSettings}
                            doc={editorDocument}
                            autoFocusOnDocumentChange={!isMobile()}
                            onScroll={onEditorScroll}
                            onChange={onEditorChange}
                            onSave={onFileSave}
                          />
                        )}
                      </Panel>
                      {showChat && (
                        <>
                          <PanelResizeHandle className="w-1 hover:bg-orange-500/30 transition-colors" />
                          <Panel defaultSize={30} minSize={20} maxSize={50}>
                            <ChatPanel />
                          </Panel>
                        </>
                      )}
                    </PanelGroup>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-mindvex-elements-textSecondary">
                    Select a file to edit
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <TerminalTabs />
      </PanelGroup>
    );
  },
);
