const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.txt']);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; /**
 * Validates an uploaded File against size, MIME type, and filename extension constraints.
 *
 * @param file - The uploaded file to validate
 * @returns An object with `valid: true` when the file meets the constraints, or `valid: false` and an `error` message explaining the first failed check
 */

export function validateUploadedFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File exceeds 25MB limit (got ${(file.size / 1024 / 1024).toFixed(1)}MB)` };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: `File type '${file.type}' is not allowed` };
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File extension '${ext}' is not allowed` };
  }

  return { valid: true };
}