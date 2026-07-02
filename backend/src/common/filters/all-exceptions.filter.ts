import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred. Please try again later.';
    let errorResponse: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent = exception.getResponse();
      if (typeof resContent === 'object' && resContent !== null) {
        errorResponse = resContent;
        message = (resContent as any).message || message;
      } else {
        message = resContent as string;
      }
    } else {
      // Log non-HTTP errors (like db/system level failures) internally
      const err = exception as Error;
      this.logger.error(
        `Database/Internal Error context: [${request.method} ${request.url}]`,
        err?.stack || String(exception),
      );
    }

    const payload = {
      status: 'error',
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: Array.isArray(message) ? message[0] : message,
      ...(errorResponse && typeof errorResponse === 'object' ? { details: errorResponse } : {}),
    };

    // Remove internal database or prisma message fragments
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      payload.message = 'Internal server configuration error.';
      if (payload.details) delete payload.details;
    }

    response.status(status).json(payload);
  }
}
