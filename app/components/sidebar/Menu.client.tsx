import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { SettingsButton, HelpButton } from '~/components/ui/SettingsButton';
import { Button } from '~/components/ui/Button';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { authStore, clearAuth } from '~/lib/stores/authStore';
import { RepositoryHistory } from './RepositoryHistory';
import { ChatHistory } from './ChatHistory';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-mindvex-elements-textSecondary border-b border-mindvex-elements-borderColor">
      <div className="h-4 w-4 i-ph:clock opacity-80" />
      <div className="flex gap-2">
        <span>{dateTime.toLocaleDateString()}</span>
        <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export function Menu() {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const auth = useStore(authStore);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        console.log('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete the chat from the database
      await deleteById(db, id);
      console.log('Successfully deleted chat:', id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      // Check if this is a chat history item (has urlId) or repository item
      if (item.urlId) {
        // This is a chat history item
        console.log('Attempting to delete chat:', { id: item.id, description: item.description });

        deleteChat(item.id)
          .then(() => {
            toast.success('Chat deleted successfully', {
              position: 'bottom-right',
              autoClose: 3000,
            });

            // Always refresh the list
            loadEntries();

            if (chatId.get() === item.id) {
              // hard page navigation to clear the stores
              console.log('Navigating away from deleted chat');
              window.location.pathname = '/';
            }
          })
          .catch((error) => {
            console.error('Failed to delete chat:', error);
            toast.error('Failed to delete conversation', {
              position: 'bottom-right',
              autoClose: 3000,
            });

            // Still try to reload entries in case data has changed
            loadEntries();
          });
      } else {
        // This is a repository item - delegate to repository history store
        console.log('Attempting to delete repository:', { id: item.id, description: item.description });
        repositoryHistoryStore.removeRepository(item.id);
        toast.success('Repository removed from history', {
          position: 'bottom-right',
          autoClose: 3000,
        });
        loadEntries();
      }
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: No items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} items`, itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially - determine if it's a chat or repository item
      for (const id of itemsToDeleteIds) {
        try {
          // Find the item in the list to determine its type
          const item = list.find((item) => item.id === id);

          if (item && item.urlId) {
            // This is a chat history item
            if (!db) {
              throw new Error('Database not available');
            }

            await deleteChat(id);
          } else {
            // This is a repository item
            repositoryHistoryStore.removeRepository(id);
          }

          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting item ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`${deletedCount} item${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} items. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, db, list],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);

    if (selectionMode) {
      // If turning selection mode OFF, clear selection
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      console.log('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full rounded-r-2xl',
          'bg-mindvex-elements-background-depth-1 border-r border-mindvex-elements-borderColor',
          'shadow-sm text-sm',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-mindvex-elements-borderColor bg-mindvex-elements-bg-depth-2 rounded-tr-2xl">
          <div className="text-mindvex-elements-textPrimary font-medium"></div>
          <div className="flex items-center gap-3">
            <HelpButton onClick={() => window.open('https://mindvex.ai/', '_blank')} />
            <span className="font-medium text-sm text-mindvex-elements-textPrimary truncate">
              {auth.user?.fullName || auth.user?.email || 'Guest User'}
            </span>
            <div className="flex items-center justify-center w-[32px] h-[32px] overflow-hidden bg-mindvex-elements-bg-depth-1 text-mindvex-elements-textSecondary rounded-full shrink-0">
              <div className="i-ph:user-fill text-lg" />
            </div>
          </div>
        </div>
        <CurrentDateTime />
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  // Toggle the right chat panel instead of navigating to full page
                  workbenchStore.toggleRightChat(true);
                }}
                className="flex-1 flex gap-2 items-center bg-mindvex-elements-item-backgroundActive text-mindvex-elements-item-contentAccent hover:bg-mindvex-elements-item-backgroundAccent rounded-lg px-4 py-2 transition-colors"
                title="Chat with your code"
              >
                <span className="inline-block i-ph:chat-text h-4 w-4" />
                <span className="text-sm font-medium">Chat with Code</span>
              </button>
              <a
                href="/editor"
                className="flex-1 flex gap-2 items-center bg-mindvex-elements-item-backgroundActive text-mindvex-elements-item-contentAccent hover:bg-mindvex-elements-item-backgroundAccent rounded-lg px-4 py-2 transition-colors"
                title="Go to workspace"
              >
                <span className="inline-block i-ph:code h-4 w-4" />
                <span className="text-sm font-medium">Go to Workspace</span>
              </a>
              <button
                onClick={toggleSelectionMode}
                className={classNames(
                  'flex gap-1 items-center rounded-lg px-3 py-2 transition-colors',
                  selectionMode
                    ? 'bg-mindvex-elements-sidebar-buttonBackgroundDefault text-mindvex-elements-sidebar-buttonText border border-mindvex-elements-sidebar-buttonBackgroundHover'
                    : 'bg-mindvex-elements-item-backgroundActive text-mindvex-elements-item-contentDefault hover:bg-mindvex-elements-item-backgroundHover border border-mindvex-elements-borderColor',
                )}
                aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
              >
                <span className={selectionMode ? 'i-ph:x h-4 w-4' : 'i-ph:check-square h-4 w-4'} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex flex-col items-center justify-center bg-mindvex-elements-item-backgroundActive hover:bg-mindvex-elements-item-backgroundHover rounded-lg p-3 transition-colors border border-mindvex-elements-borderColor"
                title="Settings"
              >
                <span className="inline-block i-ph:gear-duotone h-5 w-5 mb-1 text-mindvex-elements-textSecondary" />
                <span className="text-xs text-mindvex-elements-textPrimary">Settings</span>
              </button>
              <button
                onClick={async () => {
                  const folderName = prompt('Enter folder name:');

                  if (folderName) {
                    try {
                      // Ensure the folder is created under the project directory
                      const fullFolderPath = `${WORK_DIR}/${folderName}`;
                      const result = await workbenchStore.createFolder(fullFolderPath);

                      if (result) {
                        // Update editor documents to reflect the newly created folder
                        const allFiles = workbenchStore.files.get();
                        workbenchStore.setDocuments(allFiles, false);

                        toast.success(`Folder '${folderName}' created`);
                      } else {
                        toast.error(`Failed to create folder '${folderName}'`);
                      }
                    } catch (error: any) {
                      console.error('Error creating folder:', error);
                      toast.error(`Error creating folder: ${error.message}`);
                    }
                  }
                }}
                className="flex flex-col items-center justify-center bg-mindvex-elements-item-backgroundActive hover:bg-mindvex-elements-item-backgroundHover rounded-lg p-3 transition-colors border border-mindvex-elements-borderColor"
                title="Create New Folder"
              >
                <span className="inline-block i-ph:folder-plus h-5 w-5 mb-1 text-mindvex-elements-textSecondary" />
                <span className="text-xs text-mindvex-elements-textPrimary">New Folder</span>
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;

                  input.onchange = async (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);

                    if (files.length > 0) {
                      try {
                        for (const file of files) {
                          const content = await file.text();
                          const filePath = `${WORK_DIR}/${file.name}`;
                          await workbenchStore.createFile(filePath, content);
                        }

                        // Update editor documents to reflect all newly created files
                        const allFiles = workbenchStore.files.get();
                        workbenchStore.setDocuments(allFiles, false);

                        toast.success(`${files.length} file(s) imported`);
                      } catch (error: any) {
                        console.error('Failed to import files to workbench:', error);
                        toast.error('Failed to import files to workbench');
                      }
                    }
                  };
                  input.click();
                }}
                className="flex flex-col items-center justify-center bg-mindvex-elements-item-backgroundActive hover:bg-mindvex-elements-item-backgroundHover rounded-lg p-3 transition-colors border border-mindvex-elements-borderColor"
                title="Import File"
              >
                <span className="inline-block i-ph:file-arrow-up h-5 w-5 mb-1 text-mindvex-elements-textSecondary" />
                <span className="text-xs text-mindvex-elements-textPrimary">Import File</span>
              </button>
              <a
                href="/dashboard"
                className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 rounded-lg p-3 transition-colors border border-blue-500/30"
                title="AI Agents - Dashboard"
              >
                <span className="inline-block i-ph:robot h-5 w-5 mb-1 text-blue-400" />
                <span className="text-xs text-mindvex-elements-textPrimary">Dashboard</span>
              </a>
            </div>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass h-4 w-4 text-mindvex-elements-textSecondary" />
              </div>
              <input
                className="w-full bg-mindvex-elements-item-backgroundActive relative pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-mindvex-elements-item-contentAccent text-sm text-mindvex-elements-textPrimary placeholder-mindvex-elements-textSecondary border border-mindvex-elements-borderColor"
                type="search"
                placeholder="Search chats..."
                onChange={handleSearchChange}
                aria-label="Search chats"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm px-4 py-2">
            <div className="font-medium text-mindvex-elements-textSecondary">Your Repos</div>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedItems.length === filteredList.length ? 'Deselect all' : 'Select all'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  disabled={selectedItems.length === 0}
                >
                  Delete selected
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm px-1 py-2">
                <div className="font-medium text-mindvex-elements-textSecondary">Your Chats</div>
              </div>
              <ChatHistory
                selectionMode={selectionMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
              />
            </div>

            <div className="border-t border-mindvex-elements-borderColor pt-4 mt-4">
              <div className="flex items-center justify-between text-sm px-1 py-2">
                <div className="font-medium text-mindvex-elements-textSecondary">Your Repos</div>
              </div>
              <RepositoryHistory
                selectionMode={selectionMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
              />
            </div>

            <DialogRoot open={dialogContent !== null}>
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-mindvex-elements-bg-depth-1">
                      <DialogTitle className="text-mindvex-elements-textPrimary">
                        {dialogContent.item.urlId ? 'Delete Chat?' : 'Delete Repository?'}
                      </DialogTitle>
                      <DialogDescription className="mt-2 text-mindvex-elements-textSecondary">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-mindvex-elements-item-contentAccent">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-2">
                          Are you sure you want to{' '}
                          {dialogContent.item.urlId ? 'delete this chat' : 'remove this repository from history'}?
                        </p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-mindvex-elements-bg-depth-2 border-t border-mindvex-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event: React.UIEvent) => {
                          console.log('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-mindvex-elements-bg-depth-1">
                      <DialogTitle className="text-mindvex-elements-textPrimary">
                        {(() => {
                          const hasChats = dialogContent.items.some((item: any) => item.urlId);
                          const hasRepos = dialogContent.items.some((item: any) => !item.urlId);

                          if (hasChats && hasRepos) {
                            return 'Delete Selected Items?';
                          } else if (hasChats) {
                            return 'Delete Selected Chats?';
                          } else {
                            return 'Delete Selected Repositories?';
                          }
                        })()}
                      </DialogTitle>
                      <DialogDescription className="mt-2 text-mindvex-elements-textSecondary">
                        <p>
                          You are about to delete {dialogContent.items.length}{' '}
                          {(() => {
                            const hasChats = dialogContent.items.some((item: any) => item.urlId);
                            const hasRepos = dialogContent.items.some((item: any) => !item.urlId);

                            if (hasChats && hasRepos) {
                              return 'items';
                            } else if (hasChats) {
                              return 'chat' + (dialogContent.items.length === 1 ? '' : 's');
                            } else {
                              return 'repository' + (dialogContent.items.length === 1 ? '' : 'ies');
                            }
                          })()}
                          :
                        </p>
                        <div className="mt-2 max-h-32 overflow-auto border border-mindvex-elements-borderColor rounded-md bg-mindvex-elements-bg-depth-2 p-2">
                          <ul className="list-disc pl-5 space-y-1 text-mindvex-elements-textPrimary">
                            {dialogContent.items.map((item: any) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-mindvex-elements-item-contentAccent">
                                  {item.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">
                          Are you sure you want to{' '}
                          {(() => {
                            const hasChats = dialogContent.items.some((item: any) => item.urlId);
                            const hasRepos = dialogContent.items.some((item: any) => !item.urlId);

                            if (hasChats && hasRepos) {
                              return 'delete these items';
                            } else if (hasChats) {
                              return 'delete these chats';
                            } else {
                              return 'remove these repositories from history';
                            }
                          })()}
                          ?
                        </p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-mindvex-elements-bg-depth-2 border-t border-mindvex-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          console.log('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-between border-t border-mindvex-elements-borderColor px-4 py-3">
            <div className="flex items-center gap-3">
              <SettingsButton onClick={handleSettingsClick} />
              {auth.isAuthenticated && (
                <button
                  onClick={() => {
                    clearAuth();
                    toast.success('Logged out successfully');
                    window.location.href = '/';
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mindvex-elements-item-backgroundActive hover:bg-mindvex-elements-item-backgroundHover text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary transition-colors"
                  title="Logout"
                >
                  <div className="i-ph:sign-out h-4 w-4" />
                  <span className="text-sm">Logout</span>
                </button>
              )}
            </div>
            <ThemeSwitch />
          </div>
        </div>
      </motion.div>

      <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
}
