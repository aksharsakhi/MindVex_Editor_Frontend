import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { MAX_FILES, isBinaryFile, shouldIncludeFile } from '~/utils/fileUtils';
import { logStore } from '~/lib/stores/logs';
import { WORK_DIR } from '~/utils/constants';
import { path } from '~/utils/path';

/**
 * Import a folder directly into the workbench store
 */
export const importFolderToWorkbench = async (files: File[], addToExisting = false) => {
  const allFiles = Array.from(files);

  const filteredFiles = allFiles.filter((file) => {
    const path = file.webkitRelativePath.split('/').slice(1).join('/');
    console.log('Workbench import filtering file path:', path);

    const include = shouldIncludeFile(path);

    return include;
  });

  if (filteredFiles.length === 0) {
    const error = new Error('No valid files found');
    logStore.logError('Workbench file import failed - no valid files', error, { folderName: 'Unknown Folder' });
    toast.error('No files found in the selected folder');

    return;
  }

  if (filteredFiles.length > MAX_FILES) {
    const error = new Error(`Too many files: ${filteredFiles.length}`);
    logStore.logError('Workbench file import failed - too many files', error, {
      fileCount: filteredFiles.length,
      maxFiles: MAX_FILES,
    });
    toast.error(
      `This folder contains ${filteredFiles.length.toLocaleString()} files. This product is not yet optimized for very large projects. Please select a folder with fewer than ${MAX_FILES.toLocaleString()} files.`,
    );

    return;
  }

  const folderName = filteredFiles[0]?.webkitRelativePath.split('/')[0] || 'Unknown Folder';

  if (!addToExisting) {
    // Clear the workspace before importing new content
    await workbenchStore.clearWorkspace();
  }

  const loadingToast = toast.loading(`Importing ${folderName} to workbench...`);

  try {
    const fileChecks = await Promise.all(
      filteredFiles.map(async (file) => ({
        file,
        isBinary: await isBinaryFile(file),
      })),
    );

    const textFiles = fileChecks.filter((f) => !f.isBinary).map((f) => f.file);
    const binaryFilePaths = fileChecks
      .filter((f) => f.isBinary)
      .map((f) => f.file.webkitRelativePath.split('/').slice(1).join('/'));

    if (textFiles.length === 0) {
      const error = new Error('No text files found');
      logStore.logError('Workbench file import failed - no text files', error, { folderName });
      toast.error('No text files found in the selected folder');

      return;
    }

    if (binaryFilePaths.length > 0) {
      logStore.logWarning(`Skipping binary files during workbench import`, {
        folderName,
        binaryCount: binaryFilePaths.length,
      });
      toast.info(`Skipping ${binaryFilePaths.length} binary files`);
    }

    // Prepare files data for storage
    const filesData = [];

    // Import text files into workbench
    for (const file of textFiles) {
      const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');

      // Construct the full path using WORK_DIR and relative path
      let fullFilePath: string = `${WORK_DIR}/${relativePath}`.replace(/\/\/+/g, '/');

      // Normalize the path to remove any relative path components like ./ or ../
      fullFilePath = path.normalize(fullFilePath);

      const content = await file.text();

      console.log(
        'Processing workbench import file:',
        file.name,
        'Relative path:',
        relativePath,
        'Full path:',
        fullFilePath,
      );

      // Create the file in the workbench
      try {
        console.log('About to create file with path:', fullFilePath);

        const result = await workbenchStore.createFile(fullFilePath, content);
        console.log('File creation result:', result, 'for path:', fullFilePath);
      } catch (error) {
        console.error(`Error creating file ${fullFilePath}:`, error);
        console.error('WebContainer workdir was expected to be:', WORK_DIR);
        toast.error(`Error creating file: ${fullFilePath}`);
        continue; // Skip this file and continue with others
      }

      // Store file data for potential later retrieval
      filesData.push({
        path: relativePath,
        content,
      });
    }

    // Update editor documents to reflect all newly created files
    const allFiles = workbenchStore.files.get();
    workbenchStore.setDocuments(allFiles, true); // autoSelectFirstFile = true

    // Explicitly select the first file if available
    if (Object.keys(allFiles).length > 0) {
      const firstFilePath = Object.keys(allFiles).find((path) => allFiles[path]?.type === 'file');

      if (firstFilePath) {
        workbenchStore.setSelectedFile(firstFilePath);
      }
    }

    // Store the folder data in localStorage for later retrieval
    if (filesData.length > 0) {
      const folderStorageKey = `folder_${folderName}`;
      const folderData = {
        name: folderName,
        files: filesData,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(folderStorageKey, JSON.stringify(folderData));
    }

    logStore.logSystem('Folder imported to workbench successfully', {
      folderName,
      textFileCount: textFiles.length,
      binaryFileCount: binaryFilePaths.length,
    });

    toast.success(`${textFiles.length} files imported to workbench successfully`);

    // Show the workbench after import
    workbenchStore.setShowWorkbench(true);
  } catch (error) {
    logStore.logError('Failed to import folder to workbench', error, { folderName });
    console.error('Failed to import folder to workbench:', error);
    toast.error('Failed to import folder to workbench');
  } finally {
    toast.dismiss(loadingToast);
  }
};

/**
 * Load a previously stored Git repository from localStorage into the workbench
 */
export const loadStoredGitRepoToWorkbench = async (repoName: string, addToExisting = false) => {
  const repoStorageKey = `repo_${repoName}`;
  const repoDataStr = localStorage.getItem(repoStorageKey);

  if (!repoDataStr) {
    throw new Error(`No stored repository found with name: ${repoName}`);
  }

  try {
    const repoData = JSON.parse(repoDataStr);

    if (!addToExisting) {
      // Clear the workspace before importing new content
      await workbenchStore.clearWorkspace();
    }

    // Import files from stored data into workbench
    for (const fileData of repoData.files) {
      // Construct the full path using WORK_DIR and relative path
      let fullFilePath: string = `${WORK_DIR}/${fileData.path}`.replace(/\/\/+/g, '/');

      // Normalize the path to remove any relative path components like ./ or ../
      fullFilePath = path.normalize(fullFilePath);

      try {
        console.log('About to create stored file with path:', fullFilePath);

        const result = await workbenchStore.createFile(fullFilePath, fileData.content);
        console.log('Stored file creation result:', result, 'for path:', fullFilePath);
      } catch (error) {
        console.error(`Error creating file ${fullFilePath}:`, error);
        console.error('WebContainer workdir was expected to be:', WORK_DIR);
        toast.error(`Error creating file: ${fullFilePath}`);
        continue; // Skip this file and continue with others
      }
    }

    // Update editor documents to reflect all newly created files
    const allFiles = workbenchStore.files.get();
    workbenchStore.setDocuments(allFiles, true); // autoSelectFirstFile = true

    // Explicitly select the first file if available
    if (Object.keys(allFiles).length > 0) {
      const firstFilePath = Object.keys(allFiles).find((path) => allFiles[path]?.type === 'file');

      if (firstFilePath) {
        workbenchStore.setSelectedFile(firstFilePath);
      }
    }

    logStore.logSystem('Stored repository loaded to workbench successfully', {
      repoName,
      fileCount: repoData.files.length,
      timestamp: repoData.timestamp,
    });

    toast.success(`${repoData.files.length} files loaded from stored repository '${repoName}'`);

    // Show the workbench after loading
    workbenchStore.setShowWorkbench(true);

    return true;
  } catch (error) {
    logStore.logError('Failed to load stored repository from localStorage', error, { repoName });
    console.error('Failed to load stored repository:', error);
    toast.error('Failed to load stored repository');

    return false;
  }
};

/**
 * Load a previously stored folder from localStorage into the workbench
 */
export const loadStoredFolderToWorkbench = async (folderName: string, addToExisting = false) => {
  const folderStorageKey = `folder_${folderName}`;
  const folderDataStr = localStorage.getItem(folderStorageKey);

  if (!folderDataStr) {
    throw new Error(`No stored folder found with name: ${folderName}`);
  }

  try {
    const folderData = JSON.parse(folderDataStr);

    if (!addToExisting) {
      // Clear the workspace before importing new content
      await workbenchStore.clearWorkspace();
    }

    // Import files from stored data into workbench
    for (const fileData of folderData.files) {
      // Construct the full path using WORK_DIR and relative path
      let fullFilePath: string = `${WORK_DIR}/${fileData.path}`.replace(/\/\/+/g, '/');

      // Normalize the path to remove any relative path components like ./ or ../
      fullFilePath = path.normalize(fullFilePath);

      try {
        console.log('About to create stored file with path:', fullFilePath);

        const result = await workbenchStore.createFile(fullFilePath, fileData.content);
        console.log('Stored file creation result:', result, 'for path:', fullFilePath);
      } catch (error) {
        console.error(`Error creating file ${fullFilePath}:`, error);
        console.error('WebContainer workdir was expected to be:', WORK_DIR);
        toast.error(`Error creating file: ${fullFilePath}`);
        continue; // Skip this file and continue with others
      }
    }

    // Update editor documents to reflect all newly created files
    const allFiles = workbenchStore.files.get();
    workbenchStore.setDocuments(allFiles, true); // autoSelectFirstFile = true

    // Explicitly select the first file if available
    if (Object.keys(allFiles).length > 0) {
      const firstFilePath = Object.keys(allFiles).find((path) => allFiles[path]?.type === 'file');

      if (firstFilePath) {
        workbenchStore.setSelectedFile(firstFilePath);
      }
    }

    logStore.logSystem('Stored folder loaded to workbench successfully', {
      folderName,
      fileCount: folderData.files.length,
      timestamp: folderData.timestamp,
    });

    toast.success(`${folderData.files.length} files loaded from stored folder '${folderName}'`);

    // Show the workbench after loading
    workbenchStore.setShowWorkbench(true);

    return true;
  } catch (error) {
    logStore.logError('Failed to load stored folder from localStorage', error, { folderName });
    console.error('Failed to load stored folder:', error);
    console.error('Folder name:', folderName);
    console.error('Storage key:', `folder_${folderName}`);
    console.error('Storage data:', localStorage.getItem(`folder_${folderName}`));

    // Try to list all stored keys to debug
    const allKeys = Object.keys(localStorage);
    const folderKeys = allKeys.filter((key) => key.startsWith('folder_'));
    console.log('Available stored folders:', folderKeys);

    toast.error(`Failed to load stored folder: ${(error as Error).message}`);

    return false;
  }
};

/**
 * Import a Git repository directly into the workbench store
 */
interface GitFileData {
  type: string;
  encoding: string;
  content: string;
}

export const importGitRepoToWorkbench = async (repoUrl: string, gitClone: any, addToExisting = false) => {
  if (!addToExisting) {
    // Clear the workspace before importing new content
    await workbenchStore.clearWorkspace();
  }

  const loadingToast = toast.loading(`Cloning repository ${repoUrl} to workbench...`);

  try {
    const { workdir: _workdir, data } = await gitClone(repoUrl);

    // Prepare files data for storage
    const filesData = [];

    // Import files to workbench
    for (const [filePath, fileData] of Object.entries(data)) {
      const typedFileData = fileData as GitFileData;

      if (typedFileData.type === 'file' && typedFileData.encoding === 'utf8' && typedFileData.content) {
        /*
         * Create the file in the workbench
         * Construct the full path using WORK_DIR and relative path
         */
        let fullFilePath: string = `${WORK_DIR}/${filePath}`.replace(/\/\/+/g, '/');

        // Normalize the path to remove any relative path components like ./ or ../
        fullFilePath = path.normalize(fullFilePath);

        try {
          console.log('About to create git file with path:', fullFilePath);

          const result = await workbenchStore.createFile(fullFilePath, typedFileData.content);
          console.log('Git file creation result:', result, 'for path:', fullFilePath);
        } catch (error) {
          console.error(`Error creating file ${fullFilePath}:`, error);
          console.error('WebContainer workdir was expected to be:', WORK_DIR);
          toast.error(`Error creating file: ${fullFilePath}`);
          continue; // Skip this file and continue with others
        }

        // Store file data for potential later retrieval
        filesData.push({
          path: filePath,
          content: typedFileData.content,
        });
      }
    }

    // Update editor documents to reflect all newly created files
    const allFiles = workbenchStore.files.get();
    workbenchStore.setDocuments(allFiles, true); // autoSelectFirstFile = true

    // Explicitly select the first file if available
    if (Object.keys(allFiles).length > 0) {
      const firstFilePath = Object.keys(allFiles).find((path) => allFiles[path]?.type === 'file');

      if (firstFilePath) {
        workbenchStore.setSelectedFile(firstFilePath);
      }
    }

    // Store the repository data in localStorage for later retrieval
    if (filesData.length > 0) {
      // Extract repo name from URL for storage key
      const repoName =
        repoUrl
          .split('/')
          .pop()
          ?.replace(/\.git$/, '') || 'unknown';
      const repoStorageKey = `repo_${repoName}`;
      const repoData = {
        name: repoName,
        url: repoUrl,
        files: filesData,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(repoStorageKey, JSON.stringify(repoData));
    }

    logStore.logSystem('Repository imported to workbench successfully', {
      repoUrl,
      fileCount: Object.keys(data).length,
    });

    toast.success(`Repository imported to workbench successfully`);

    // Show the workbench after import
    workbenchStore.setShowWorkbench(true);
  } catch (error) {
    logStore.logError('Failed to import repository to workbench', error, { repoUrl });
    console.error('Failed to import repository to workbench:', error);
    toast.error('Failed to import repository to workbench');
  } finally {
    toast.dismiss(loadingToast);
  }
};
