import { HttpException, HttpStatus } from "@nestjs/common";

export class AppException extends HttpException {
  public readonly code: string;
  public readonly details: unknown | null;

  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details: unknown | null = null,
  ) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}
