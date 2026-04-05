import { Injectable, Logger } from "@nestjs/common";

export interface AuditRequestLog {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  traceId: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  logRequest(entry: AuditRequestLog): void {
    this.logger.log(
      `${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms traceId=${entry.traceId}`,
    );
  }
}
