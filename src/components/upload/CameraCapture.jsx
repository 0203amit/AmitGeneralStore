import { useRef } from 'react';
import { Camera } from 'lucide-react';

/**
 * Camera capture button using the native HTML capture attribute.
 * Triggers the device camera on mobile; falls back to file picker on desktop.
 *
 * @param {{
 *   capture: 'environment'|'user',
 *   onFileSelect: (file: File) => void,
 *   disabled: boolean,
 *   label: string,
 * }} props
 */
export default function CameraCapture({
  capture = 'environment',
  onFileSelect,
  disabled = false,
  label = 'Take Photo',
}) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        capture={capture}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-600 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Camera className="h-4 w-4" />
        {label}
      </button>
    </>
  );
}
