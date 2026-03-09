import { binDates } from './date-binning';
import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { HistoryItem } from './HistoryItem';
import { useChatHistory } from '~/lib/persistence';

interface ChatHistoryProps {
  selectionMode?: boolean;
  selectedItems: string[];
  onToggleSelection?: (id: string) => void;
  onBulkDelete?: () => void;
}

export function ChatHistory({
  selectionMode = false,
  selectedItems,
  onToggleSelection,
  onBulkDelete: _onBulkDelete,
}: ChatHistoryProps) {
  const { exportChat, duplicateCurrentChat } = useChatHistory();
  const [searchTerm] = useState('');

  // We need to fetch the chat history list from the database
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load chat history on component mount
  useState(() => {
    const loadChatHistory = async () => {
      try {
        const { db, getAll } = await import('~/lib/persistence');

        if (db) {
          const list = await getAll(db);

          // Filter to only include chats with descriptions
          const filteredList = list.filter((item: any) => item.urlId && item.description);
          setChatHistory(filteredList);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        toast.error('Failed to load chat history');
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  });

  // Filter and sort chat history
  const allChats = chatHistory.filter(
    (chat) =>
      (chat?.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (chat?.urlId || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Sort chats by timestamp (newest first)
  const sortedChats = allChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Group chats by date
  const groupedChats = binDates(sortedChats);

  const handleDelete = useCallback(async (event: React.UIEvent, item: any) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const { db, deleteById } = await import('~/lib/persistence');

      if (!db) {
        throw new Error('Database not available');
      }

      await deleteById(db, item.id);
      toast.success('Chat deleted successfully');

      // Refresh the chat history
      const persistenceModule = await import('~/lib/persistence');

      if (persistenceModule.db) {
        const list = await persistenceModule.getAll(persistenceModule.db);
        const filteredList = list.filter((item: any) => item.urlId && item.description);
        setChatHistory(filteredList);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('Failed to delete chat');
    }
  }, []);

  return (
    <div className="flex-1 overflow-auto px-3 pb-3">
      <div className="flex items-center justify-between text-sm px-1 py-2">
        <div className="font-medium text-mindvex-elements-textSecondary">Your Chats</div>
      </div>

      {loading ? (
        <div className="px-4 text-gray-500 dark:text-gray-400 text-sm py-2">Loading chats...</div>
      ) : sortedChats.length === 0 ? (
        <div className="px-4 text-gray-500 dark:text-gray-400 text-sm py-2">
          {allChats.length === 0 ? 'No chats yet' : 'No matches found'}
        </div>
      ) : (
        <>
          {groupedChats.map(({ category, items }) => (
            <div key={category} className="mt-2 first:mt-0 space-y-1">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-mindvex-elements-background-depth-1 px-4 py-1">
                {category}
              </div>
              <div className="space-y-0.5 pr-1">
                {items.map((item: any) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    onDelete={(event) => handleDelete(event, item)}
                    onDuplicate={(id) => duplicateCurrentChat(id)}
                    exportChat={exportChat}
                    selectionMode={selectionMode}
                    isSelected={selectedItems.includes(item.id)}
                    onToggleSelection={onToggleSelection}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
