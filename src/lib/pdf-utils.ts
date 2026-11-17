import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Reads a PDF File directly in the browser using pdf-lib and returns the page count.
 */
export async function countPdfPages(file: File | ArrayBuffer): Promise<number> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Generates a realistic mock PDF document using pdf-lib for seed orders.
 */
export async function createSamplePdf(
  title: string,
  studentName: string,
  department: string,
  pages: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pages; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
    const { width, height } = page.getSize();

    // Top Header Banner
    page.drawRectangle({
      x: 36,
      y: height - 80,
      width: width - 72,
      height: 48,
      color: rgb(0.08, 0.35, 0.32), // Emerald/Teal brand
    });

    page.drawText('SREE NARAYANA GURUKULAM COLLEGE OF ENGINEERING', {
      x: 50,
      y: height - 56,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('Central Library Document Print Service', {
      x: 50,
      y: height - 72,
      size: 9,
      font: fontRegular,
      color: rgb(0.85, 0.95, 0.93),
    });

    // Document Title & Metadata
    page.drawText(title, {
      x: 36,
      y: height - 120,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.2),
    });

    page.drawText(`Student: ${studentName}  |  Dept: ${department}`, {
      x: 36,
      y: height - 140,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.4, 0.5),
    });

    // Content Lines
    page.drawText(`Section ${i}: Project Documentation & Assignment Submission`, {
      x: 36,
      y: height - 180,
      size: 13,
      font: fontBold,
      color: rgb(0.12, 0.22, 0.3),
    });

    const bodyParagraph = [
      'This document was queued via the SNGCE Central Library Print Queue portal.',
      'Students can retrieve their printed assignments and project documentation',
      'from the ground floor library circulation desk during their chosen pickup slot.',
      '',
      `Academic Year: 2026-2027 • Page ${i} of ${pages}`,
      'Verified by SNGCE Central Library Digital Repositories and Automated Print Kiosk.',
    ];

    let currentY = height - 210;
    for (const line of bodyParagraph) {
      if (line.length > 0) {
        page.drawText(line, {
          x: 36,
          y: currentY,
          size: 10.5,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.3),
        });
      }
      currentY -= 20;
    }

    // Border Frame
    page.drawRectangle({
      x: 36,
      y: 40,
      width: width - 72,
      height: height - 130,
      borderWidth: 1,
      borderColor: rgb(0.88, 0.91, 0.94),
      color: rgb(0.99, 0.99, 1),
      opacity: 0.1,
    });

    // Footer
    page.drawText(`Page ${i} of ${pages}  •  SNGCE Library Print Desk`, {
      x: width / 2 - 80,
      y: 25,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  return await pdfDoc.save();
}

/**
 * Helper to convert Uint8Array / Blob to Object URL or Data URL
 */
export function createPdfDataUrl(pdfBytes: Uint8Array): string {
  let binary = '';
  const len = pdfBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(pdfBytes[i]);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}
