import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  CanActivate,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Observable, tap } from "rxjs";
import type { Request, Response } from "express";
import { STORE, type Store } from "./store";
import { hashToken } from "./domain";
export type AuthRequest = Request & { userId: string; requestId: string };
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(STORE) private store: Store) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!/^[\w-]{43}$/.test(token))
      throw new UnauthorizedException("Create a device session to continue");
    const user = await this.store.byToken(hashToken(token));
    if (!user)
      throw new UnauthorizedException(
        "Session expired. Start a new device session.",
      );
    req.userId = user.id;
    return true;
  }
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private logger = new Logger("API");
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthRequest>(),
      res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const response =
      error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof response === "string"
        ? response
        : (response as any)?.message ||
          "Something went wrong. Please try again.";
    if (status >= 500)
      this.logger.error(
        `${req.requestId || "unknown"} ${req.method} ${req.path}: ${error instanceof Error ? error.name : "UnknownError"}`,
      );
    res
      .status(status)
      .json({ statusCode: status, message, requestId: req.requestId });
  }
}
@Injectable()
export class RequestLogger implements NestInterceptor {
  private logger = new Logger("HTTP");
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.requestId = randomUUID();
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader("X-Request-Id", req.requestId);
    const start = Date.now();
    return next
      .handle()
      .pipe(
        tap({
          next: () =>
            this.logger.log(
              `${req.requestId} ${req.method} ${req.path} ${Date.now() - start}ms`,
            ),
        }),
      );
  }
}
