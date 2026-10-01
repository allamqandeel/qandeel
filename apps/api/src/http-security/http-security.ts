import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { expressTrustProxySetting, type ProxyConfiguration } from './client-address';

/**
 * PROD-SEC-01 (SEC-B / SEC-C) — the HTTP boundary of the application, applied by `main.ts` immediately after the
 * application is created and BEFORE it initialises its routes (`listen` → `init`), so the header middleware runs in
 * front of every route, of the 404 answer and of every error and 429 answer.
 *
 * - `trust proxy` is set once, from the parsed topology: `false` (direct) or an explicit address list — never `true`,
 *   never a hop count.
 * - `X-Powered-By` is disabled at the Express level as well as by Helmet, so neither alone is load-bearing.
 * - Helmet's defaults are kept whole. The API serves JSON only: the default Content-Security-Policy, frame and
 *   cross-origin policies cost a JSON client nothing and deny any browser that is tricked into rendering a response.
 *   No CSP exception is invented for web assets that do not exist. CORS is not enabled here or anywhere: the clients
 *   are native, and no Product authority asks for a browser origin.
 */
export function configureHttpSecurity(app: NestExpressApplication, proxy: ProxyConfiguration): void {
  app.set('trust proxy', expressTrustProxySetting(proxy));
  app.disable('x-powered-by');
  app.use(helmet());
}
