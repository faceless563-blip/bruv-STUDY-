import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrderRecord,
  getGatewayConfig,
  getOfferById,
  isSslCommerzValidationValid,
  isStripeSessionValid,
  OrderStore,
} from './paymentService.ts';

test('getGatewayConfig reports unconfigured when no merchant keys exist', () => {
  const empty = getGatewayConfig({});
  assert.equal(empty.configured, false);
  assert.deepEqual(empty.providers, []);

  const ssl = getGatewayConfig({
    SSLCOMMERZ_STORE_ID: 'store123',
    SSLCOMMERZ_STORE_PASSWD: 'pass123',
    SSLCOMMERZ_IS_SANDBOX: 'true',
  });
  assert.equal(ssl.configured, true);
  assert.deepEqual(ssl.providers, ['sslcommerz']);
  assert.equal(ssl.sslcommerzSandbox, true);
});

test('server catalog enforces 80 BDT / 240 BDT / 1000 BDT authoritative pricing', () => {
  assert.equal(getOfferById('pack-300')?.priceBdt, 80);
  assert.equal(getOfferById('pack-300')?.coinsAdded, 300);
  assert.equal(getOfferById('pack-1000')?.priceBdt, 240);
  assert.equal(getOfferById('pack-1000')?.coinsAdded, 1000);
  assert.equal(getOfferById('pro-bundle')?.priceBdt, 1000);
  assert.equal(getOfferById('pro-bundle')?.unlocksPro, true);
});

test('OrderStore blocks claiming pending, failed, or already-redeemed orders', () => {
  const store = new OrderStore(null);
  const offer = getOfferById('pack-300')!;
  const order = createOrderRecord(offer, 'sslcommerz', 1000);
  store.save(order);

  // Pending order cannot be claimed
  const pendingAttempt = store.claimVerified(order.tranId);
  assert.equal(pendingAttempt.ok, false);
  if (!pendingAttempt.ok) assert.equal(pendingAttempt.code, 402);

  // Failed order cannot be claimed
  store.markStatus(order.tranId, 'failed');
  const failedAttempt = store.claimVerified(order.tranId);
  assert.equal(failedAttempt.ok, false);

  // Verified order can be claimed exactly once
  store.markVerified(order.tranId, 'val-xyz', 2000);
  const firstClaim = store.claimVerified(order.tranId);
  assert.equal(firstClaim.ok, true);
  if (firstClaim.ok) {
    assert.equal(firstClaim.grant.coinsAdded, 300);
    assert.equal(firstClaim.grant.priceBdt, 80);
  }

  // Second claim is blocked (replay protection)
  const replayClaim = store.claimVerified(order.tranId);
  assert.equal(replayClaim.ok, false);
  if (!replayClaim.ok) assert.equal(replayClaim.code, 409);
});

test('SSLCommerz and Stripe validators reject underpaid or mismatched transactions', () => {
  const offer = getOfferById('pro-bundle')!;
  const order = createOrderRecord(offer, 'sslcommerz', 1000);

  assert.equal(
    isSslCommerzValidationValid(order, {
      status: 'VALID',
      tran_id: order.tranId,
      currency_type: 'BDT',
      amount: '1000.00',
    }),
    true
  );

  // Reject underpayment
  assert.equal(
    isSslCommerzValidationValid(order, {
      status: 'VALID',
      tran_id: order.tranId,
      currency_type: 'BDT',
      amount: '80.00',
    }),
    false
  );

  // Reject non-VALID status
  assert.equal(
    isSslCommerzValidationValid(order, {
      status: 'FAILED',
      tran_id: order.tranId,
      currency_type: 'BDT',
      amount: '1000.00',
    }),
    false
  );

  // Stripe validator checks paisa (1000 BDT = 100000 paisa)
  assert.equal(
    isStripeSessionValid(order, {
      payment_status: 'paid',
      currency: 'bdt',
      amount_total: 100000,
      metadata: { tranId: order.tranId },
    }),
    true
  );

  assert.equal(
    isStripeSessionValid(order, {
      payment_status: 'unpaid',
      currency: 'bdt',
      amount_total: 100000,
      metadata: { tranId: order.tranId },
    }),
    false
  );
});
