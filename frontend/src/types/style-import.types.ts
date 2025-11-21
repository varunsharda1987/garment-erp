// Style Import Types

export interface StyleImportResponse {
  success: boolean;
  importBatchId: string;
  summary: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    stylesCreated: number;
    stylesUpdated: number;
    componentsCreated: number;
    fabricsCreated: number;
    cadEntriesCreated: number;
    processingTimeMs: number;
  };
  errors?: Array<{
    rowNumber: number;
    styleCode: string;
    componentName: string;
    fabricDescription: string;
    errorMessage: string;
    errorType: string;
  }>;
}

export interface ImportStatusResponse {
  success: boolean;
  data: {
    importBatchId: string;
    summary: {
      total: number;
      pending: number;
      processed: number;
      error: number;
    };
    errors: Array<{
      styleCode: string;
      componentName: string;
      fabricDescription: string;
      errorMessage: string;
    }>;
  };
}
