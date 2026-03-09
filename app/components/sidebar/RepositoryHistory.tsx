import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { repositoryHistoryStore, type RepositoryHistoryItem } from '~/lib/stores/repositoryHistory';
import { binDates } from './date-binning';

/*
 * Note: RepositoryHistoryItemComponent is not being used directly here, but imported for the type reference
 * If the component is missing, we'll implement the functionality directly in this file
 */
import { useState } from 'react';
import { useGit } from '~/lib/hooks/useGit';
import {
  importGitRepoToWorkbench,
  importFolderToWorkbench,
  loadStoredFolderToWorkbench,
  loadStoredGitRepoToWorkbench,
} from '~/utils/workbenchImport';
import { toast } from 'react-toastify';

interface RepositoryHistoryProps {
  selectionMode?: boolean;
  selectedItems: string[];
  onToggleSelection?: (id: string) => void;
  onBulkDelete?: () => void;
}

export function RepositoryHistory({
  selectionMode = false,
  selectedItems,
  onToggleSelection,
  onBulkDelete,
}: RepositoryHistoryProps) {
  const repositoryHistory = useStore(repositoryHistoryStore.repositoryHistory);
  const [searchTerm, setSearchTerm] = useState('');
  const { ready, gitClone } = useGit();

  // Convert the repository history object to an array and filter based on search
  const allRepositories = Object.values(repositoryHistory).filter(
    (repo) =>
      (repo.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (repo.description || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Sort repositories by timestamp (newest first)
  const sortedRepositories = allRepositories.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  // Group repositories by date
  const groupedRepositories = binDates<RepositoryHistoryItem>(sortedRepositories);

  const handleOpenInWorkbench = async (repo: RepositoryHistoryItem) => {
    try {
      if (!ready || !gitClone) {
        toast.error('Git is not ready. Please try again later.');
        return;
      }

      // Check if the URL is a folder path (starts with folder://) or a git repository
      if (repo.url.startsWith('folder://')) {
        /*
         * For folder imports, try to load from stored data first
         * Extract the folder name from the URL
         */
        const folderName = repo.url.replace('folder://', '');

        // Show options to add to existing workspace or create new workspace
        const addToExisting = window.confirm(
          `Do you want to add '${repo.name}' to the existing workspace?\n\nClick 'OK' to add to existing workspace, 'Cancel' to create a new workspace (replacing current content)`,
        );

        try {
          // Attempt to load the stored folder
          const success = await loadStoredFolderToWorkbench(folderName, addToExisting);

          if (success) {
            toast.success(
              `Folder '${repo.name}' loaded in workbench ${addToExisting ? 'with existing content' : '(workspace cleared)'}`,
            );
          }
        } catch (error) {
          console.error('Error loading stored folder:', error);

          // If loading from storage fails, prompt for re-upload
          const shouldReupload = window.confirm(
            `Failed to load stored folder '${repo.name}'. Would you like to select the folder again to reload it?`,
          );

          if (shouldReupload) {
            const input = document.createElement('input');
            input.type = 'file';
            (input as any).webkitdirectory = true;

            input.onchange = async (e) => {
              const files = Array.from((e.target as HTMLInputElement).files || []);

              if (files.length > 0) {
                try {
                  // Import the selected folder to the workbench
                  await importFolderToWorkbench(files, addToExisting);
                  toast.success(
                    `Folder '${repo.name}' loaded in workbench ${addToExisting ? 'with existing content' : '(workspace cleared)'}`,
                  );
                } catch (error) {
                  console.error('Error loading folder:', error);
                  toast.error('Failed to load folder in workbench');
                }
              }
            };
            input.click();
          } else {
            toast.info('Folder loading cancelled. You can try again later.');
          }
        }
      } else {
        /*
         * This is a git repository URL, try to load from stored data first
         * Extract the repo name from the URL
         */
        const repoName =
          repo.url
            .split('/')
            .pop()
            ?.replace(/\.git$/, '') || repo.name;

        // Show options to add to existing workspace or create new workspace
        const addToExisting = window.confirm(
          `Do you want to add '${repo.name}' to the existing workspace?\n\nClick 'OK' to add to existing workspace, 'Cancel' to create a new workspace (replacing current content)`,
        );

        try {
          // Attempt to load the stored repository
          const success = await loadStoredGitRepoToWorkbench(repoName, addToExisting);

          if (success) {
            toast.success(
              `Repository '${repo.name}' loaded in workbench ${addToExisting ? 'with existing content' : '(workspace cleared)'}`,
            );
          }
        } catch (error) {
          console.error('Error loading stored repository:', error);

          // If loading from storage fails, ask user if they want to clone again
          const shouldClone = window.confirm(
            `Failed to load stored repository '${repo.name}'. Would you like to clone it again?`,
          );

          if (shouldClone) {
            // Check if git is ready and clone
            if (!ready || !gitClone) {
              toast.error('Git is not ready. Please try again later.');
              return;
            }

            await importGitRepoToWorkbench(repo.url, gitClone, addToExisting);
            toast.success(
              `Repository '${repo.name}' loaded in workbench ${addToExisting ? 'with existing content' : '(workspace cleared)'}`,
            );
          } else {
            toast.info('Repository loading cancelled. You can try again later.');
          }
        }
      }
    } catch (error) {
      console.error('Error opening repository in workbench:', error);
      toast.error('Failed to open repository in workbench');
    }
  };

  return (
    <div className="flex-1 overflow-auto px-3 pb-3">
      {sortedRepositories.length === 0 ? (
        <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">
          {allRepositories.length === 0 ? 'No repositories imported yet' : 'No matches found'}
        </div>
      ) : (
        <>
          {groupedRepositories.map(({ category, items }) => (
            <div key={category} className="mt-2 first:mt-0 space-y-1">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-mindvex-elements-background-depth-1 px-4 py-1">
                {category}
              </div>
              <div className="space-y-0.5 pr-1">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    className={classNames(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                      selectionMode
                        ? selectedItems.includes(item.id)
                          ? 'bg-orange-100 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-700'
                          : 'hover:bg-orange-50 dark:hover:bg-orange-900/30 border border-transparent'
                        : 'hover:bg-orange-50 dark:hover:bg-orange-900/30',
                    )}
                    onClick={() => {
                      if (selectionMode && onToggleSelection) {
                        onToggleSelection(item.id);
                      } else {
                        handleOpenInWorkbench(item);
                      }
                    }}
                  >
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => onToggleSelection && onToggleSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">{item.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        if (window.confirm(`Are you sure you want to delete repository '${item.name}' from history?`)) {
                          repositoryHistoryStore.removeRepository(item.id);
                          toast.success(`Repository '${item.name}' removed from history`);
                        }
                      }}
                      className="ml-2 text-red-500 hover:text-red-700"
                      title="Delete repository"
                    >
                      <div className="i-ph:trash text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
