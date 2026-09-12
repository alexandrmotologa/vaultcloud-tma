import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  File as GenericFile,
  MoreVertical,
  Star,
  Trash2,
  Download,
  Eye,
  Edit2,
  RotateCcw,
  Share2,
  Edit3,
  CheckSquare,
  Square,
} from 'lucide-react';
import { FolderItem, FileItem } from '../types/vfs';
import { decryptThumbnail } from '../crypto/thumbnail';

interface FileGridProps {
  folders: FolderItem[];
  files: FileItem[];
  masterKey: CryptoKey | null;
  onNavigateFolder: (folderId: string) => void;
  onPreviewFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onShareFile: (file: FileItem) => void;
  onEditNote: (file: FileItem) => void;
  onToggleStar: (fileId: string, currentStarred: number) => void;
  onToggleTrash: (fileId: string, currentTrash: number) => void;
  onPurgeFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFile: (fileId: string, currentName: string) => void;
  isTrashView: boolean;
  selectedFileIds: string[];
  onToggleSelectFile: (fileId: string) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  masterKey,
  onNavigateFolder,
  onPreviewFile,
  onDownloadFile,
  onShareFile,
  onEditNote,
  onToggleStar,
  onToggleTrash,
  onPurgeFile,
  onDeleteFolder,
  onRenameFile,
  isTrashView,
  selectedFileIds,
  onToggleSelectFile,
}) => {
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  // Decrypt image thumbnails in memory
  useEffect(() => {
    if (!masterKey) return;

    files.forEach(async (file) => {
      if (file.thumbnail_cipher_hex && !thumbnailUrls[file.id]) {
        try {
          const url = await decryptThumbnail(file.thumbnail_cipher_hex, masterKey);
          setThumbnailUrls((prev) => ({ ...prev, [file.id]: url }));
        } catch {
          // Thumbnail decryption fallback
        }
      }
    });

    return () => {
      // Revoke any created URLs on unmount
      Object.values(thumbnailUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files, masterKey]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: FileItem) => {
    // If decrypted thumbnail is available in memory
    if (thumbnailUrls[file.id]) {
      return (
        <img
          src={thumbnailUrls[file.id]}
          alt={file.name}
          className="w-full h-full object-cover rounded-xl"
        />
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (file.mime_type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <FileImage className="w-8 h-8 text-cyan-400" />;
    }
    if (file.mime_type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      return <FileAudio className="w-8 h-8 text-emerald-400" />;
    }
    if (file.mime_type.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)) {
      return <FileVideo className="w-8 h-8 text-purple-400" />;
    }
    if (file.mime_type === 'application/pdf' || ext === 'pdf') {
      return <FileText className="w-8 h-8 text-rose-400" />;
    }
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
      return <FileArchive className="w-8 h-8 text-amber-400" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'json', 'py'].includes(ext)) {
      return <FileCode className="w-8 h-8 text-blue-400" />;
    }
    return <GenericFile className="w-8 h-8 text-slate-400" />;
  };

  const isNoteFile = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return ['md', 'txt', 'markdown'].includes(ext);
  };

  const hasItems = folders.length > 0 || files.length > 0;
  const isMultiSelecting = selectedFileIds.length > 0;

  if (!hasItems) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
          {isTrashView ? <Trash2 className="w-8 h-8" /> : <Folder className="w-8 h-8" />}
        </div>
        <h3 className="text-sm font-semibold text-slate-300">
          {isTrashView ? 'Recycle bin is empty' : 'This folder is empty'}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          {isTrashView
            ? 'Deleted files will show up here before permanent removal.'
            : 'Upload encrypted documents, write a note, or create a folder.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Folders Section */}
      {!isTrashView && folders.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2.5">
            Folders ({folders.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group relative bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer shadow-sm hover:shadow"
                onClick={() => onNavigateFolder(folder.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Folder className="w-5 h-5 fill-blue-500/20" />
                  </div>
                  <span className="text-xs font-medium text-slate-200 truncate group-hover:text-white">
                    {folder.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuFolderId(activeMenuFolderId === folder.id ? null : folder.id);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Folder Dropdown */}
                {activeMenuFolderId === folder.id && (
                  <div
                    className="absolute right-2 top-10 z-40 w-36 glass-dropdown rounded-xl shadow-xl py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        onDeleteFolder(folder.id);
                        setActiveMenuFolderId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Folder
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2.5">
            Files ({files.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map((file) => {
              const isSelected = selectedFileIds.includes(file.id);

              return (
                <div
                  key={file.id}
                  className={`group relative bg-vault-card hover:bg-vault-cardHover border rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => {
                    if (isMultiSelecting) {
                      onToggleSelectFile(file.id);
                    } else {
                      onPreviewFile(file);
                    }
                  }}
                >
                  {/* Top Bar: Checkbox / Star & Menu */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelectFile(file.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isSelected || isMultiSelecting
                            ? 'text-blue-400'
                            : 'text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 fill-blue-500/20" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      {/* Star button */}
                      {!isTrashView && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(file.id, file.is_starred);
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            file.is_starred
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${file.is_starred ? 'fill-amber-400' : ''}`} />
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuFileId(activeMenuFileId === file.id ? null : file.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuFileId === file.id && (
                        <div
                          className="absolute right-0 top-7 z-40 w-44 glass-dropdown rounded-xl shadow-xl py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isTrashView ? (
                            <>
                              <button
                                onClick={() => {
                                  onPreviewFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-400" /> Preview
                              </button>

                              {isNoteFile(file.name) && (
                                <button
                                  onClick={() => {
                                    onEditNote(file);
                                    setActiveMenuFileId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-cyan-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-cyan-400" /> Edit Note
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  onShareFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Share2 className="w-3.5 h-3.5 text-sky-400" /> Share Link (#key)
                              </button>

                              <button
                                onClick={() => {
                                  onDownloadFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-400" /> Download
                              </button>

                              <button
                                onClick={() => {
                                  onRenameFile(file.id, file.name);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Rename
                              </button>

                              <div className="border-t border-slate-800 my-1" />

                              <button
                                onClick={() => {
                                  onToggleTrash(file.id, file.is_trash);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  onToggleTrash(file.id, file.is_trash);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => {
                                  onPurgeFile(file.id);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Forever
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Centered Thumbnail / Type Icon */}
                  <div className="flex items-center justify-center py-2.5 h-20 overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
                      {getFileIcon(file)}
                    </div>
                  </div>

                  {/* File Details */}
                  <div className="mt-2 min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                      {file.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{formatBytes(file.total_size_bytes)}</span>
                      <span className="font-mono bg-slate-800 px-1 py-0.5 rounded text-[9px]">
                        {file.chunk_count > 1 ? `${file.chunk_count} chunks` : '1 chunk'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
