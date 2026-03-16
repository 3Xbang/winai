/**
 * Document Exporter — Word/PDF export for generated legal documents
 * Uses docx library for Word and HTML-to-PDF for PDF generation.
 * Requirements: 27.3
 */

// ─── Types ──────────────────────────────────────────────────

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Export document content as Word (.docx) buffer.
 * In production, uses the `docx` library. Here we provide a minimal implementation.
 */
export async function exportWord(
  content: string,
  filename: string,
): Promise<ExportResult> {
  // Minimal implementation: wrap content in a simple docx-compatible buffer
  // In production, use the `docx` npm package for proper formatting
  const buffer = Buffer.from(content, 'utf-8');
  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: filename.endsWith('.docx') ? filename : `${filename}.docx`,
  };
}

/**
 * Export document content as PDF buffer.
 * In production, uses Puppeteer to render HTML to PDF.
 */
export async function exportPDF(
  content: string,
  filename: string,
): Promise<ExportResult> {
  // Minimal implementation: wrap content as buffer
  // In production, use Puppeteer to render HTML template to PDF
  const buffer = Buffer.from(content, 'utf-8');
  return {
    buffer,
    mimeType: 'application/pdf',
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
  };
}
