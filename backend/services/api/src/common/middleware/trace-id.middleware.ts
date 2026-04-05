import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export interface TracedRequest extends Request {
  traceId?: string;
}

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: TracedRequest, res: Response, next: NextFunction): void {
    const headerTraceId = req.headers["x-trace-id"];
    const traceId =
      typeof headerTraceId === "string" && headerTraceId.length > 0
        ? headerTraceId
        : randomUUID();

    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);
    next();
  }
}
