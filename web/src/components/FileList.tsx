import React from 'react';
import {
  Folder,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  File as GenericFile,
  Star,
  Trash2,
  Download,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { FolderItem, FileItem } from '../types/vfs';

interface FileListProps {
  folders: FolderItem[];
  files: FileItem[];
  onNavigateFolder: (folderId: string) => void;
  onPreviewFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onToggleStar: (fileId: string, currentStarred: number) => void;
  onToggleTrash: (fileId: string, currentTrash: number) => void;
  onPurgeFile: (fileId: string) => void;
  isTrashView: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  folders,
  files,
  onNavigateFolder,
  onPreviewFile,
  onDownloadFile,
  onToggleStar,
  onToggleTrash,
  onPurgeFile,
  isTrashView,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getFileIcon = (mimeType: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';

    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <FileImage className="w-4 h-4 text-cyan-400" />;
    }
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) {
      return <FileAudio className="w-4 h-4 text-emerald-400" />;
    }
    if (mimeType.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)) {
      return <FileVideo className="w-4 h-4 text-purple-400" />;
    }
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-400" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'json', 'py'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-blue-400" />;
    }
    return <GenericFile className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="bg-vault-card border border-slate-800 rounded-2xl overflow-hidden pb-16">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3 hidden sm:table-cell">Size</th>
              <th className="py-2.5 px-3 hidden md:table-cell">Chunks</th>
              <th className="py-2.5 px-3 hidden sm:table-cell">Modified</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {/* Folders */}
            {!isTrashView &&
              folders.map((folder) => (
                <tr
                  key={folder.id}
                  onClick={() => onNavigateFolder(folder.id)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 flex items-center gap-2.5 font-medium text-slate-200">
                    <Folder className="w-4 h-4 text-blue-400 fill-blue-500/20 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-xs">{folder.name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 hidden sm:table-cell">—</td>
                  <td className="py-2.5 px-3 text-slate-500 hidden md:table-cell">—</td>
                  <td className="py-2.5 px-3 text-slate-400 hidden sm:table-cell">
                    {formatDate(folder.created_at)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-[11px] text-blue-400">Open &rarr;</span>
                  </td>
                </tr>
              ))}

            {/* Files */}
            {files.map((file) => (
              <tr
                key={file.id}
                className="hover:bg-slate-800/40 transition-colors"
              >
                <td
                  onClick={() => onPreviewFile(file)}
                  className="py-2.5 px-3 flex items-center gap-2.5 font-medium text-slate-200 cursor-pointer"
                >
                  {getFileIcon(file.mime_type, file.name)}
                  <span className="truncate max-w-[180px] sm:max-w-xs">{file.name}</span>
                </td>
                <td className="py-2.5 px-3 text-slate-400 hidden sm:table-cell">
                  {formatBytes(file.total_size_bytes)}
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-400 hidden md:table-cell">
                  {file.chunk_count}
                </td>
                <td className="py-2.5 px-3 text-slate-400 hidden sm:table-cell">
                  {formatDate(file.updated_at)}
                </td>
                <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                  {!isTrashView ? (
                    <>
                      <button
                        onClick={() => onToggleStar(file.id, file.is_starred)}
                        className={`p-1 rounded hover:bg-slate-700/50 ${
                          file.is_starred ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                        }`}
                        title="Star"
                      >
                        <Star className={`w-3.5 h-3.5 ${file.is_starred ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => onPreviewFile(file)}
                        className="p-1 rounded text-blue-400 hover:bg-slate-700/50"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDownloadFile(file)}
                        className="p-1 rounded text-emerald-400 hover:bg-slate-700/50"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleTrash(file.id, file.is_trash)}
                        className="p-1 rounded text-rose-400 hover:bg-slate-700/50"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onToggleTrash(file.id, file.is_trash)}
                        className="p-1 rounded text-emerald-400 hover:bg-slate-700/50"
                        title="Restore"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onPurgeFile(file.id)}
                        className="p-1 rounded text-rose-400 hover:bg-slate-700/50"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
