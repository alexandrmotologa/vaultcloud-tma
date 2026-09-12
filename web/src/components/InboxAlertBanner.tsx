import React from 'react';
import { Inbox, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';

interface InboxAlertBannerProps {
  pendingCount: number;
  onEncryptInbox: () => Promise<void>;
  isEncrypting: boolean;
}

export const InboxAlertBanner: React.FC<InboxAlertBannerProps> = ({
  pendingCount,
  onEncryptInbox,
  isEncrypting,
}) => {
  if (pendingCount <= 0) return null;

  return (
    <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <Inbox className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>{pendingCount} file{pendingCount > 1 ? 's' : ''} received in Telegram Inbox</span>
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            Unencrypted files dropped into Telegram bot chat. Click to encrypt with your master key.
          </p>
        </div>
      </div>

      <button
        onClick={onEncryptInbox}
        disabled={isEncrypting}
        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95"
      >
        {isEncrypting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Encrypting...</span>
          </>
        ) : (
          <>
            <span>Encrypt & Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </div>
  );
};
