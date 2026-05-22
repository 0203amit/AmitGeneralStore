import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useAuth from '../../hooks/useAuth';
import { buildPageTitle } from '../../config/branding';
import { processImage } from '../../utils/imageProcessor';
import { ensureAppFolder, uploadImage, getImageUrl, deleteImage } from '../../services/driveService';
import ImageDropzone from './ImageDropzone';
import LoadingSpinner from '../shared/LoadingSpinner';
import { CheckCircle, Trash2, FolderOpen, ExternalLink } from 'lucide-react';

/**
 * Temporary test page for verifying Google Drive integration.
 * Drop a single image, upload to Drive, and verify it appears.
 * Remove this page after Phase 3 verification is complete.
 */
export default function DriveTestPage() {
  const { folderIds } = useAuth();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processedBlob, setProcessedBlob] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const [folderCheck, setFolderCheck] = useState(null);
  const [checkingFolders, setCheckingFolders] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = buildPageTitle('Drive Test');
  }, []);

  // Process image when file is selected
  const handleFileSelect = useCallback(async (selectedFile) => {
    setFile(selectedFile);
    setUploadResult(null);
    setDeleted(false);
    setError(null);
    try {
      const { blob, previewUrl: url } = await processImage(selectedFile);
      setProcessedBlob(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(`Image processing failed: ${err.message}`);
    }
  }, []);

  const handleRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setProcessedBlob(null);
    setUploadResult(null);
    setDeleted(false);
    setError(null);
  }, [previewUrl]);

  const handleVerifyFolders = async () => {
    setCheckingFolders(true);
    setError(null);
    try {
      const ids = await ensureAppFolder();
      setFolderCheck(ids);
    } catch (err) {
      setError(`Folder verification failed: ${err.message}`);
    } finally {
      setCheckingFolders(false);
    }
  };

  const handleUpload = async () => {
    if (!processedBlob) return;
    setUploading(true);
    setError(null);
    try {
      const testRecordId = uuidv4();
      const result = await uploadImage(processedBlob, 'bill', testRecordId);
      // Also fetch the URL via getImageUrl to test that function
      const viewUrl = await getImageUrl(result.fileId);
      setUploadResult({ ...result, viewUrl, testRecordId });
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!uploadResult) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteImage(uploadResult.fileId);
      setDeleted(true);
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-slate-900">Drive Integration Test</h1>
      <p className="mt-1 text-sm text-slate-500">
        Temporary page to verify Google Drive uploads work. Remove after testing.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Verify Folders */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <FolderOpen className="h-5 w-5" />
          Step 1: Verify Drive Folders
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Confirm the app folder structure exists in your Google Drive.
        </p>

        {folderIds && (
          <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
            <p className="font-medium">Folders already provisioned at sign-in:</p>
            <p className="mt-1 font-mono text-xs">rootId: {folderIds.rootId}</p>
            <p className="font-mono text-xs">billsId: {folderIds.billsId}</p>
            <p className="font-mono text-xs">paymentsId: {folderIds.paymentsId}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleVerifyFolders}
          disabled={checkingFolders}
          className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {checkingFolders ? <LoadingSpinner size="sm" /> : <FolderOpen className="h-4 w-4" />}
          {checkingFolders ? 'Checking...' : 'Verify Folders'}
        </button>

        {folderCheck && (
          <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
            <p className="font-medium">ensureAppFolder() returned:</p>
            <p className="mt-1 font-mono text-xs">rootId: {folderCheck.rootId}</p>
            <p className="font-mono text-xs">billsId: {folderCheck.billsId}</p>
            <p className="font-mono text-xs">paymentsId: {folderCheck.paymentsId}</p>
          </div>
        )}
      </section>

      {/* Step 2: Select Image */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-800">Step 2: Select an Image</h2>
        <p className="mt-1 text-sm text-slate-500">
          Drop or browse for a single image to test the upload pipeline.
        </p>
        <div className="mt-3 max-w-md">
          <ImageDropzone
            label="Test Image"
            helperText="Any JPG or PNG image for testing"
            captureMode={null}
            file={file}
            previewUrl={previewUrl}
            onFileSelect={handleFileSelect}
            onRemove={handleRemove}
            disabled={uploading}
          />
        </div>
      </section>

      {/* Step 3: Upload */}
      {processedBlob && !uploadResult && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-800">Step 3: Upload to Drive</h2>
          <p className="mt-1 text-sm text-slate-500">
            Processed blob size: {(processedBlob.size / 1024).toFixed(1)} KB
          </p>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="mt-3 flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <LoadingSpinner size="sm" />
                Uploading...
              </>
            ) : (
              'Upload to Drive'
            )}
          </button>
        </section>
      )}

      {/* Step 4: Results */}
      {uploadResult && (
        <section className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-green-800">
            <CheckCircle className="h-5 w-5" />
            Upload Successful
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              <span className="font-medium text-slate-700">File ID:</span>{' '}
              <span className="font-mono text-xs">{uploadResult.fileId}</span>
            </p>
            <p>
              <span className="font-medium text-slate-700">Record ID:</span>{' '}
              <span className="font-mono text-xs">{uploadResult.testRecordId}</span>
            </p>
            <p>
              <span className="font-medium text-slate-700">webViewLink:</span>{' '}
              <a
                href={uploadResult.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 underline hover:text-indigo-800"
              >
                Open in Drive <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
            <p>
              <span className="font-medium text-slate-700">getImageUrl result:</span>{' '}
              <a
                href={uploadResult.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 underline hover:text-indigo-800"
              >
                Open via getImageUrl <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>

          {/* Delete test file */}
          {!deleted ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="mt-4 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Test File
                </>
              )}
            </button>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle className="h-4 w-4" />
              Test file deleted from Drive.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
