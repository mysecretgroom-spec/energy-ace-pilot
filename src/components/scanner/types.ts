export type DocumentContext = "finance" | "client_docs";

export interface ScanPage {
  id: string;
  imageData: string;
  thumbnailData: string;
  rotation: 0 | 90 | 180 | 270;
  cropped: boolean;
}
