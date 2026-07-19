import { useState, useRef, useCallback } from "react";
import type { DragEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { documentApi, sessionApi, setStoredSessionId } from "../services/api";
import { useSession } from "../context/SessionContext";

/** Document type for each uploaded file */
export type DocumentType = "salary_slip" | "bank_statement" | "";

/** Status of individual file upload */
export type FileUploadStatus = "pending" | "uploading" | "done" | "error";

/** Represents a file in the upload queue with metadata */
export interface UploadFile {
  id: string;
  file: File;
  documentType: DocumentType;
  status: FileUploadStatus;
  error?: string;
}

const MAX_FILE_SIZE = 15_728_640; // 15 MB
const MAX_FILE_COUNT = 5;
const MIN_FILE_COUNT = 1;

/** All accepted MIME types for the file picker */
const ALL_ACCEPTED_MIME = ".pdf,.csv";

/** Generate a unique ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Validates a file based on its assigned document type.
 * Returns an error message or undefined if valid.
 */
export function validateFile(
  file: File,
  documentType: DocumentType,
): string | undefined {
  if (file.size === 0) {
    return "File is empty. Please upload a valid file.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File exceeds maximum size of 15 MB.";
  }

  if (documentType === "salary_slip") {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return "File format not supported. Please upload PDF for salary slips.";
    }
  } else if (documentType === "bank_statement") {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isCsv =
      file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
    if (!isPdf && !isCsv) {
      return "File format not supported. Please upload PDF or CSV for bank statements.";
    }
  }

  return undefined;
}

