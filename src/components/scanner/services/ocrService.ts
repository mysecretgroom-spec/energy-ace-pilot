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

/**
 * Extract text from an image using Tesseract.js
 */
export async function performOcr(
  imageData: string,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const result = await Tesseract.recognize(imageData, 'fra', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  const text = result.data.text;
  const confidence = result.data.confidence;

  // Extract structured data from the text
  const extractedData = extractDataFromText(text);

  return {
    text,
    confidence,
    extractedData,
  };
}

/**
 * Extract structured data (amount, VAT, date, etc.) from OCR text
 */
function extractDataFromText(text: string): OcrResult['extractedData'] {
  const result: OcrResult['extractedData'] = {};

  // Clean up text
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Extract amount (look for patterns like "12,34 €", "12.34€", "TOTAL: 12,34")
  const amountPatterns = [
    /TOTAL\s*(?:TTC)?[:\s]*(\d+[.,]\d{2})\s*€?/i,
    /MONTANT\s*(?:TTC)?[:\s]*(\d+[.,]\d{2})\s*€?/i,
    /(?:A PAYER|NET A PAYER)[:\s]*(\d+[.,]\d{2})\s*€?/i,
    /(\d+[.,]\d{2})\s*€\s*(?:TTC)?/i,
    /€\s*(\d+[.,]\d{2})/i,
  ];

  for (const pattern of amountPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      if (amount > 0 && amount < 100000) {
        result.montant = amount;
        break;
      }
    }
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
