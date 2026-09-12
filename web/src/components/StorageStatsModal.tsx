import React from 'react';
import { X, PieChart, ShieldCheck, HardDrive, Infinity as InfinityIcon } from 'lucide-react';
import { FileItem, VaultStatusResponse } from '../types/vfs';

interface StorageStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  vaultStatus: VaultStatusResponse | null;
}

export const StorageStatsModal: React.FC<StorageStatsModalProps> = ({
  isOpen,
  onClose,
  files,
  vaultStatus,
}) => {
  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Group by category
  let docsBytes = 0;
  let imgBytes = 0;
  let mediaBytes = 0;
  let archiveBytes = 0;
  let otherBytes = 0;

  files.forEach((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (f.mime_type.startsWith('image/') || ['jpg', 'png', 'webp', 'svg'].includes(ext)) {
      imgBytes += f.total_size_bytes;
    } else if (f.mime_type.startsWith('audio/') || f.mime_type.startsWith('video/') || ['mp3', 'mp4', 'wav'].includes(ext)) {
      mediaBytes += f.total_size_bytes;
    } else if (f.mime_type.includes('pdf') || f.mime_type.startsWith('text/') || ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      docsBytes += f.total_size_bytes;
    } else if (f.mime_type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      archiveBytes += f.total_size_bytes;
    } else {
      otherBytes += f.total_size_bytes;
    }
  });

  const totalBytes = vaultStatus?.stats.totalSizeBytes || 1;
  const getPercent = (b: number) => Math.max(2, Math.round((b / Math.max(1, totalBytes)) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-vault-card border border-slate-800 rounded-2xl p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Vault Storage Usage</h3>
              <p className="text-[11px] text-slate-400">Encrypted personal cloud quota</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Storage Card */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-cyan-400" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Used Space
              </p>
              <h4 className="text-lg font-bold text-white">
                {formatBytes(vaultStatus?.stats.totalSizeBytes || 0)}
              </h4>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Telegram Quota
            </p>
            <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm justify-end">
              <InfinityIcon className="w-4 h-4" /> Unlimited
            </div>
          </div>
        </div>

        {/* Stacked Storage Bar */}
        <div className="space-y-2 mb-5">
          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
            <div style={{ width: `${getPercent(docsBytes)}%` }} className="bg-rose-500 rounded-l-full" title="Documents" />
            <div style={{ width: `${getPercent(imgBytes)}%` }} className="bg-cyan-500" title="Images" />
            <div style={{ width: `${getPercent(mediaBytes)}%` }} className="bg-purple-500" title="Media" />
            <div style={{ width: `${getPercent(archiveBytes)}%` }} className="bg-amber-500" title="Archives" />
            <div style={{ width: `${getPercent(otherBytes)}%` }} className="bg-slate-500 rounded-r-full" title="Other" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-300">Docs: {formatBytes(docsBytes)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
              <span className="text-slate-300">Images: {formatBytes(imgBytes)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              <span className="text-slate-300">Media: {formatBytes(mediaBytes)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-300">Archives: {formatBytes(archiveBytes)}</span>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Every byte is encrypted on-device before storage.</span>
        </div>
      </div>
    </div>
  );
};