/** Formats file size in human-readable format. */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setSession } = useSession();

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    setFiles((prev) => {
      const remainingSlots = MAX_FILE_COUNT - prev.length;
      if (remainingSlots <= 0) return prev;
      const filesToAdd = fileArray.slice(0, remainingSlots).map((file) => ({
        id: generateId(),
        file,
        documentType: "" as DocumentType,
        status: "pending" as FileUploadStatus,
      }));
      return [...prev, ...filesToAdd];
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleDocumentTypeChange = useCallback(
    (fileId: string, docType: DocumentType) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          const error = validateFile(f.file, docType);
          return { ...f, documentType: docType, error };
        }),
      );
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (isUploading) return;

    const validated = files.map((f) => ({
      ...f,
      error: validateFile(f.file, f.documentType),
    }));
    setFiles(validated);

    const missingType = validated.some((f) => f.documentType === "");
    if (missingType) return;

    const hasErrors = validated.some((f) => f.error);
    if (hasErrors) return;

    setIsUploading(true);
    setUploadError(null);

    // Mark all files as uploading
    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as FileUploadStatus })),
    );

    try {
      // Always create a fresh session for new uploads
      const session = await sessionApi.create();
      const sessionId = session.id;
      setStoredSessionId(sessionId);
      setSession({ id: sessionId, isDemoActive: false });

      // Upload documents via the centralized API client
      const filesToUpload = validated.map((f) => f.file);
      const documentTypes = validated.map(
        (f) => f.documentType as "salary_slip" | "bank_statement",
      );

      await documentApi.upload(sessionId, filesToUpload, documentTypes);

      // Mark all files as done
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "done" as FileUploadStatus })),
      );
      setUploadComplete(true);

      // Update session context
      setSession({ id: sessionId, isDemoActive: false });

      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch {
      setUploadError("Upload failed. Please try again.");
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as FileUploadStatus })),
      );
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, navigate, setSession]);

  const canUpload =
    files.length >= MIN_FILE_COUNT &&
    files.length <= MAX_FILE_COUNT &&
    files.every((f) => f.documentType !== "" && !f.error) &&
    !isUploading;

  const fileCountError =
    files.length > MAX_FILE_COUNT
      ? `Maximum ${MAX_FILE_COUNT} files allowed per upload.`
      : null;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-neutral-800 mb-2">
        Upload Documents
      </h1>
      <p className="text-neutral-600 mb-6">
        Upload your salary slips (PDF) and bank statements (PDF or CSV) to
        analyze your finances.
      </p>

      {/* Upload Complete State */}
      {uploadComplete && (
        <div
          className="bg-success-50 border border-success-500 rounded-lg p-4 mb-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-success-700 font-medium">
            Documents uploaded successfully! Redirecting to dashboard...
          </p>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div
          className="bg-danger-50 border border-danger-500 rounded-lg p-4 mb-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger-700 font-medium">{uploadError}</p>
        </div>
      )}

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="File upload dropzone. Drag and drop files here or click to browse."
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-primary-500 bg-primary-50"
            : "border-neutral-300 bg-white hover:border-primary-400 hover:bg-neutral-50"
        } ${files.length >= MAX_FILE_COUNT ? "opacity-50 cursor-not-allowed" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={files.length < MAX_FILE_COUNT ? handleBrowseClick : undefined}
        onKeyDown={(e) => {
          if (
            (e.key === "Enter" || e.key === " ") &&
            files.length < MAX_FILE_COUNT
          ) {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-12 h-12 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-neutral-700 font-medium">
            Drag and drop files here, or{" "}
            <span className="text-primary-600 underline">click to browse</span>
          </p>
          <p className="text-sm text-neutral-500">
            PDF for salary slips, PDF or CSV for bank statements. Max 15 MB per
            file.
          </p>
          <p className="text-sm text-neutral-500">
            {files.length}/{MAX_FILE_COUNT} files added
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALL_ACCEPTED_MIME}
          className="hidden"
          onChange={handleFileInput}
          aria-label="Select files to upload"
          disabled={files.length >= MAX_FILE_COUNT}
        />
      </div>

      {/* File Count Error */}
      {fileCountError && (
        <p
          className="text-danger-600 text-sm mt-2"
          role="alert"
          aria-live="assertive"
        >
          {fileCountError}
        </p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3" aria-label="Uploaded files list">
          <h2 className="text-lg font-semibold text-neutral-700">
            Selected Files ({files.length})
          </h2>
          <ul className="space-y-3" role="list">
            {files.map((uploadFile) => (
              <li
                key={uploadFile.id}
                className="bg-white border border-neutral-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-800 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                  </div>

                  {/* Document Type Selector */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`doc-type-${uploadFile.id}`}
                      className="sr-only"
                    >
                      Document type for {uploadFile.file.name}
                    </label>
                    <select
                      id={`doc-type-${uploadFile.id}`}
                      value={uploadFile.documentType}
                      onChange={(e) =>
                        handleDocumentTypeChange(
                          uploadFile.id,
                          e.target.value as DocumentType,
                        )
                      }
                      className="text-sm border border-neutral-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      disabled={isUploading}
                      aria-label={`Select document type for ${uploadFile.file.name}`}
                    >
                      <option value="">Select type...</option>
                      <option value="salary_slip">Salary Slip</option>
                      <option value="bank_statement">Bank Statement</option>
                    </select>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(uploadFile.id)}
                      disabled={isUploading}
                      className="text-neutral-400 hover:text-danger-600 transition-colors p-1 rounded focus:ring-2 focus:ring-primary-500"
                      aria-label={`Remove ${uploadFile.file.name}`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                {uploadFile.status === "uploading" && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-full bg-neutral-200 rounded-full h-2"
                        role="progressbar"
                        aria-label={`Uploading ${uploadFile.file.name}`}
                        aria-valuenow={50}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="bg-primary-500 h-2 rounded-full animate-pulse w-2/3" />
                      </div>
                      <span className="text-xs text-primary-600">
                        Uploading...
                      </span>
                    </div>
                  </div>
                )}
                {uploadFile.status === "done" && (
                  <p className="mt-2 text-sm text-success-600 font-medium">
                    Uploaded
                  </p>
                )}
                {uploadFile.status === "error" && (
                  <p className="mt-2 text-sm text-danger-600 font-medium">
                    Upload failed
                  </p>
                )}

                {/* Validation Error */}
                {uploadFile.error && (
                  <p
                    className="mt-2 text-sm text-danger-600"
                    role="alert"
                    aria-live="polite"
                  >
                    {uploadFile.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            canUpload
              ? "bg-primary-600 hover:bg-primary-700"
              : "bg-neutral-300 cursor-not-allowed"
          }`}
          aria-label="Upload selected documents"
        >
          {isUploading ? "Uploading..." : "Upload Documents"}
        </button>
      </div>

      {/* Upload Progress Summary */}
      {isUploading && (
        <div
          className="mt-4 text-center text-sm text-neutral-600"
          role="status"
          aria-live="polite"
        >
          <p>Processing your documents...</p>
        </div>
      )}
    </div>
  );
}
