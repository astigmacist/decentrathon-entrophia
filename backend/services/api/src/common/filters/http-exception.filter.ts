import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AppException } from "../exceptions/app.exception";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const traceId = request.traceId ?? "unknown";

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        code: exception.code,
        message: exception.message,
        traceId,
        details: exception.details,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : ((payload as { message?: string | string[] }).message ??
            exception.message);
      const details = typeof payload === "object" && payload !== null ? payload : null;

      response.status(status).json({
        code: this.mapStatusToCode(status),
        message,
        traceId,
        details,
      });
      return;
    }

    this.logger.error("Unhandled exception", exception instanceof Error ? exception.stack : undefined);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Unexpected internal error",
      traceId,
      details: null,
    });
  }

  private mapStatusToCode(status: number): string {
    if (status >= 500) {
      return "INTERNAL_ERROR";
    }
    if (status === HttpStatus.NOT_FOUND) {
      return "NOT_FOUND";
    }
    if (status === HttpStatus.UNAUTHORIZED) {
      return "UNAUTHORIZED";
    }
    if (status === HttpStatus.FORBIDDEN) {
      return "FORBIDDEN";
    }
    if (status === HttpStatus.CONFLICT) {
      return "CONFLICT";
    }
    return "BAD_REQUEST";
  }
}
