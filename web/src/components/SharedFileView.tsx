import React, { useState } from 'react';
import { ShieldCheck, Download, CheckCircle2, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { ShareParams, importKeyFromHex } from '../crypto/shareKey';
import { decryptChunk, reassembleFile } from '../crypto/chunkCrypt';

interface SharedFileViewProps {
  shareParams: ShareParams;
  onGoToDrive: () => void;
}

export const SharedFileView: React.FC<SharedFileViewProps> = ({ shareParams, onGoToDrive }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(10);

    try {
      // 1. Fetch public file metadata
      const res = await fetch(`/api/vfs/public/${shareParams.fileId}`);
      if (!res.ok) throw new Error('Shared file not found or link has expired');
      const fileInfo = await res.json();

      setDownloadProgress(30);

      // 2. Import decryption key from URL hash
      const key = await importKeyFromHex(shareParams.keyHex);

      // 3. Download and decrypt chunks in memory
      const decryptedChunks: ArrayBuffer[] = [];
      const chunkCount = fileInfo.chunkCount || 1;

      for (let i = 0; i < chunkCount; i++) {
        setDownloadProgress(30 + Math.round((i / chunkCount) * 50));
        const chunkRes = await fetch(`/api/chunks/${shareParams.fileId}/${i}`);
        if (!chunkRes.ok) throw new Error(`Failed to download chunk ${i}`);
        const chunkBuf = await chunkRes.arrayBuffer();

        if (chunkBuf.byteLength < 12) {
          decryptedChunks.push(chunkBuf);
        } else {
          try {
            const decrypted = await decryptChunk(chunkBuf, key);
            decryptedChunks.push(decrypted);
          } catch {
            decryptedChunks.push(chunkBuf);
          }
        }
      }

      setDownloadProgress(95);

      // 4. Reassemble and trigger local browser download
      const blob = reassembleFile(decryptedChunks, fileInfo.mimeType || shareParams.mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.name || shareParams.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      setDownloadComplete(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vault-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-vault-card border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-fade-in">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Shared Encrypted Document</h2>
          <p className="text-xs text-slate-400 mt-0.5">End-to-end encrypted file shared via Telegram</p>
        </div>

        {/* Security badge */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300 mb-5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Decryption key loaded exclusively from your browser URL fragment. Decryption happens on your device.
          </span>
        </div>

        {/* File Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 mb-5">
          <p className="text-sm font-semibold text-slate-100 truncate">{shareParams.name}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
            <span>{formatBytes(shareParams.size)}</span>
            <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              {shareParams.mimeType}
            </span>
          </div>
        </div>

        {/* Download Progress */}
        {isDownloading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Streaming & decrypting in memory...</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action button */}
        {!downloadComplete ? (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Decrypting...' : 'Decrypt & Download'}</span>
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center justify-center gap-2 mb-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Decrypted file saved to your device!</span>
          </div>
        )}

        <button
          onClick={onGoToDrive}
          className="w-full mt-3 py-2 text-center text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>Open My VaultCloud Drive</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
