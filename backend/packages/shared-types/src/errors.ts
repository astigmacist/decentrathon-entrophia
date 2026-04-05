export interface ApiErrorContract {
  code: string;
  message: string | string[];
  traceId: string;
  details: unknown | null;
}
