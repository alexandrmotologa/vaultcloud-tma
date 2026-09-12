import React, { useState } from 'react';
import { FileEdit, X, Save, Eye, Edit3, ShieldCheck } from 'lucide-react';

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (title: string, content: string, existingFileId?: string) => Promise<void>;
  initialTitle?: string;
  initialContent?: string;
  existingFileId?: string;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  onClose,
  onSaveNote,
  initialTitle = '',
  initialContent = '',
  existingFileId,
}) => {
  const [title, setTitle] = useState(initialTitle || 'Untitled Note');
  const [content, setContent] = useState(initialContent || '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    let finalTitle = title.trim();
    if (!finalTitle.endsWith('.md') && !finalTitle.endsWith('.txt')) {
      finalTitle += '.md';
    }
    await onSaveNote(finalTitle, content, existingFileId);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl h-[85vh] bg-vault-card border border-slate-800 rounded-2xl flex flex-col shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <FileEdit className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="bg-transparent text-sm font-bold text-white focus:outline-none w-full placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mode toggle */}
            <div className="flex items-center p-0.5 bg-slate-800 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
                  mode === 'edit' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span className="hidden sm:inline">Write</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
                  mode === 'preview' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Encrypting...' : 'Save'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Note body */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col bg-slate-950/40">
          {mode === 'edit' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your encrypted notes in Markdown format..."
              autoFocus
              className="w-full flex-1 p-3 bg-transparent text-xs font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none select-text"
            />
          ) : (
            <div className="flex-1 overflow-auto p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap font-sans select-text">
              {content ? content : <span className="text-slate-500 italic">No content to preview</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Encrypted with AES-GCM-256 upon saving</span>
          </span>
          <span>{content.length} characters</span>
        </div>
      </div>
    </div>
  );
};
