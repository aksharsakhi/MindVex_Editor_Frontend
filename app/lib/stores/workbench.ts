import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import { path } from '~/utils/path';
import { extractRelativePath } from '~/utils/diff';
import { description } from '~/lib/persistence';
import Cookies from 'js-cookie';
import { createSampler } from '~/utils/sampler';
import type { ActionAlert, DeployAlert, SupabaseAlert } from '~/types/actions';
import { WORK_DIR } from '~/utils/constants';

const { saveAs } = fileSaver;

export interface ArtifactState {
  id: string;
  title: string;
  type?: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'diff' | 'preview' | 'dashboard' | 'quick-actions';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  #workspaceLoaded = false;
  #reloadedMessages = new Set<string>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.actionAlert ?? atom<ActionAlert | undefined>(undefined);
  supabaseAlert: WritableAtom<SupabaseAlert | undefined> =
    import.meta.hot?.data.supabaseAlert ?? atom<SupabaseAlert | undefined>(undefined);
  deployAlert: WritableAtom<DeployAlert | undefined> =
    import.meta.hot?.data.deployAlert ?? atom<DeployAlert | undefined>(undefined);
  showRightChat: WritableAtom<boolean> = import.meta.hot?.data.showRightChat ?? atom(false);
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];
  #globalExecutionQueue = Promise.resolve();
  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.supabaseAlert = this.supabaseAlert;
      import.meta.hot.data.deployAlert = this.deployAlert;

      // Ensure binary files are properly preserved across hot reloads
      const filesMap = this.files.get();

      for (const [path, dirent] of Object.entries(filesMap)) {
        if (dirent?.type === 'file' && dirent.isBinary && dirent.content) {
          // Make sure binary content is preserved
          this.files.setKey(path, { ...dirent });
        }
      }
    }
  }

  addToExecutionQueue(callback: () => Promise<void>) {
    this.#globalExecutionQueue = this.#globalExecutionQueue.then(() => callback());
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get mindvexTerminal() {
    return this.#terminalStore.mindvexTerminal;
  }
  get alert() {
    return this.actionAlert;
  }
  clearAlert() {
    this.actionAlert.set(undefined);
  }

  get SupabaseAlert() {
    return this.supabaseAlert;
  }

  clearSupabaseAlert() {
    this.supabaseAlert.set(undefined);
  }

  get DeployAlert() {
    return this.deployAlert;
  }

  clearDeployAlert() {
    this.deployAlert.set(undefined);
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachMindvexTerminal(terminal: ITerminal) {
    this.#terminalStore.attachMindvexTerminal(terminal);
  }

  detachTerminal(terminal: ITerminal) {
    this.#terminalStore.detachTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  toggleRightChat(value?: boolean) {
    this.showRightChat.set(value !== undefined ? value : !this.showRightChat.get());
  }

  setDocuments(files: FileMap, autoSelectFirstFile: boolean = false) {
    this.#editorStore.setDocuments(files);

    // Force a refresh of the file tree UI by updating the files store atom first
    this.#filesStore.files.set(files);

    if (autoSelectFirstFile && this.#filesStore.filesCount > 0) {
      // we find the first file and select it, regardless of current document state
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }

    // Save workspace state after document content is changed
    setTimeout(() => {
      this.saveWorkspaceState();
    }, 0);
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    /*
     * For scoped locks, we would need to implement diff checking here
     * to determine if the user is modifying existing code or just adding new code
     * This is a more complex feature that would be implemented in a future update
     */

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);

    // Save workspace state after file is saved
    setTimeout(() => {
      this.saveWorkspaceState();
    }, 0);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);

    // Save workspace state after current document is saved
    setTimeout(() => {
      this.saveWorkspaceState();
    }, 0);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }

    // Save workspace state after all files are saved
    setTimeout(() => {
      this.saveWorkspaceState();
    }, 0);
  }

  async createFileWithoutSelecting(filePath: string, content: string | Uint8Array = '') {
    try {
      console.log('Attempting to create file (no select):', filePath);

      const success = await this.#filesStore.createFile(filePath, content);

      if (success) {
        console.log('Successfully created file (no select):', filePath);

        // Update editor documents to reflect the newly created file
        const allFiles = this.files.get();

        // Force a refresh of the file tree UI by updating the files store atom
        this.#filesStore.files.set(allFiles);

        // Update editor documents after setting files atom
        this.setDocuments(allFiles, false);

        /*
         * For empty files, we need to ensure they're not marked as unsaved
         * Only check for empty string, not empty Uint8Array
         */
        if (typeof content === 'string' && content === '') {
          const newUnsavedFiles = new Set(this.unsavedFiles.get());
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }

        // Save workspace state after file is created
        setTimeout(() => {
          this.saveWorkspaceState();
        }, 0);
      }

      return success;
    } catch (error) {
      console.error('Failed to create file without selecting:', error);
      console.error('File path:', filePath);

      // Provide more specific error message for path validation issues
      if (error instanceof Error && error.message.includes('invalid file path')) {
        throw new Error(
          `File path validation failed: ${filePath}. Make sure the file path is within the project directory.`,
        );
      }

      throw error;
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  getModifiedFiles() {
    return this.#filesStore.getModifiedFiles();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  /**
   * Lock a file to prevent edits
   * @param filePath Path to the file to lock
   * @returns True if the file was successfully locked
   */
  lockFile(filePath: string) {
    return this.#filesStore.lockFile(filePath);
  }

  /**
   * Lock a folder and all its contents to prevent edits
   * @param folderPath Path to the folder to lock
   * @returns True if the folder was successfully locked
   */
  lockFolder(folderPath: string) {
    return this.#filesStore.lockFolder(folderPath);
  }

  /**
   * Unlock a file to allow edits
   * @param filePath Path to the file to unlock
   * @returns True if the file was successfully unlocked
   */
  unlockFile(filePath: string) {
    return this.#filesStore.unlockFile(filePath);
  }

  /**
   * Unlock a folder and all its contents to allow edits
   * @param folderPath Path to the folder to unlock
   * @returns True if the folder was successfully unlocked
   */
  unlockFolder(folderPath: string) {
    return this.#filesStore.unlockFolder(folderPath);
  }

  /**
   * Check if a file is locked
   * @param filePath Path to the file to check
   * @returns Object with locked status, lock mode, and what caused the lock
   */
  isFileLocked(filePath: string) {
    return this.#filesStore.isFileLocked(filePath);
  }

  /**
   * Check if a folder is locked
   * @param folderPath Path to the folder to check
   * @returns Object with locked status, lock mode, and what caused the lock
   */
  isFolderLocked(folderPath: string) {
    return this.#filesStore.isFolderLocked(folderPath);
  }

  async createFile(filePath: string, content: string | Uint8Array = '') {
    try {
      console.log('Attempting to create file:', filePath);

      const success = await this.#filesStore.createFile(filePath, content);

      if (success) {
        console.log('Successfully created file:', filePath);

        // Update editor documents to reflect the newly created file
        const allFiles = this.files.get();

        this.setSelectedFile(filePath);

        // Force a refresh of the file tree UI by updating the files store atom
        this.#filesStore.files.set(allFiles);

        // Update editor documents after setting files atom
        this.setDocuments(allFiles, false);

        /*
         * For empty files, we need to ensure they're not marked as unsaved
         * Only check for empty string, not empty Uint8Array
         */
        if (typeof content === 'string' && content === '') {
          const newUnsavedFiles = new Set(this.unsavedFiles.get());
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }

        // Save workspace state after file is created
        setTimeout(() => {
          this.saveWorkspaceState();
        }, 0);
      }

      return success;
    } catch (error) {
      console.error('Failed to create file:', error);
      console.error('File path:', filePath);

      // Provide more specific error message for path validation issues
      if (error instanceof Error && error.message.includes('invalid file path')) {
        throw new Error(
          `File path validation failed: ${filePath}. Make sure the file path is within the project directory.`,
        );
      }

      throw error;
    }
  }

  async createFolder(folderPath: string) {
    try {
      const success = await this.#filesStore.createFolder(folderPath);

      if (success) {
        // Update editor documents to reflect the newly created folder
        const allFiles = this.files.get();

        // Force a refresh of the file tree UI by updating the files store atom
        this.#filesStore.files.set(allFiles);

        // Update editor documents after setting files atom
        this.setDocuments(allFiles, false);

        // Save workspace state after folder is created
        setTimeout(() => {
          this.saveWorkspaceState();
        }, 0);
      }

      return success;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string) {
    try {
      const currentDocument = this.currentDocument.get();
      const isCurrentFile = currentDocument?.filePath === filePath;

      const success = await this.#filesStore.deleteFile(filePath);

      if (success) {
        const newUnsavedFiles = new Set(this.unsavedFiles.get());

        if (newUnsavedFiles.has(filePath)) {
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }

        if (isCurrentFile) {
          const files = this.files.get();
          let nextFile: string | undefined = undefined;

          for (const [path, dirent] of Object.entries(files)) {
            if (dirent?.type === 'file') {
              nextFile = path;
              break;
            }
          }

          this.setSelectedFile(nextFile);
        }

        // Update editor documents to reflect the deleted file
        const allFiles = this.files.get();

        // Force a refresh of the file tree UI by updating the files store atom
        this.#filesStore.files.set(allFiles);

        // Update editor documents after setting files atom
        this.setDocuments(allFiles, false);

        // Save workspace state after file is deleted
        setTimeout(() => {
          this.saveWorkspaceState();
        }, 0);
      }

      return success;
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string) {
    try {
      const currentDocument = this.currentDocument.get();
      const isInCurrentFolder = currentDocument?.filePath?.startsWith(folderPath + '/');

      const success = await this.#filesStore.deleteFolder(folderPath);

      if (success) {
        const unsavedFiles = this.unsavedFiles.get();
        const newUnsavedFiles = new Set<string>();

        for (const file of unsavedFiles) {
          if (!file.startsWith(folderPath + '/')) {
            newUnsavedFiles.add(file);
          }
        }

        if (newUnsavedFiles.size !== unsavedFiles.size) {
          this.unsavedFiles.set(newUnsavedFiles);
        }

        if (isInCurrentFolder) {
          const files = this.files.get();
          let nextFile: string | undefined = undefined;

          for (const [path, dirent] of Object.entries(files)) {
            if (dirent?.type === 'file') {
              nextFile = path;
              break;
            }
          }

          this.setSelectedFile(nextFile);
        }

        // Update editor documents to reflect the deleted folder
        const allFiles = this.files.get();

        // Force a refresh of the file tree UI by updating the files store atom
        this.#filesStore.files.set(allFiles);

        // Update editor documents after setting files atom
        this.setDocuments(allFiles, false);

        // Save workspace state after folder is deleted
        setTimeout(() => {
          this.saveWorkspaceState();
        }, 0);
      }

      return success;
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  setReloadedMessages(messages: string[]) {
    this.#reloadedMessages = new Set(messages);
  }

  addArtifact({ messageId, title, id, type }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(id);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(id)) {
      this.artifactIdList.push(id);
    }

    this.artifacts.setKey(id, {
      id,
      title,
      closed: false,
      type,
      runner: new ActionRunner(
        webcontainer,
        () => this.mindvexTerminal,
        (alert) => {
          if (this.#reloadedMessages.has(messageId)) {
            return;
          }

          this.actionAlert.set(alert);
        },
        (alert) => {
          if (this.#reloadedMessages.has(messageId)) {
            return;
          }

          this.supabaseAlert.set(alert);
        },
        (alert) => {
          if (this.#reloadedMessages.has(messageId)) {
            return;
          }

          this.deployAlert.set(alert);
        },
      ),
    });
  }

  updateArtifact({ artifactId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    if (!artifactId) {
      return;
    }

    const artifact = this.#getArtifact(artifactId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(artifactId, { ...artifact, ...state });
  }
  addAction(data: ActionCallbackData) {
    // this._addAction(data);

    this.addToExecutionQueue(() => this._addAction(data));
  }
  async _addAction(data: ActionCallbackData) {
    const { artifactId } = data;

    const artifact = this.#getArtifact(artifactId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    return artifact.runner.addAction(data);
  }

  runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    if (isStreaming) {
      this.actionStreamSampler(data, isStreaming);
    } else {
      this.addToExecutionQueue(() => this._runAction(data, isStreaming));
    }
  }
  async _runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { artifactId } = data;

    const artifact = this.#getArtifact(artifactId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    const action = artifact.runner.actions.get()[data.actionId];

    if (!action || action.executed) {
      return;
    }

    if (data.action.type === 'file') {
      const wc = await webcontainer;
      const fullPath = path.join(wc.workdir, data.action.filePath);

      /*
       * For scoped locks, we would need to implement diff checking here
       * to determine if the AI is modifying existing code or just adding new code
       * This is a more complex feature that would be implemented in a future update
       */

      if (this.selectedFile.value !== fullPath) {
        this.setSelectedFile(fullPath);
      }

      if (this.currentView.value !== 'code') {
        this.currentView.set('code');
      }

      const doc = this.#editorStore.documents.get()[fullPath];

      if (!doc) {
        await artifact.runner.runAction(data, isStreaming);
      }

      this.#editorStore.updateFile(fullPath, data.action.content);

      if (!isStreaming && data.action.content) {
        await this.saveFile(fullPath);
      }

      if (!isStreaming) {
        await artifact.runner.runAction(data);
        this.resetAllFileModifications();
      }
    } else {
      await artifact.runner.runAction(data);
    }
  }

  actionStreamSampler = createSampler(async (data: ActionCallbackData, isStreaming: boolean = false) => {
    return await this._runAction(data, isStreaming);
  }, 100); // TODO: remove this magic number to have it configurable

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    // Get the project name from the description input, or use a default name
    const projectName = (description.value ?? 'project').toLocaleLowerCase().split(' ').join('_');

    // Generate a simple 6-character hash based on the current timestamp
    const timestampHash = Date.now().toString(36).slice(-6);
    const uniqueProjectName = `${projectName}_${timestampHash}`;

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    // Generate the zip file and save it
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${uniqueProjectName}.zip`);
  }

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);
        const pathSegments = relativePath.split('/');
        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], {
          create: true,
        });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
  }

  async clearWorkspace() {
    try {
      // Get all current file paths
      const files = this.files.get();
      const filePaths = Object.keys(files);

      // Delete all files
      for (const filePath of filePaths) {
        if (files[filePath]?.type === 'file') {
          try {
            await this.deleteFile(filePath);
          } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);

            // Continue with other files instead of failing completely
            continue;
          }
        }
      }

      // Reset selected file and current document
      this.setSelectedFile(undefined);

      // Clear any unsaved files
      this.unsavedFiles.set(new Set<string>());

      // Reset workspace loaded flag to allow reloading
      this.#workspaceLoaded = false;

      // Force a refresh of the file tree UI by updating the files store atom
      this.#filesStore.files.set({});

      // Update editor documents to reflect the cleared workspace
      const allFiles = this.files.get();
      this.setDocuments(allFiles, false);

      console.log('Workspace cleared successfully');
    } catch (error) {
      console.error('Error clearing workspace:', error);
      throw error;
    }
  }

  async pushToRepository(
    provider: 'github' | 'gitlab',
    repoName: string,
    commitMessage?: string,
    username?: string,
    token?: string,
    isPrivate: boolean = false,
    _branchName: string = 'main',
  ) {
    try {
      const isGitHub = provider === 'github';

      const authToken = token || Cookies.get(isGitHub ? 'githubToken' : 'gitlabToken');
      const owner = username || Cookies.get(isGitHub ? 'githubUsername' : 'gitlabUsername');

      if (!authToken || !owner) {
        throw new Error(`${provider} token or username is not set in cookies or provided.`);
      }

      const files = this.files.get();

      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }

      if (isGitHub) {
        // Initialize Octokit with the auth token
        const octokit = new Octokit({ auth: authToken });

        // Check if the repository already exists before creating it
        let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];
        let visibilityJustChanged = false;

        try {
          const resp = await octokit.repos.get({ owner, repo: repoName });
          repo = resp.data;
          console.log('Repository already exists, using existing repo');

          // Check if we need to update visibility of existing repo
          if (repo.private !== isPrivate) {
            console.log(
              `Updating repository visibility from ${repo.private ? 'private' : 'public'} to ${isPrivate ? 'private' : 'public'}`,
            );

            try {
              // Update repository visibility using the update method
              const { data: updatedRepo } = await octokit.repos.update({
                owner,
                repo: repoName,
                private: isPrivate,
              });

              console.log('Repository visibility updated successfully');
              repo = updatedRepo;
              visibilityJustChanged = true;

              // Add a delay after changing visibility to allow GitHub to fully process the change
              console.log('Waiting for visibility change to propagate...');
              await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
            } catch (visibilityError) {
              console.error('Failed to update repository visibility:', visibilityError);

              // Continue with push even if visibility update fails
            }
          }
        } catch (error) {
          if (error instanceof Error && 'status' in error && error.status === 404) {
            // Repository doesn't exist, so create a new one
            console.log(`Creating new repository with private=${isPrivate}`);

            // Create new repository with specified privacy setting
            const createRepoOptions = {
              name: repoName,
              private: isPrivate,
              auto_init: true,
            };

            console.log('Create repo options:', createRepoOptions);

            const { data: newRepo } = await octokit.repos.createForAuthenticatedUser(createRepoOptions);

            console.log('Repository created:', newRepo.html_url, 'Private:', newRepo.private);
            repo = newRepo;

            // Add a small delay after creating a repository to allow GitHub to fully initialize it
            console.log('Waiting for repository to initialize...');
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
          } else {
            console.error('Cannot create repo:', error);
            throw error; // Some other error occurred
          }
        }

        // Get all files
        const files = this.files.get();

        if (!files || Object.keys(files).length === 0) {
          throw new Error('No files found to push');
        }

        // Function to push files with retry logic
        const pushFilesToRepo = async (attempt = 1): Promise<string> => {
          const maxAttempts = 3;

          try {
            console.log(`Pushing files to repository (attempt ${attempt}/${maxAttempts})...`);

            // Create blobs for each file
            const blobs = await Promise.all(
              Object.entries(files).map(async ([filePath, dirent]) => {
                if (dirent?.type === 'file' && dirent.content) {
                  const { data: blob } = await octokit.git.createBlob({
                    owner: repo.owner.login,
                    repo: repo.name,
                    content: Buffer.from(dirent.content).toString('base64'),
                    encoding: 'base64',
                  });
                  return { path: extractRelativePath(filePath), sha: blob.sha };
                }

                return null;
              }),
            );

            const validBlobs = blobs.filter(Boolean); // Filter out any undefined blobs

            if (validBlobs.length === 0) {
              throw new Error('No valid files to push');
            }

            // Refresh repository reference to ensure we have the latest data
            const repoRefresh = await octokit.repos.get({ owner, repo: repoName });
            repo = repoRefresh.data;

            // Get the latest commit SHA (assuming main branch, update dynamically if needed)
            const { data: ref } = await octokit.git.getRef({
              owner: repo.owner.login,
              repo: repo.name,
              ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
            });
            const latestCommitSha = ref.object.sha;

            // Create a new tree
            const { data: newTree } = await octokit.git.createTree({
              owner: repo.owner.login,
              repo: repo.name,
              base_tree: latestCommitSha,
              tree: validBlobs.map((blob) => ({
                path: blob!.path,
                mode: '100644',
                type: 'blob',
                sha: blob!.sha,
              })),
            });

            // Create a new commit
            const { data: newCommit } = await octokit.git.createCommit({
              owner: repo.owner.login,
              repo: repo.name,
              message: commitMessage || 'Initial commit from your app',
              tree: newTree.sha,
              parents: [latestCommitSha],
            });

            // Update the reference
            await octokit.git.updateRef({
              owner: repo.owner.login,
              repo: repo.name,
              ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
              sha: newCommit.sha,
            });

            console.log('Files successfully pushed to repository');

            return repo.html_url;
          } catch (error) {
            console.error(`Error during push attempt ${attempt}:`, error);

            // If we've just changed visibility and this is not our last attempt, wait and retry
            if ((visibilityJustChanged || attempt === 1) && attempt < maxAttempts) {
              const delayMs = attempt * 2000; // Increasing delay with each attempt
              console.log(`Waiting ${delayMs}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));

              return pushFilesToRepo(attempt + 1);
            }

            throw error; // Rethrow if we're out of attempts
          }
        };

        // Execute the push function with retry logic
        const repoUrl = await pushFilesToRepo();

        // Return the repository URL
        return repoUrl;
      }

      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      console.error('Error pushing to repository:', error);
      throw error; // Rethrow the error for further handling
    }
  }

  async saveWorkspaceState() {
    try {
      const files = this.files.get();

      // Convert files to a serializable format
      const serializedFiles: Record<string, { content: string; isBinary?: boolean }> = {};

      for (const [path, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          serializedFiles[path] = {
            content: dirent.content,
            isBinary: dirent.isBinary,
          };
        }
      }

      // Save to localStorage
      const workspaceData = {
        files: serializedFiles,
        selectedFile: this.currentDocument.get()?.filePath,
        unsavedFiles: Array.from(this.unsavedFiles.get()),
        timestamp: Date.now(),
      };

      localStorage.setItem('mindvex-workspace-state', JSON.stringify(workspaceData));
      console.log('Workspace state saved to localStorage');
    } catch (error) {
      console.error('Error saving workspace state:', error);
    }
  }

  async loadWorkspaceState() {
    try {
      // Prevent duplicate loading of workspace state
      if (this.#workspaceLoaded) {
        console.log('Workspace state already loaded, skipping');
        return;
      }

      const workspaceDataStr = localStorage.getItem('mindvex-workspace-state');

      if (!workspaceDataStr) {
        console.log('No saved workspace state found');

        // Mark as loaded even if no state was found to prevent future attempts
        this.#workspaceLoaded = true;

        return;
      }

      const workspaceData = JSON.parse(workspaceDataStr);

      /*
       * First, populate the workbench store with existing WebContainer files to avoid duplicates
       * Wait for the file system to be ready and populate the store
       */
      const container = await webcontainer;

      // Get current files from the WebContainer filesystem directly
      const webContainerFiles: Record<string, { content: string; isBinary?: boolean }> = {};

      // Helper function to recursively walk the file system
      const walkDir = async (dirPath: string) => {
        const dirContents = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const dirent of dirContents) {
          const fullPath = path.join(dirPath, dirent.name);

          if (dirent.isDirectory()) {
            await walkDir(fullPath);
          } else if (dirent.isFile()) {
            try {
              const content = await container.fs.readFile(fullPath, 'utf8');
              webContainerFiles[fullPath] = { content };
            } catch (error) {
              console.error(`Error reading file ${fullPath}:`, error);
            }
          }
        }
      };

      // Walk from the WORK_DIR to get all existing files
      await walkDir(WORK_DIR);

      for (const [filePath, fileData] of Object.entries(
        workspaceData.files as Record<string, { content: string; isBinary?: boolean }>,
      )) {
        try {
          /*
           * Normalize the file path to ensure it's within the WORK_DIR
           * filePath from localStorage might already include WORK_DIR, so we check carefully
           */
          let normalizedFilePath = filePath;

          // If the path already starts with WORK_DIR, use it as is
          if (filePath.startsWith(WORK_DIR)) {
            normalizedFilePath = filePath;
          } else if (filePath.startsWith('/home/project/')) {
            // Handle legacy paths that might have the full /home/project prefix
            normalizedFilePath = filePath;
          } else {
            /*
             * If the path doesn't start with WORK_DIR, it's likely a relative path
             * We need to construct the full path
             */
            normalizedFilePath = path.join(WORK_DIR, filePath);
          }

          // Check if file already exists in the WebContainer to avoid duplication
          if (webContainerFiles[normalizedFilePath]) {
            console.log(`File already exists in WebContainer, skipping: ${normalizedFilePath}`);
            continue;
          }

          const dirPath = path.dirname(normalizedFilePath);

          if (dirPath !== '.' && dirPath !== '/') {
            await container.fs.mkdir(dirPath, { recursive: true });
          }

          await container.fs.writeFile(normalizedFilePath, fileData.content);

          // Add to workbench store without selecting the file
          await this.createFileWithoutSelecting(normalizedFilePath, fileData.content);
        } catch (error) {
          console.error(`Error restoring file ${filePath}:`, error);
        }
      }

      /*
       * Don't restore selected file to prevent auto-opening files on workspace load
       * if (workspaceData.selectedFile) {
       *   this.setSelectedFile(workspaceData.selectedFile);
       * }
       */

      // Restore unsaved files
      if (Array.isArray(workspaceData.unsavedFiles)) {
        this.unsavedFiles.set(new Set(workspaceData.unsavedFiles));
      }

      // Mark workspace as loaded to prevent future attempts
      this.#workspaceLoaded = true;

      console.log('Workspace state restored from localStorage');
    } catch (error) {
      console.error('Error loading workspace state:', error);

      // Still mark as loaded to prevent repeated failed attempts
      this.#workspaceLoaded = true;
    }
  }
}

export const workbenchStore = new WorkbenchStore();
