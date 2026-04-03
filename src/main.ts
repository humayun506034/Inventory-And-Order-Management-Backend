import { ValidationPipe, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { AppModule } from './app.module';

export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const httpAdapter = app.getHttpAdapter().getInstance();

  httpAdapter.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Smart Inventory backend is running.',
      apiBaseUrl: '/api',
    });
  });

  app.use('/favicon.ico', (_req, res) => res.status(204).end());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
    ],
    credentials: true,
  });
  app.setGlobalPrefix('api');

  return app;
}

async function bootstrap() {
  const app = await createNestApp();
  await app.listen(process.env.PORT || 3000);
}


if (require.main === module) {
  void bootstrap();
}
