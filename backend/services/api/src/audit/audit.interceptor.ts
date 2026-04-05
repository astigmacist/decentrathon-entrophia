import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { AuditService } from "./audit.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<{ method: string; originalUrl: string; traceId?: string }>();
    const response = httpCtx.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      finalize(() => {
        this.auditService.logRequest({
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          traceId: request.traceId ?? "unknown",
        });
      }),
    );
  }
}
