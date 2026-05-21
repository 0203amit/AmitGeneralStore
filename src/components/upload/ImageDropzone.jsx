import { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, RefreshCw } from 'lucide-react';
import { validateImageFile } from '../../utils/imageProcessor';
import CameraCapture from './CameraCapture';

/**
 * Image selection component supporting drag-and-drop, file browse,
 * and optional camera capture. Shows a preview when a file is selected.
 *
 * @param {{
 *   label: string,
 *   helperText: string,
 *   captureMode: 'environment'|'user'|null,
 *   file: File|null,
 *   previewUrl: string|null,
 *   onFileSelect: (file: File) => void,
 *   onRemove: () => void,
 *   disabled: boolean,
 *   error: string|null,
 * }} props
 */
export default function ImageDropzone({
  label,
  helperText,
  captureMode = null,
  file,
  previewUrl,
  onFileSelect,
  onRemove,
  disabled = false,
  error = null,
}) {
  const replaceInputRef = useRef(null);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const selected = acceptedFiles[0];
      const validation = validateImageFile(selected);
      if (!validation.valid) return; // Dropzone config already filters
      onFileSelect(selected);
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif'],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    disabled,
  });

  const handleReplaceChange = (e) => {
    const newFile = e.target.files?.[0];
    if (newFile) {
      onFileSelect(newFile);
      e.target.value = '';
    }
  };

  // Preview state: show image with Replace/Remove actions
  if (previewUrl) {
    return (
      <div className="rounded-lg border-2 border-indigo-200 bg-white p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
        <img
          src={previewUrl}
          alt={`${label} preview`}
          className="max-h-64 w-full rounded object-contain bg-slate-50"
        />
        <div className="mt-2 flex gap-2">
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            onChange={handleReplaceChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      </div>
    );
  }

  // Empty state: show dropzone + optional camera button
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>

      {/* Camera capture button (shown first for bill zone) */}
      {captureMode && (
        <CameraCapture
          capture={captureMode}
          onFileSelect={onFileSelect}
          disabled={disabled}
          label="Take Photo"
        />
      )}

      {/* Drag-and-drop / browse zone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-300'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-500">
          {isDragActive ? 'Drop image here' : 'Drag & drop or tap to browse'}
        </p>
        <p className="mt-1 text-xs text-slate-400">JPG, PNG up to 10 MB</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">{helperText}</p>
    </div>
  );
}
