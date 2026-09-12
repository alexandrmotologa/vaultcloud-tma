import { useState } from 'react';
import { UploadCloud, FolderPlus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDriveState } from './hooks/useDriveState';
import { PassphraseModal } from './components/PassphraseModal';
import { DriveHeader } from './components/DriveHeader';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import { UploadModal } from './components/UploadModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { StorageStatsModal } from './components/StorageStatsModal';
import { RenameModal } from './components/RenameModal';
import { FileItem } from './types/vfs';

export function App() {
  const {
    isUnlocked,
    vaultStatus,
    isLoadingStatus,
    unlockVault,
    lockVault,
    breadcrumbs,
    folders,
    files,
    isLoadingItems,
    navigateToFolder,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    createFolder,
    deleteFolder,
    uploadFile,
    decryptAndDownloadFile,
    toggleStar,
    toggleTrash,
    purgeFile,
    renameFile,
    uploadProgress,
    errorToast,
    successToast,
  } = useDriveState();

  // Modal open states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  // Trigger file download
  const handleDownloadFile = async (file: FileItem) => {
    try {
      const blob = await decryptAndDownloadFile(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Download error:', err);
    }
  };

  if (isLoadingStatus) {
    return (
      <div className="min-h-screen bg-vault-dark flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium">Connecting to VaultCloud relay...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vault-dark text-slate-100 flex flex-col selection:bg-blue-500/30 selection:text-blue-200">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {errorToast && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-500/90 text-white text-xs font-medium shadow-xl flex items-center gap-2 animate-fade-in backdrop-blur-md pointer-events-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorToast}</span>
          </div>
        )}
        {successToast && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-600/90 text-white text-xs font-medium shadow-xl flex items-center gap-2 animate-fade-in backdrop-blur-md pointer-events-auto">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
      </div>

      {/* Master Passphrase Unlock Screen */}
      {!isUnlocked && (
        <PassphraseModal
          vaultStatus={vaultStatus}
          onUnlock={unlockVault}
        />
      )}

      {/* Main Drive Interface */}
      {isUnlocked && (
        <>
          <DriveHeader
            breadcrumbs={breadcrumbs}
            onNavigateFolder={navigateToFolder}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onLockVault={lockVault}
            onOpenStats={() => setIsStatsOpen(true)}
            vaultStatus={vaultStatus}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : viewMode === 'grid' ? (
              <FileGrid
                folders={folders}
                files={files}
                onNavigateFolder={navigateToFolder}
                onPreviewFile={(f) => setPreviewFile(f)}
                onDownloadFile={handleDownloadFile}
                onToggleStar={toggleStar}
                onToggleTrash={toggleTrash}
                onPurgeFile={purgeFile}
                onDeleteFolder={deleteFolder}
                onRenameFile={(id, name) => setRenameTarget({ id, name })}
                isTrashView={activeTab === 'trash'}
              />
            ) : (
              <FileList
                folders={folders}
                files={files}
                onNavigateFolder={navigateToFolder}
                onPreviewFile={(f) => setPreviewFile(f)}
                onDownloadFile={handleDownloadFile}
                onToggleStar={toggleStar}
                onToggleTrash={toggleTrash}
                onPurgeFile={purgeFile}
                isTrashView={activeTab === 'trash'}
              />
            )}
          </main>

          {/* Floating Action Buttons */}
          {activeTab !== 'trash' && (
            <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5">
              <button
                onClick={() => setIsNewFolderOpen(true)}
                title="Create New Folder"
                className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <FolderPlus className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsUploadOpen(true)}
                title="Upload & Encrypt File"
                className="px-4 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
              >
                <UploadCloud className="w-5 h-5" />
                <span>Upload</span>
              </button>
            </div>
          )}

          {/* Modals */}
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            onUploadFile={uploadFile}
            uploadProgress={uploadProgress}
          />

          <CreateFolderModal
            isOpen={isNewFolderOpen}
            onClose={() => setIsNewFolderOpen(false)}
            onCreateFolder={createFolder}
          />

          <FilePreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
            onDecryptAndDownload={decryptAndDownloadFile}
          />

          <StorageStatsModal
            isOpen={isStatsOpen}
            onClose={() => setIsStatsOpen(false)}
            files={files}
            vaultStatus={vaultStatus}
          />

          {renameTarget && (
            <RenameModal
              isOpen={Boolean(renameTarget)}
              onClose={() => setRenameTarget(null)}
              fileId={renameTarget.id}
              currentName={renameTarget.name}
              onRename={renameFile}
            />
          )}
        </>
      )}
    </div>
  );
}
export default App;
