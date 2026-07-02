import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { configureWinstonLogger } from './common/logger/winston.logger';
import helmet from 'helmet';

async function bootstrap() {
  // Bind Custom Winston Logger
  const logger = configureWinstonLogger();
  const app = await NestFactory.create(AppModule, { logger });

  // Security Middlewares
  app.use(helmet());
  app.enableCors({
    origin: '*', // Customize this for production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Validation Pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API Versioning (URI based: /api/v1/...)
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Swagger OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('MartPay API Specification')
    .setDescription(
      'REST API documentation for the MartPay self-checkout supermarket platform. All endpoints are versioned under /api/v1.',
    )
    .setVersion('1.0')
    .addTag('Authentication', 'Customer registration and JWT session initiation')
    .addTag('Products', 'Barcode resolver and product catalogue views')
    .addTag('Orders & Checkouts', 'Basket payments processing and QR verification')
    .addTag('Admin Operations', 'Real-time security log tracking')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`MartPay server started successfully on port ${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/v1/docs`);
}
bootstrap();
