export interface Report {
  id: number;
  companyName: string;
  website?: string;
  description?: string;
  content: string; // Markdown content
  createdAt: string;
}

export interface CreateReportRequest {
  companyName: string;
  website?: string;
  description?: string;
  content: string;
}
