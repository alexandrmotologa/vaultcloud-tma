import React, { useState } from 'react';
import { Folder, FolderInput, X } from 'lucide-react';
import { FolderItem } from '../types/vfs';

interface MoveFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  currentFolderId: string | null;
  onMove: (targetFolderId: string | null) => Promise<void>;
  itemCount: number;
}

export const MoveFolderModal: React.FC<MoveFolderModalProps> = ({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onMove,
  itemCount,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onMove(selectedFolderId);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-vault-card border border-slate-800 rounded-2xl p-5 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Move {itemCount} item{itemCount > 1 ? 's' : ''}</h3>
              <p className="text-[11px] text-slate-400">Select destination directory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 mb-4">
          {/* Root Option */}
          <div
            onClick={() => setSelectedFolderId(null)}
            className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
              selectedFolderId === null
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-semibold'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Folder className="w-4 h-4 text-blue-400" />
            <span>My Drive (Root)</span>
          </div>

          {/* Folder Options */}
          {folders
            .filter((f) => f.id !== currentFolderId)
            .map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-semibold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Folder className="w-4 h-4 text-blue-400 fill-blue-500/20" />
                <span className="truncate">{folder.name}</span>
              </div>
            ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-sm"
          >
            {isSubmitting ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
};
