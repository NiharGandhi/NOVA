import pdf from 'pdf-parse-fork';
import mammoth from 'mammoth';

export interface DocumentChunk {
  text: string;
  index: number;
  pageNumber?: number;
  metadata?: Record<string, any>;
}

export interface ProcessedDocument {
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    fileName: string;
    fileType: string;
    totalPages?: number;
    totalChunks: number;
  };
}

// Constants for memory management
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
const MAX_CHUNKS_PER_DOCUMENT = 500; // Increased from 10 to allow proper chunking

// Chunk text into smaller pieces for better retrieval
export function chunkText(text: string, chunkSize: number = MAX_CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  // Clean and normalize text
  text = text.replace(/\s+/g, ' ').trim();

  // Early return if text is empty
  if (!text) {
    return chunks;
  }

  // Use the specified chunk size
  const optimalChunkSize = chunkSize;

  while (startIndex < text.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    const endIndex = Math.min(startIndex + optimalChunkSize, text.length);
    let chunkText = text.slice(startIndex, endIndex).trim();

    // Try to end at a sentence boundary
    const lastPeriod = chunkText.lastIndexOf('.');
    if (lastPeriod > optimalChunkSize * 0.7) { // Only adjust if period is found in latter part
      chunkText = chunkText.slice(0, lastPeriod + 1);
    }

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        metadata: {
          startChar: startIndex,
          endChar: startIndex + chunkText.length
        }
      });
      chunkIndex++;
    }

    startIndex += chunkText.length - overlap;
  }

  return chunks;
}

// Process PDF file
export async function processPDF(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  try {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const data = await pdf(buffer);
    const fullText = data.text;

    // Create chunks from the full text
    const chunks = chunkText(fullText, MAX_CHUNK_SIZE, CHUNK_OVERLAP);

    // Estimate page numbers based on character position
    const avgCharsPerPage = fullText.length / (data.numpages || 1);
    chunks.forEach((chunk: any) => {
      const estimatedPage = Math.floor(chunk.metadata.startChar / avgCharsPerPage) + 1;
      chunk.pageNumber = Math.min(Math.max(estimatedPage, 1), data.numpages || 1);
    });

    return {
      content: fullText,
      chunks,
      metadata: {
        fileName,
        fileType: 'pdf',
        totalPages: data.numpages,
        totalChunks: chunks.length
      }
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF file: ' + (error as Error).message);
  }
}

// Process DOCX file
export async function processDOCX(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  try {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    const chunks = chunkText(text);

    return {
      content: text,
      chunks,
      metadata: {
        fileName,
        fileType: 'docx',
        totalChunks: chunks.length
      }
    };
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw new Error('Failed to process DOCX file: ' + (error as Error).message);
  }
}

// Process PPTX file (simplified - for full implementation use pptx2json)
export async function processPPTX(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  // For now, return a placeholder
  // Full implementation would use pptx2json or similar library
  throw new Error('PPTX processing not yet implemented. Please convert to PDF or paste text manually.');
}

// Main processing function
export async function processDocument(file: Buffer, fileName: string): Promise<ProcessedDocument> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  switch (extension) {
    case 'pdf':
      return processPDF(file, fileName);
    case 'docx':
    case 'doc':
      return processDOCX(file, fileName);
    case 'pptx':
    case 'ppt':
      return processPPTX(file, fileName);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}