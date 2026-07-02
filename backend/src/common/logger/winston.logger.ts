import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const configureWinstonLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL || 'info';

  const formatList = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
  ];

  if (!isProduction) {
    formatList.push(winston.format.colorize());
    formatList.push(
      winston.format.printf(({ timestamp, level, message, context, stack }) => {
        const ctxStr = context ? `[${context}] ` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `${timestamp} ${level}: ${ctxStr}${message}${stackStr}`;
      }),
    );
  } else {
    formatList.push(winston.format.json());
  }

  return WinstonModule.createLogger({
    level: logLevel,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(...formatList),
      }),
    ],
  });
};
