import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type StoreOfferId = 'pack-300' | 'pack-1000' | 'pro-bundle';

export interface ServerStoreOffer {
  id: StoreOfferId;
  title: string;
  priceBdt: number;
  priceLabel: string;
  coinsAdded: number;
  unlocksPro: boolean;
}

export const SERVER_STORE_OFFERS: ServerStoreOffer[] = [
  {
    id: 'pack-300',
    title: 'Starter Coin Pack',
    priceBdt: 80,
    priceLabel: '80 BDT',
    coinsAdded: 300,
    unlocksPro: false,
  },
  {
    id: 'pack-1000',
    title: 'Scholar Coin Pack',
    priceBdt: 240,
    priceLabel: '240 BDT',
    coinsAdded: 1000,
    unlocksPro: false,
  },
  {
    id: 'pro-bundle',
    title: 'Bruv Pro All-Access',
    priceBdt: 1000,
    priceLabel: '1,000 BDT',
    coinsAdded: 0,
    unlocksPro: true,
  },
];

export type PaymentProvider = 'sslcommerz' | 'stripe';
export type OrderStatus = 'pending' | 'verified' | 'failed' | 'cancelled';

export interface PaymentOrder {
  tranId: string;
  offerId: StoreOfferId;
  label: string;
  priceBdt: number;
  priceLabel: string;
  coinsAdded: number;
  unlocksPro: boolean;
  provider: PaymentProvider;
  status: OrderStatus;
  redeemed: boolean;
  gatewayRef?: string;
  createdAtMs: number;
  verifiedAtMs?: number;
}

export interface VerifiedPaymentGrant {
  tranId: string;
  provider: PaymentProvider;
  offerId: StoreOfferId;
  label: string;
  priceBdt: number;
  priceLabel: string;
  coinsAdded: number;
  unlocksPro: boolean;
  verifiedAtMs: number;
}

export interface GatewayConfigStatus {
  configured: boolean;
  providers: PaymentProvider[];
  sslcommerzSandbox: boolean;
  currency: 'BDT';
}

export function getGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfigStatus {
  const providers: PaymentProvider[] = [];
  if (env.SSLCOMMERZ_STORE_ID?.trim() && env.SSLCOMMERZ_STORE_PASSWD?.trim()) {
    providers.push('sslcommerz');
  }
  if (env.STRIPE_SECRET_KEY?.trim()) {
    providers.push('stripe');
  }
  return {
    configured: providers.length > 0,
    providers,
    sslcommerzSandbox: env.SSLCOMMERZ_IS_SANDBOX === 'true',
    currency: 'BDT',
  };
}

export function getOfferById(offerId: string): ServerStoreOffer | null {
  return SERVER_STORE_OFFERS.find((o) => o.id === offerId) ?? null;
}

export function createOrderRecord(
  offer: ServerStoreOffer,
  provider: PaymentProvider,
  nowMs: number = Date.now()
): PaymentOrder {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return {
    tranId: `BRUV_${nowMs}_${rand}`,
    offerId: offer.id,
    label: offer.title,
    priceBdt: offer.priceBdt,
    priceLabel: offer.priceLabel,
    coinsAdded: offer.coinsAdded,
    unlocksPro: offer.unlocksPro,
    provider,
    status: 'pending',
    redeemed: false,
    createdAtMs: nowMs,
  };
}

export function isSslCommerzValidationValid(
  order: PaymentOrder,
  payload: Record<string, unknown>
): boolean {
  const status = String(payload.status ?? '').toUpperCase();
  if (status !== 'VALID' && status !== 'VALIDATED') {
    return false;
  }
  const tranId = String(payload.tran_id ?? '');
  if (tranId !== order.tranId) {
    return false;
  }
  const currency = String(payload.currency_type ?? payload.currency ?? '').toUpperCase();
  if (currency && currency !== 'BDT') {
    return false;
  }
  const amount = Number(payload.amount ?? 0);
  if (!Number.isFinite(amount) || amount < order.priceBdt) {
    return false;
  }
  return true;
}

export function isStripeSessionValid(
  order: PaymentOrder,
  payload: Record<string, unknown>
): boolean {
  if (String(payload.payment_status ?? '').toLowerCase() !== 'paid') {
    return false;
  }
  const currency = String(payload.currency ?? '').toUpperCase();
  if (currency !== 'BDT') {
    return false;
  }
  const amountTotal = Number(payload.amount_total ?? 0);
  if (!Number.isFinite(amountTotal) || amountTotal < order.priceBdt * 100) {
    return false;
  }
  const meta = payload.metadata as Record<string, unknown> | undefined;
  if (meta && String(meta.tranId ?? '') !== order.tranId) {
    return false;
  }
  return true;
}

export class OrderStore {
  private orders = new Map<string, PaymentOrder>();
  private filePath: string | null;

  constructor(filePath: string | null = null) {
    this.filePath = filePath;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.filePath) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list = JSON.parse(raw) as PaymentOrder[];
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.tranId) {
              this.orders.set(item.tranId, item);
            }
          }
        }
      }
    } catch {
      // start clean if file unreadable
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(Array.from(this.orders.values()), null, 2),
        'utf8'
      );
    } catch {
      // ignore disk write issues
    }
  }

  save(order: PaymentOrder): void {
    this.orders.set(order.tranId, order);
    this.persist();
  }

  get(tranId: string): PaymentOrder | undefined {
    return this.orders.get(tranId);
  }

  markVerified(tranId: string, gatewayRef?: string, nowMs: number = Date.now()): PaymentOrder | null {
    const existing = this.orders.get(tranId);
    if (!existing) return null;
    if (existing.status === 'verified') return existing;
    const updated: PaymentOrder = {
      ...existing,
      status: 'verified',
      gatewayRef: gatewayRef ?? existing.gatewayRef,
      verifiedAtMs: nowMs,
    };
    this.orders.set(tranId, updated);
    this.persist();
    return updated;
  }

  markStatus(tranId: string, status: 'failed' | 'cancelled'): PaymentOrder | null {
    const existing = this.orders.get(tranId);
    if (!existing || existing.status === 'verified') return existing ?? null;
    const updated: PaymentOrder = { ...existing, status };
    this.orders.set(tranId, updated);
    this.persist();
    return updated;
  }

  claimVerified(
    tranId: string
  ): { ok: true; grant: VerifiedPaymentGrant } | { ok: false; code: number; error: string } {
    const order = this.orders.get(tranId);
    if (!order) {
      return { ok: false, code: 404, error: 'Transaction not found.' };
    }
    if (order.status !== 'verified') {
      return {
        ok: false,
        code: 402,
        error: `Payment is not verified (current status: ${order.status}). No coins or Pro access granted.`,
      };
    }
    if (order.redeemed) {
      return {
        ok: false,
        code: 409,
        error: 'This verified payment has already been credited.',
      };
    }

    const updated: PaymentOrder = { ...order, redeemed: true };
    this.orders.set(tranId, updated);
    this.persist();

    return {
      ok: true,
      grant: {
        tranId: updated.tranId,
        provider: updated.provider,
        offerId: updated.offerId,
        label: updated.label,
        priceBdt: updated.priceBdt,
        priceLabel: updated.priceLabel,
        coinsAdded: updated.coinsAdded,
        unlocksPro: updated.unlocksPro,
        verifiedAtMs: updated.verifiedAtMs ?? Date.now(),
      },
    };
  }
}
