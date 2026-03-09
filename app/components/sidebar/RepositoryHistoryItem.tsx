import { type RepositoryHistoryItem } from '~/lib/stores/repositoryHistory';
import { format } from 'date-fns';
import { useCallback } from 'react';
import { Checkbox } from '~/components/ui/Checkbox';
import { classNames } from '~/utils/classNames';

interface RepositoryHistoryItemProps {
  item: RepositoryHistoryItem;
  onOpenInWorkbench: (item: RepositoryHistoryItem) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export function RepositoryHistoryItemComponent({
  item,
  onOpenInWorkbench,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
}: RepositoryHistoryItemProps) {
  const handleClick = useCallback(() => {
    if (selectionMode) {
      onToggleSelection?.(item.id);
    } else {
      onOpenInWorkbench(item);
    }
  }, [item, selectionMode, onToggleSelection, onOpenInWorkbench]);

  const handleCheckboxChange = useCallback(() => {
    onToggleSelection?.(item.id);
  }, [item.id, onToggleSelection]);

  return (
    <div
      className={classNames(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors group',
        selectionMode ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : 'hover:bg-purple-50 dark:hover:bg-purple-500/10',
        isSelected
          ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
          : 'text-gray-700 dark:text-gray-300',
      )}
      onClick={handleClick}
    >
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onChange={handleCheckboxChange}
          className="mr-1"
          aria-label={`Select ${item.name}`}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300">
          {item.name}
        </div>
        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
          {format(new Date(item.timestamp), 'MMM d, yyyy h:mm a')}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInWorkbench(item);
          }}
          aria-label={`Open ${item.name} in workbench`}
        >
          <span className="i-ph:code-bold w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
