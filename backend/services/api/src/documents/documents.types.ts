export interface DocumentResponseDto {
  documentId: string;
  fileUri: string;
  contentHash: string;
  kind: string;
  createdAt: string;
}

interface MetadataBundleFileRef {
  documentId: string;
  kind: string;
  contentHash: string;
  fileUri: string;
}

export interface MetadataBundle {
  version: number;
  assetId: string;
  generatedAt: string;
  debtorRefHash: string | null;
  invoiceHash: string | null;
  invoiceHashRefs: string[];
  files: MetadataBundleFileRef[];
}
