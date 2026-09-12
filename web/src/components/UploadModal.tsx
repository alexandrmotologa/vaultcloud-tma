import React, { useRef, useState } from 'react';
import { UploadCloud, X, File, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { UploadProgressItem } from '../types/vfs';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: (file: File) => Promise<void>;
  uploadProgress: UploadProgressItem | null;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadFile,
  uploadProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onUploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      onUploadFile(file);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isProcessing = uploadProgress && uploadProgress.phase !== 'completed' && uploadProgress.phase !== 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-vault-card border border-slate-800 rounded-2xl p-6 shadow-2xl animate-fade-in relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Upload to Vault</h3>
              <p className="text-[11px] text-slate-400">Sliced into 10MB chunks and encrypted locally</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={Boolean(isProcessing)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Zone */}
        {!uploadProgress && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-900/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              Click to select or drag and drop file here
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Any file type supported • Unlimited 2GB Telegram chunks
            </p>
          </div>
        )}

        {/* Progress Tracker */}
        {uploadProgress && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <File className="w-6 h-6 text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {uploadProgress.fileName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatBytes(uploadProgress.totalSize)} • {uploadProgress.chunkCount} chunk(s)
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-300 capitalize flex items-center gap-1.5">
                  {uploadProgress.phase === 'encrypting' && (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                      <span>Encrypting chunk {uploadProgress.currentChunk} of {uploadProgress.chunkCount}...</span>
                    </>
                  )}
                  {uploadProgress.phase === 'uploading' && (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span>Streaming encrypted chunk {uploadProgress.currentChunk}...</span>
                    </>
                  )}
                  {uploadProgress.phase === 'completed' && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Upload Complete!</span>
                    </>
                  )}
                  {uploadProgress.phase === 'error' && (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-400">{uploadProgress.errorMessage || 'Upload failed'}</span>
                    </>
                  )}
                  {uploadProgress.phase === 'slicing' && 'Preparing file chunks...'}
                </span>
                <span className="font-mono text-slate-400">
                  {uploadProgress.progressPercent}%
                </span>
              </div>

              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    uploadProgress.phase === 'error'
                      ? 'bg-rose-500'
                      : uploadProgress.phase === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${uploadProgress.progressPercent}%` }}
                />
              </div>
            </div>

            {uploadProgress.phase === 'completed' && (
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
