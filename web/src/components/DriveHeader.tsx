import React from 'react';
import {
  ShieldCheck,
  ChevronRight,
  Search,
  X,
  LayoutGrid,
  List,
  Lock,
  Star,
  Trash2,
  PieChart,
  Folder,
  Archive,
  KeyRound,
} from 'lucide-react';
import { BreadcrumbItem, VaultStatusResponse } from '../types/vfs';

interface DriveHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigateFolder: (folderId: string | null) => void;
  activeTab: 'all' | 'starred' | 'trash';
  setActiveTab: (tab: 'all' | 'starred' | 'trash') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onLockVault: () => void;
  onOpenStats: () => void;
  vaultStatus: VaultStatusResponse | null;
  onOpenPinModal?: () => void;
  onExportVault?: () => void;
  hasPin?: boolean;
}

export const DriveHeader: React.FC<DriveHeaderProps> = ({
  breadcrumbs,
  onNavigateFolder,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  onLockVault,
  onOpenStats,
  vaultStatus,
  onOpenPinModal,
  onExportVault,
  hasPin,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <header className="sticky top-0 z-30 bg-vault-dark/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      {/* Top row: Brand & Status & Quick Actions */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                VaultCloud
              </h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                TMA
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5 flex items-center gap-1.5">
              <span>Zero-Knowledge Drive</span>
              <span>•</span>
              <span className="text-emerald-400">
                {formatBytes(vaultStatus?.stats.totalSizeBytes || 0)} used
              </span>
            </p>
          </div>
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-1.5">
          {/* Export Full Vault */}
          {onExportVault && (
            <button
              onClick={onExportVault}
              title="Full Vault Export (Disaster Recovery ZIP)"
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}

          {/* PIN Lock Configuration */}
          {onOpenPinModal && (
            <button
              onClick={onOpenPinModal}
              title={hasPin ? "Quick PIN Lock configured" : "Configure Quick PIN"}
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors relative"
            >
              <KeyRound className="w-4 h-4" />
              {hasPin && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1 right-1" />
              )}
            </button>
          )}

          {/* Storage stats */}
          <button
            onClick={onOpenStats}
            title="Storage Breakdown"
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            <PieChart className="w-4 h-4" />
          </button>

          {/* View toggle (grid / list) */}
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title={viewMode === 'grid' ? 'Switch to List' : 'Switch to Grid'}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>

          {/* Lock Vault */}
          <button
            onClick={onLockVault}
            title="Lock Vault"
            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors flex items-center gap-1 text-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </div>

      {/* Middle row: Search Bar */}
      <div className="relative mb-2.5">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search encrypted files..."
          className="w-full pl-9 pr-9 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bottom row: Filter Tabs & Breadcrumb trail */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900/80 rounded-lg border border-slate-800/80 self-start">
          <button
            onClick={() => {
              setActiveTab('all');
              setSearchQuery('');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => {
              setActiveTab('starred');
              setSearchQuery('');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
              activeTab === 'starred'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3" />
            <span>Starred</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('trash');
              setSearchQuery('');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
              activeTab === 'trash'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>Trash</span>
          </button>
        </div>

        {/* Breadcrumb Trail */}
        {activeTab === 'all' && !searchQuery && (
          <nav className="flex items-center gap-1 text-xs overflow-x-auto py-0.5 text-slate-400">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id || 'root'}>
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                  <button
                    onClick={() => onNavigateFolder(crumb.id)}
                    className={`flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-slate-800/60 transition-colors ${
                      isLast ? 'text-blue-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {idx === 0 && <Folder className="w-3 h-3" />}
                    <span>{crumb.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};
