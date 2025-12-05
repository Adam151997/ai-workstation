// lib/document-processor.ts - Extract text from various file types
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore - pdf-parse has ESM compatibility issues
    const pdf = pdfParse.default || pdfParse;
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('[DocProcessor] PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from DOCX file
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('[DocProcessor] DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Extract text from TXT/MD file
 */
function extractTextFromPlainText(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Main text extraction function - routes to appropriate handler
 */
export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  console.log(`[DocProcessor] Extracting text from ${fileType} file`);

  switch (fileType.toLowerCase()) {
    case 'pdf':
    case 'application/pdf':
      return await extractTextFromPDF(buffer);

    case 'docx':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractTextFromDOCX(buffer);

    case 'txt':
    case 'text/plain':
    case 'md':
    case 'text/markdown':
      return extractTextFromPlainText(buffer);

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Chunk text into smaller pieces for embedding
 * 
 * @param text - Full document text
 * @param chunkSize - Target size of each chunk (default: 1000 chars)
 * @param overlap - Number of characters to overlap between chunks (default: 200)
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  // Clean text
  const cleanedText = text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleanedText.length) {
    const end = Math.min(start + chunkSize, cleanedText.length);
    let chunk = cleanedText.slice(start, end);

    // Try to break at sentence boundary
    if (end < cleanedText.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > chunkSize * 0.5) {
        // If we found a good break point in the latter half, use it
        chunk = cleanedText.slice(start, start + breakPoint + 1);
        start = start + breakPoint + 1;
      } else {
        start = end;
      }
    } else {
      start = end;
    }

    chunks.push(chunk.trim());

    // Apply overlap for next chunk (except on last chunk)
    if (start < cleanedText.length) {
      start = Math.max(0, start - overlap);
    }
  }

  console.log(
    `[DocProcessor] Created ${chunks.length} chunks from ${cleanedText.length} chars`
  );

  return chunks;
}

/**
 * Get file type from filename
 */
export function getFileType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
}

/**
 * Validate file type
 */
export function isValidFileType(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  return ['pdf', 'docx', 'txt', 'md'].includes(extension || '');
}
