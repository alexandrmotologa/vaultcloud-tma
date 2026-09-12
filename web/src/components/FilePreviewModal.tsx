import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  ShieldCheck,
  FileText,
  Copy,
  Check,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FileItem } from '../types/vfs';

interface FilePreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
  onDecryptAndDownload: (file: FileItem) => Promise<Blob>;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDecryptAndDownload,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    if (!file) return;

    let active = true;
    setIsLoading(true);
    setError(null);
    setBlobUrl(null);
    setDecryptedBlob(null);
    setTextContent(null);
    setZoomLevel(1);

    onDecryptAndDownload(file)
      .then(async (blob) => {
        if (!active) return;
        setDecryptedBlob(blob);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // If text, json, or markdown, read as text
        const isText =
          file.mime_type.startsWith('text/') ||
          file.mime_type.includes('json') ||
          file.mime_type.includes('javascript') ||
          file.mime_type.includes('xml') ||
          ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'py', 'csv'].includes(
            file.name.split('.').pop()?.toLowerCase() || ''
          );

        if (isText) {
          try {
            const text = await blob.text();
            if (active) setTextContent(text);
          } catch {
            // Text read fallback
          }
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Decryption failed';
        setError(msg);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file, onDecryptAndDownload]);

  if (!file) return null;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = file.mime_type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isAudio = file.mime_type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext);
  const isVideo = file.mime_type.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
  const isPdf = file.mime_type === 'application/pdf' || ext === 'pdf';

  const handleSaveToDisk = () => {
    if (!decryptedBlob || !blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[90vh] bg-vault-card border border-slate-800 rounded-2xl flex flex-col shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{file.name}</h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>In-memory decrypted preview</span>
                <span>•</span>
                <span className="font-mono">{file.mime_type}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {blobUrl && (
              <button
                onClick={handleSaveToDisk}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center min-h-[250px] relative bg-slate-950/40">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <div className="text-xs font-medium text-slate-300">
                Fetching chunks & decrypting AES-GCM-256 payload...
              </div>
              <div className="text-[10px] text-slate-500">
                Verifying SHA-256 checksums in memory
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center max-w-md">
              <p className="text-xs font-semibold text-rose-400">Decryption error</p>
              <p className="text-[11px] text-slate-400 mt-1">{error}</p>
            </div>
          )}

          {!isLoading && !error && blobUrl && (
            <>
              {/* Image Preview */}
              {isImage && (
                <div className="relative max-w-full max-h-full flex flex-col items-center">
                  <div className="overflow-auto max-h-[60vh] rounded-lg">
                    <img
                      src={blobUrl}
                      alt={file.name}
                      style={{ transform: `scale(${zoomLevel})` }}
                      className="max-h-[55vh] w-auto object-contain rounded-lg transition-transform duration-200"
                    />
                  </div>
                  {/* Zoom controls */}
                  <div className="flex items-center gap-2 mt-3 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-full text-xs text-slate-300">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      className="p-1 hover:text-white"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px]">{Math.round(zoomLevel * 100)}%</span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      className="p-1 hover:text-white"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Preview */}
              {isAudio && (
                <div className="w-full max-w-md p-6 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-4">{file.name}</h4>
                  <audio controls src={blobUrl} className="w-full" autoPlay />
                </div>
              )}

              {/* Video Preview */}
              {isVideo && (
                <div className="w-full max-w-2xl">
                  <video
                    controls
                    src={blobUrl}
                    className="w-full max-h-[60vh] rounded-xl border border-slate-800"
                    autoPlay
                  />
                </div>
              )}

              {/* PDF Preview */}
              {isPdf && (
                <div className="w-full h-[60vh] flex flex-col items-center">
                  <iframe
                    src={blobUrl}
                    title={file.name}
                    className="w-full h-full rounded-xl border border-slate-800 bg-white"
                  />
                </div>
              )}

              {/* Text / Markdown / Code Preview */}
              {textContent !== null && !isImage && !isAudio && !isVideo && !isPdf && (
                <div className="w-full flex flex-col h-[55vh]">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-t-xl text-xs text-slate-400">
                    <span>Decrypted Document View</span>
                    <button
                      onClick={handleCopyText}
                      className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy Text'}</span>
                    </button>
                  </div>
                  <pre className="flex-1 p-4 bg-slate-900/60 border-x border-b border-slate-800 rounded-b-xl overflow-auto text-xs font-mono text-slate-200 whitespace-pre-wrap select-text">
                    {textContent}
                  </pre>
                </div>
              )}

              {/* Generic Binary Fallback */}
              {!isImage && !isAudio && !isVideo && !isPdf && textContent === null && (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">
                    Preview not supported for this format
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Decrypted binary blob is ready for local download.
                  </p>
                  <button
                    onClick={handleSaveToDisk}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Download Decrypted File
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
