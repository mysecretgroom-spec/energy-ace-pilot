import Tesseract from 'tesseract.js';
import { preprocessForOcr } from './ocrPreprocess';

export interface OcrResult {
  text: string;
  confidence: number;
  extractedData: {
    montant?: number;
    tva?: number;
    date?: string;
    fournisseur?: string;
    description?: string;
  };
}

async function runTesseract(
  image: string,
  psm: string,
  onProgress?: (progress: number) => void
) {
  return Tesseract.recognize(image, 'fra', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
    // @ts-expect-error tesseract.js accepts engine params here
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
}

/**
 * Extract text from a receipt/invoice image.
 *
 * The image is first normalised (illumination correction + Sauvola adaptive
 * binarisation + upscaling) which is what makes thermal receipts readable.
 * A second pass on the greyscale version runs when confidence stays low.
 */
export async function performOcr(
  imageData: string,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  let prepared: { grey: string; binary: string } | null = null;
  try {
    prepared = await preprocessForOcr(imageData);
  } catch (err) {
    console.warn('OCR preprocessing failed, using raw image:', err);
  }

  // Pass 1 — binarised image, single column of text (receipts).
  let best = await runTesseract(prepared?.binary ?? imageData, '4', (p) =>
    onProgress?.(Math.round(p * (prepared ? 0.6 : 1)))
  );

  // Pass 2 — greyscale + block layout when the first pass is weak.
  if (prepared && (best.data.confidence < 70 || best.data.text.trim().length < 20)) {
    try {
      const second = await runTesseract(prepared.grey, '6', (p) =>
        onProgress?.(60 + Math.round(p * 0.4))
      );
      const scoreA = best.data.confidence * Math.min(1, best.data.text.trim().length / 40);
      const scoreB = second.data.confidence * Math.min(1, second.data.text.trim().length / 40);
      if (scoreB > scoreA) best = second;
    } catch (err) {
      console.warn('OCR second pass failed:', err);
    }
  }

  onProgress?.(100);

  const text = best.data.text;
  return {
    text,
    confidence: best.data.confidence,
    extractedData: extractDataFromText(text),
  };
}

/**
 * Extract structured data (amount, VAT, date, etc.) from OCR text
 */
function extractDataFromText(text: string): OcrResult['extractedData'] {
  const result: OcrResult['extractedData'] = {};

  // Clean up text
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Amounts: accept "1 234,56", "1.234,56", "12.34€", OCR "€"->"E" confusions
  const NUM = String.raw`(\d{1,3}(?:[ .\u00a0]\d{3})*|\d+)[.,](\d{2})`;
  const parseAmount = (intPart: string, dec: string) =>
    parseFloat(`${intPart.replace(/[ .\u00a0]/g, '')}.${dec}`);

  const labelled: { amount: number; weight: number }[] = [];
  const labelPatterns: { re: RegExp; weight: number }[] = [
    { re: new RegExp(String.raw`(?:NET\s*)?A\s*PAYER[^0-9]{0,12}` + NUM, 'gi'), weight: 5 },
    { re: new RegExp(String.raw`TOTAL\s*(?:TTC|C\.?B\.?)?[^0-9]{0,12}` + NUM, 'gi'), weight: 4 },
    { re: new RegExp(String.raw`MONTANT\s*(?:TTC)?[^0-9]{0,12}` + NUM, 'gi'), weight: 3 },
    { re: new RegExp(NUM + String.raw`\s*(?:€|EUR|EURO?S?)`, 'gi'), weight: 1 },
    { re: new RegExp(String.raw`(?:€|EUR)\s*` + NUM, 'gi'), weight: 1 },
  ];

  for (const { re, weight } of labelPatterns) {
    for (const m of cleanText.matchAll(re)) {
      const amount = parseAmount(m[1], m[2]);
      if (amount > 0 && amount < 100000) labelled.push({ amount, weight });
    }
  }

  if (labelled.length) {
    // Highest-priority label wins; among equals, keep the largest value (total).
    const maxWeight = Math.max(...labelled.map((l) => l.weight));
    result.montant = Math.max(
      ...labelled.filter((l) => l.weight === maxWeight).map((l) => l.amount)
    );
  }

  // Extract VAT
  const tvaPatterns = [
    /TVA[:\s]*(\d+[.,]\d{2})\s*€?/i,
    /T\.V\.A[:\s]*(\d+[.,]\d{2})\s*€?/i,
    /(?:DONT )?TVA[:\s]*(\d+[.,]\d{2})/i,
  ];

  for (const pattern of tvaPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const tva = parseFloat(match[1].replace(',', '.'));
      if (tva > 0) {
        result.tva = tva;
        break;
      }
    }
  }

  // Extract date (DD/MM/YYYY or DD-MM-YYYY)
  const datePatterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](20\d{2})/,
    /(\d{2})[\/\-](\d{2})[\/\-](\d{2})/, // Short year
  ];

  for (const pattern of datePatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const day = match[1];
      const month = match[2];
      let year = match[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      result.date = `${year}-${month}-${day}`;
      break;
    }
  }

  // Extract vendor name (look for common patterns)
  const vendorPatterns = [
    /^([A-Z][A-Z\s]{2,30})(?:\n|$)/m, // First line in caps
    /(?:MAGASIN|STATION|RESTAURANT|HOTEL)[:\s]*([A-Za-z\s]+)/i,
  ];

  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim();
      if (vendor.length >= 3 && vendor.length <= 50) {
        result.fournisseur = vendor;
        break;
      }
    }
  }

  // Try to determine description based on keywords
  const descriptionKeywords = {
    carburant: ['CARBURANT', 'ESSENCE', 'GAZOLE', 'DIESEL', 'SP95', 'SP98', 'E10', 'STATION'],
    repas: ['RESTAURANT', 'REPAS', 'MENU', 'PLAT', 'BOISSON', 'CAFE', 'BRASSERIE'],
    hotel: ['HOTEL', 'CHAMBRE', 'NUIT', 'SEJOUR', 'HEBERGEMENT'],
    peage: ['PEAGE', 'AUTOROUTE', 'VINCI', 'ASF', 'SANEF', 'APRR'],
    parking: ['PARKING', 'STATIONNEMENT', 'PARCMETRE'],
  };

  for (const [category, keywords] of Object.entries(descriptionKeywords)) {
    const hasKeyword = keywords.some((kw) =>
      cleanText.toUpperCase().includes(kw)
    );
    if (hasKeyword) {
      result.description = category;
      break;
    }
  }

  return result;
}

/**
 * Batch OCR for multiple pages
 */
export async function performBatchOcr(
  images: string[],
  onProgress?: (pageIndex: number, progress: number) => void
): Promise<OcrResult[]> {
  const results: OcrResult[] = [];

  for (let i = 0; i < images.length; i++) {
    const result = await performOcr(images[i], (progress) => {
      onProgress?.(i, progress);
    });
    results.push(result);
  }

  return results;
}
