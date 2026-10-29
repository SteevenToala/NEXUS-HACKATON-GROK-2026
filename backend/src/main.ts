import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilitar CORS para el frontend Next.js
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Backend Multi-Agente ejecutándose en: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`🤖 Webhook Telegram disponible en: http://localhost:${port}/webhook/telegram`, 'Bootstrap');
}
bootstrap();
