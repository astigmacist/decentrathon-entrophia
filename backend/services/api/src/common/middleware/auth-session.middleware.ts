import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { AppException } from "../exceptions/app.exception";
import { AuthService } from "../../auth/auth.service";
import { AuthSessionContext } from "../../auth/auth.types";

@Injectable()
export class AuthSessionMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(
    req: Request & { auth?: AuthSessionContext },
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authorization = this.getHeader(req.headers.authorization);
    if (!authorization) {
      this.assertPublicAccessAllowed(req);
      next();
      return;
    }

    const token = this.authService.extractBearerToken(authorization);
    if (!token) {
      this.assertPublicAccessAllowed(req);
      next();
      return;
    }

    const session = await this.authService.resolveSessionFromToken(token);
    const headerWallet = this.getHeader(req.headers["x-wallet"]);

    if (headerWallet && headerWallet !== session.wallet) {
      throw new AppException(
        "AUTH_WALLET_MISMATCH",
        "Authenticated wallet does not match x-wallet header.",
        401,
      );
    }

    req.auth = session;
    req.headers["x-wallet"] = session.wallet;
    next();
  }

  private assertPublicAccessAllowed(req: Request): void {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return;
    }

    const path = req.path;
    if (path === "/api/auth/challenge" || path === "/api/auth/verify") {
      return;
    }

    // Dev/demo mode: allow writes with x-wallet header without auth token
    if (process.env.NODE_ENV === "development") {
      const wallet = Array.isArray(req.headers["x-wallet"])
        ? req.headers["x-wallet"][0]
        : req.headers["x-wallet"];
      if (wallet) {
        return;
      }
    }

    throw new AppException(
      "AUTH_REQUIRED",
      "Authentication is required for write actions.",
      401,
    );
  }

  private getHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
}
