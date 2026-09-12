import React from 'react';
import { Download, Star, Trash2, X, Archive, FolderInput } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDownloadZip: () => void;
  onBatchStar: () => void;
  onBatchTrash: () => void;
  onOpenBatchMove: () => void;
  isDownloadingZip: boolean;
  isTrashView: boolean;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onClearSelection,
  onDownloadZip,
  onBatchStar,
  onBatchTrash,
  onOpenBatchMove,
  isDownloadingZip,
  isTrashView,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-fade-in">
      <div className="glass-panel bg-slate-900/95 border border-blue-500/30 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 pl-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-slate-200 hidden sm:inline">
            selected
          </span>
          <button
            onClick={onClearSelection}
            className="p-1 text-slate-400 hover:text-white"
            title="Clear Selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {!isTrashView && (
            <>
              {/* Download as ZIP */}
              <button
                onClick={onDownloadZip}
                disabled={isDownloadingZip}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                title="Download selected as decrypted ZIP archive"
              >
                {isDownloadingZip ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>ZIP</span>
              </button>

              {/* Move */}
              <button
                onClick={onOpenBatchMove}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Move to Folder"
              >
                <FolderInput className="w-4 h-4" />
              </button>

              {/* Star */}
              <button
                onClick={onBatchStar}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                title="Star Selected"
              >
                <Star className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Trash or Purge */}
          <button
            onClick={onBatchTrash}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
            title={isTrashView ? 'Delete Selected Permanently' : 'Move Selected to Trash'}
          >
            {isTrashView ? <Trash2 className="w-4 h-4" /> : <Download className="w-4 h-4 rotate-180" />}
          </button>
        </div>
      </div>
    </div>
  );
};
