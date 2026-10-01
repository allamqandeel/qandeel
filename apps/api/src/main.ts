import './observability/instrumentation';
import './observability/sentry';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureHttpSecurity } from './http-security/http-security';
import { runSecurityPreflight } from './http-security/production-security-preflight';

async function bootstrap(): Promise<void> {
  // PROD-SEC-01: refuse to start a production process that cannot keep its security contracts, before anything is built.
  const security = runSecurityPreflight(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttpSecurity(app, security.proxy);
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
