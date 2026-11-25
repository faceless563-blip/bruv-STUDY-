import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createOrderRecord,
  getGatewayConfig,
  getOfferById,
  isSslCommerzValidationValid,
  isStripeSessionValid,
  OrderStore,
  SERVER_STORE_OFFERS,
} from './server/paymentService.ts';
import {
  AiCoachError,
  generateStudyCoachPlan,
  sanitizeChatInput,
} from './server/aiCoachService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const orderStore = new OrderStore(path.join(__dirname, '.data', 'payment-orders.json'));

function resolveBaseUrl(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

async function verifySslCommerzWithGateway(valId: string): Promise<Record<string, unknown> | null> {
  const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD?.trim();
  if (!storeId || !storePasswd) return null;

  const isSandbox = process.env.SSLCOMMERZ_IS_SANDBOX === 'true';
  const host = isSandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
  const url = `${host}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
    valId
  )}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(
    storePasswd
  )}&format=json`;

  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Public gateway status + authoritative BDT offers
  app.get('/api/payments/config', (_req, res) => {
    const gw = getGatewayConfig();
    res.json({
      configured: gw.configured,
      providers: gw.providers,
      currency: gw.currency,
      offers: SERVER_STORE_OFFERS,
    });
  });

  // Create a real gateway checkout session (never grants coins on click)
  app.post('/api/payments/create-checkout', async (req, res) => {
    const gw = getGatewayConfig();
    if (!gw.configured) {
      res.status(503).json({
        ok: false,
        code: 'GATEWAY_NOT_CONFIGURED',
        message:
          'Payment not processed: Live BDT payment gateway credentials (SSLCommerz or Stripe) are not configured on the server. Zero coins or Pro access were granted.',
      });
      return;
    }

    const offerId = String(req.body?.offerId ?? '');
    const offer = getOfferById(offerId);
    if (!offer) {
      res.status(400).json({ ok: false, code: 'INVALID_OFFER', message: 'Invalid store package.' });
      return;
    }

    const baseUrl = resolveBaseUrl(req);
    const customerName = String(req.body?.customerName ?? 'Bruv-study User').trim() || 'Bruv-study User';
    const customerEmail = String(req.body?.customerEmail ?? 'student@bruv-study.app').trim() || 'student@bruv-study.app';

    if (gw.providers.includes('sslcommerz')) {
      const order = createOrderRecord(offer, 'sslcommerz');
      orderStore.save(order);

      const isSandbox = gw.sslcommerzSandbox;
      const endpoint = isSandbox
        ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
        : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

      const form = new URLSearchParams({
        store_id: process.env.SSLCOMMERZ_STORE_ID!.trim(),
        store_passwd: process.env.SSLCOMMERZ_STORE_PASSWD!.trim(),
        total_amount: String(offer.priceBdt),
        currency: 'BDT',
        tran_id: order.tranId,
        success_url: `${baseUrl}/api/payments/sslcommerz/success`,
        fail_url: `${baseUrl}/api/payments/sslcommerz/fail`,
        cancel_url: `${baseUrl}/api/payments/sslcommerz/cancel`,
        ipn_url: `${baseUrl}/api/payments/sslcommerz/ipn`,
        shipping_method: 'NO',
        product_name: offer.title,
        product_category: 'Digital Education Tools',
        product_profile: 'non-physical-goods',
        cus_name: customerName,
        cus_email: customerEmail,
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_postcode: '1200',
        cus_country: 'Bangladesh',
        cus_phone: '01700000000',
      });

      try {
        const gwRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        const gwData = (await gwRes.json()) as Record<string, unknown>;
        const checkoutUrl = String(gwData.GatewayPageURL ?? '');
        if (String(gwData.status ?? '').toUpperCase() === 'SUCCESS' && checkoutUrl) {
          res.json({
            ok: true,
            provider: 'sslcommerz',
            tranId: order.tranId,
            checkoutUrl,
          });
          return;
        }
        orderStore.markStatus(order.tranId, 'failed');
        res.status(502).json({
          ok: false,
          code: 'GATEWAY_SESSION_FAILED',
          message: String(gwData.failedreason ?? 'Could not initiate SSLCommerz payment session.'),
        });
        return;
      } catch {
        orderStore.markStatus(order.tranId, 'failed');
        res.status(502).json({
          ok: false,
          code: 'GATEWAY_UNREACHABLE',
          message: 'Payment gateway could not be reached. No coins were granted.',
        });
        return;
      }
    }

    // Stripe BDT Checkout fallback
    if (gw.providers.includes('stripe')) {
      const order = createOrderRecord(offer, 'stripe');
      orderStore.save(order);

      const stripeParams = new URLSearchParams({
        mode: 'payment',
        'line_items[0][price_data][currency]': 'bdt',
        'line_items[0][price_data][product_data][name]': offer.title,
        'line_items[0][price_data][unit_amount]': String(offer.priceBdt * 100),
        'line_items[0][quantity]': '1',
        success_url: `${baseUrl}/api/payments/stripe/success?tran_id=${encodeURIComponent(
          order.tranId
        )}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?payment_status=cancelled&tran_id=${encodeURIComponent(order.tranId)}`,
        'metadata[tranId]': order.tranId,
        'metadata[offerId]': offer.id,
      });

      try {
        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!.trim()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: stripeParams.toString(),
        });
        const sessionData = (await stripeRes.json()) as Record<string, unknown>;
        const checkoutUrl = String(sessionData.url ?? '');
        if (stripeRes.ok && checkoutUrl) {
          orderStore.save({ ...order, gatewayRef: String(sessionData.id ?? '') });
          res.json({
            ok: true,
            provider: 'stripe',
            tranId: order.tranId,
            checkoutUrl,
          });
          return;
        }
        orderStore.markStatus(order.tranId, 'failed');
        res.status(502).json({
          ok: false,
          code: 'STRIPE_SESSION_FAILED',
          message: 'Could not create Stripe Checkout session. No coins were granted.',
        });
        return;
      } catch {
        orderStore.markStatus(order.tranId, 'failed');
        res.status(502).json({
          ok: false,
          code: 'GATEWAY_UNREACHABLE',
          message: 'Stripe API unreachable. No coins were granted.',
        });
        return;
      }
    }
  });

  // SSLCommerz Success Redirect (POST callback from gateway)
  app.post('/api/payments/sslcommerz/success', async (req, res) => {
    const tranId = String(req.body?.tran_id ?? '');
    const valId = String(req.body?.val_id ?? '');
    const order = orderStore.get(tranId);
    if (!order || !valId) {
      res.redirect('/?payment_status=failed');
      return;
    }

    try {
      const validationPayload = await verifySslCommerzWithGateway(valId);
      if (validationPayload && isSslCommerzValidationValid(order, validationPayload)) {
        orderStore.markVerified(tranId, valId);
        res.redirect(`/?payment_status=success&tran_id=${encodeURIComponent(tranId)}`);
        return;
      }
    } catch {
      // fall through to failed
    }

    orderStore.markStatus(tranId, 'failed');
    res.redirect(`/?payment_status=failed&tran_id=${encodeURIComponent(tranId)}`);
  });

  // SSLCommerz IPN Webhook
  app.post('/api/payments/sslcommerz/ipn', async (req, res) => {
    const tranId = String(req.body?.tran_id ?? '');
    const valId = String(req.body?.val_id ?? '');
    const order = orderStore.get(tranId);
    if (!order || !valId) {
      res.status(400).json({ ok: false });
      return;
    }

    try {
      const validationPayload = await verifySslCommerzWithGateway(valId);
      if (validationPayload && isSslCommerzValidationValid(order, validationPayload)) {
        orderStore.markVerified(tranId, valId);
        res.json({ ok: true, status: 'verified' });
        return;
      }
    } catch {
      // ignore
    }

    orderStore.markStatus(tranId, 'failed');
    res.status(400).json({ ok: false, status: 'failed' });
  });

  app.post('/api/payments/sslcommerz/fail', (req, res) => {
    const tranId = String(req.body?.tran_id ?? '');
    if (tranId) orderStore.markStatus(tranId, 'failed');
    res.redirect(`/?payment_status=failed&tran_id=${encodeURIComponent(tranId)}`);
  });

  app.post('/api/payments/sslcommerz/cancel', (req, res) => {
    const tranId = String(req.body?.tran_id ?? '');
    if (tranId) orderStore.markStatus(tranId, 'cancelled');
    res.redirect(`/?payment_status=cancelled&tran_id=${encodeURIComponent(tranId)}`);
  });

  // Stripe Success Return Verification
  app.get('/api/payments/stripe/success', async (req, res) => {
    const tranId = String(req.query.tran_id ?? '');
    const sessionId = String(req.query.session_id ?? '');
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    const order = orderStore.get(tranId);

    if (!order || !sessionId || !stripeKey) {
      res.redirect('/?payment_status=failed');
      return;
    }

    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        {
          headers: { Authorization: `Bearer ${stripeKey}` },
        }
      );
      const sessionData = (await stripeRes.json()) as Record<string, unknown>;
      if (stripeRes.ok && isStripeSessionValid(order, sessionData)) {
        orderStore.markVerified(tranId, sessionId);
        res.redirect(`/?payment_status=success&tran_id=${encodeURIComponent(tranId)}`);
        return;
      }
    } catch {
      // fall through
    }

    orderStore.markStatus(tranId, 'failed');
    res.redirect(`/?payment_status=failed&tran_id=${encodeURIComponent(tranId)}`);
  });

  // Client claims coins/Pro ONLY after server verifies payment status === 'verified'
  app.post('/api/payments/claim-verified', (req, res) => {
    const tranId = String(req.body?.tranId ?? '').trim();
    if (!tranId) {
      res.status(400).json({ ok: false, error: 'Missing transaction ID.' });
      return;
    }
    const result = orderStore.claimVerified(tranId);
    if (!result.ok) {
      res.status(result.code).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, grant: result.grant });
  });

  // Server-side AI Study Coach endpoint (keeps GEMINI_API_KEY strictly on server)
  app.post('/api/ai/plan-chat', async (req, res) => {
    try {
      const sanitized = sanitizeChatInput(req.body);
      const result = await generateStudyCoachPlan(sanitized);
      res.json({
        ok: true,
        reply: result.reply,
        planSummary: result.planSummary,
        suggestedTasks: result.suggestedTasks,
      });
    } catch (err) {
      if (err instanceof AiCoachError) {
        res.status(err.status).json({
          ok: false,
          code: err.code,
          message: err.message,
        });
        return;
      }
      res.status(500).json({
        ok: false,
        code: 'AI_INTERNAL_ERROR',
        message: 'Unexpected error generating study plan.',
      });
    }
  });

  // Ensure API routes never fall through to SPA HTML or Express HTML error pages
  app.use('/api', (_req, res) => {
    res.status(404).json({
      ok: false,
      code: 'API_NOT_FOUND',
      message: 'API endpoint not found.',
    });
  });

  app.use(
    '/api',
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : 500;
      res.status(status).json({
        ok: false,
        code: 'API_REQUEST_ERROR',
        message: err?.message || 'Unexpected API request error.',
      });
    }
  );

  if (!isProduction) {
    const { createServer } = await import('vite');
    const hmrDisabled = process.env.ENABLE_HMR !== 'true';
    const vite = await createServer({
      plugins: hmrDisabled
        ? [
            {
              name: 'disable-hmr-websocket',
              enforce: 'post',
              transform(code) {
                if (
                  code.includes('createWebSocketModuleRunnerTransport({') &&
                  code.includes('vite-hmr')
                ) {
                  return {
                    code: code.replace(
                      /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
                      `let wsTransport = {
                        async connect({ onMessage }) {
                          onMessage({ type: "connected" });
                        },
                        async disconnect() {},
                        send() {},
                      };`
                    ),
                    map: null,
                  };
                }
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : undefined,
        ws: hmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bruv-study server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
