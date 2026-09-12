import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Eye, EyeOff, Sparkles, Download } from 'lucide-react';
import { evaluatePassphraseStrength } from '../crypto/keyDerivation';
import { exportVaultKeyfile } from '../crypto/keyBackup';
import { VaultStatusResponse } from '../types/vfs';

interface PassphraseModalProps {
  vaultStatus: VaultStatusResponse | null;
  onUnlock: (passphrase: string) => Promise<boolean>;
}

export const PassphraseModal: React.FC<PassphraseModalProps> = ({ vaultStatus, onUnlock }) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isExistingVault = Boolean(vaultStatus?.hasVault);
  const strength = evaluatePassphraseStrength(passphrase);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!passphrase.trim()) {
      setLocalError('Please enter a master passphrase.');
      return;
    }

    if (!isExistingVault) {
      if (passphrase.length < 8) {
        setLocalError('Passphrase must be at least 8 characters.');
        return;
      }
      if (passphrase !== confirmPassphrase) {
        setLocalError('Passphrases do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    const success = await onUnlock(passphrase);
    setIsSubmitting(false);

    if (!success && isExistingVault) {
      setLocalError('Failed to unlock. Incorrect passphrase or corrupted token.');
    }
  };

  const handleUseDemoPassphrase = () => {
    setPassphrase('DemoPassword123!');
    setConfirmPassphrase('DemoPassword123!');
    setLocalError(null);
  };

  const handleDownloadBackup = () => {
    if (vaultStatus?.saltHex && vaultStatus.verificationCipherHex) {
      exportVaultKeyfile(vaultStatus.saltHex, vaultStatus.verificationCipherHex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-vault-card border border-slate-800/80 rounded-2xl p-6 shadow-2xl animate-fade-in relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Vault Icon and Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {isExistingVault ? 'Unlock Encrypted Vault' : 'Create Master Key'}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                AES-GCM-256
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isExistingVault
                ? 'Enter your master passphrase to derive your encryption key.'
                : 'Choose a strong master passphrase. Zero-knowledge guarantee.'}
            </p>
          </div>
        </div>

        {/* Security Alert Banner */}
        <div className="mb-5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Plaintext files and passphrases never touch Telegram or our server unencrypted. The master key stays in local memory.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Master Passphrase</span>
              {vaultStatus?.demoMode && (
                <button
                  type="button"
                  onClick={handleUseDemoPassphrase}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline text-[11px]"
                >
                  <Sparkles className="w-3 h-3" /> Fill Demo Password
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={isExistingVault ? 'Enter passphrase...' : 'Create strong passphrase...'}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Passphrase Strength Bar */}
            {!isExistingVault && passphrase && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-transparent'}`} />
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-transparent'}`} />
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-transparent'}`} />
                  <div className={`h-full flex-1 rounded-full ${strength.score >= 4 ? strength.color : 'bg-transparent'}`} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Strength: <strong className="text-slate-200">{strength.label}</strong></span>
                  <span>PBKDF2 100,000 iters</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Passphrase for new vaults */}
          {!isExistingVault && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm Master Passphrase
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Repeat passphrase..."
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
              />
            </div>
          )}

          {/* Error display */}
          {localError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              {localError}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>{isExistingVault ? 'Unlock Vault' : 'Initialize & Unlock'}</span>
              </>
            )}
          </button>
        </form>

        {/* Export Backup Option */}
        {isExistingVault && vaultStatus?.saltHex && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Have key credentials?</span>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="text-slate-300 hover:text-white flex items-center gap-1.5 hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Download Keyfile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
