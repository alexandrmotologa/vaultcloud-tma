import React, { useState } from 'react';
import { Share2, Copy, Check, X, ShieldCheck, Send } from 'lucide-react';
import { FileItem } from '../types/vfs';
import { exportKeyToHex, buildShareLink } from '../crypto/shareKey';

interface ShareModalProps {
  file: FileItem | null;
  masterKey: CryptoKey | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ file, masterKey, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!file) return null;

  const handleGenerateLink = async () => {
    if (!masterKey) return;
    setIsGenerating(true);
    try {
      // In VaultCloud, we export the key for the share fragment
      const keyHex = await exportKeyToHex(masterKey);
      const url = buildShareLink(
        file.id,
        keyHex,
        file.name,
        file.total_size_bytes,
        file.mime_type
      );
      setShareUrl(url);
    } catch (err) {
      console.error('Error generating share link:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTelegram = () => {
    if (!shareUrl) return;
    const text = encodeURIComponent(`Here is an encrypted file shared via VaultCloud: ${file.name}`);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`;
    window.open(tgUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-vault-card border border-slate-800 rounded-2xl p-6 shadow-2xl animate-fade-in relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Zero-Knowledge Share</h3>
              <p className="text-[11px] text-slate-400">Key is transmitted in URL hash fragment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Alert Banner */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            The encryption key resides exclusively after the <code>#</code> symbol. Telegram servers and relays cannot read or intercept the decryption key.
          </span>
        </div>

        {/* File Overview */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-4">
          <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {(file.total_size_bytes / 1024).toFixed(1)} KB • {file.mime_type}
          </p>
        </div>

        {/* Generate / Share Link */}
        {!shareUrl ? (
          <button
            onClick={handleGenerateLink}
            disabled={isGenerating}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isGenerating ? 'Generating Link...' : 'Create Secure Share Link'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={handleShareTelegram}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share via Telegram</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
