import { createHmac } from 'node:crypto';
import type { VenueOrder } from '../venues/types.js';

export type BtcTurkWsAuthMaterial = {
  publicKey: string;
  privateKeyBase64: string;
  nonce: number;
  timestampMs: number;
};

export type BtcTurkWsPrivateEvent =
  | { kind: 'WS_LOGIN_RESULT'; ok: boolean; message?: string }
  | { kind: 'USER_TRADE'; tradeId: string; orderId: string; symbol: string; amount: number; fee: number; tax: number; price: number; side: 'BUY' | 'SELL'; clientOrderId?: string; timestampMs: number }
  | { kind: 'USER_ORDER_MATCH'; eventId: string; orderId?: string; symbol: string; amount: number; price: number; side: 'BUY' | 'SELL'; clientOrderId?: string; timestampMs: number }
  | { kind: 'ORDER_INSERT'; order: VenueOrder }
  | { kind: 'ORDER_DELETE'; order: VenueOrder }
  | { kind: 'ORDER_UPDATE'; order: VenueOrder };

export function buildBtcTurkWsHmacLogin(material: BtcTurkWsAuthMaterial): string {
  if (!material.publicKey.trim()) throw new Error('BTCTURK_WS_PUBLIC_KEY_REQUIRED');
  if (!material.privateKeyBase64.trim()) throw new Error('BTCTURK_WS_PRIVATE_KEY_REQUIRED');
  if (!Number.isInteger(material.nonce) || material.nonce < 0) throw new Error('BTCTURK_WS_NONCE_INVALID');
  if (!Number.isInteger(material.timestampMs) || material.timestampMs < 0) throw new Error('BTCTURK_WS_TIMESTAMP_INVALID');
  const key = Buffer.from(material.privateKeyBase64, 'base64');
  if (key.length === 0) throw new Error('BTCTURK_WS_PRIVATE_KEY_INVALID');
  const signature = createHmac('sha256', key).update(`${material.publicKey}${material.nonce}`, 'utf8').digest('base64');
  return JSON.stringify([114, { type: 114, publicKey: material.publicKey, timestamp: material.timestampMs, nonce: material.nonce, signature }]);
}

export function parseBtcTurkPrivateEvent(raw: string): BtcTurkWsPrivateEvent[] {
  const decoded: unknown = JSON.parse(raw);
  if (!Array.isArray(decoded) || decoded.length !== 2) throw new Error('BTCTURK_PRIVATE_WS_ENVELOPE_INVALID');
  const [type, payload] = decoded;
  if (typeof type !== 'number' || !payload || typeof payload !== 'object') throw new Error('BTCTURK_PRIVATE_WS_ENVELOPE_INVALID');
  const body = payload as Record<string, unknown>;
  switch (type) {
    case 114: return [{ kind: 'WS_LOGIN_RESULT', ok: body.ok === true, message: body.message === undefined ? undefined : String(body.message) }];
    case 423: return [userTrade(body)];
    case 441: return [userOrderMatch(body)];
    case 451: return [{ kind: 'ORDER_INSERT', order: normalizePrivateOrder(body) }];
    case 452: return [{ kind: 'ORDER_DELETE', order: normalizePrivateOrder(body) }];
    case 453: return [{ kind: 'ORDER_UPDATE', order: normalizePrivateOrder(body) }];
    default: return [];
  }
}

function userTrade(body: Record<string, unknown>): BtcTurkWsPrivateEvent {
  return {
    kind: 'USER_TRADE',
    tradeId: requiredId(body.id, 'id'),
    orderId: requiredId(body.orderId, 'orderId'),
    symbol: requiredString(body.numeratorSymbol, 'numeratorSymbol') + requiredString(body.denominatorSymbol, 'denominatorSymbol'),
    amount: finite(body.preciseAmount ?? body.amount, 'amount'),
    fee: finite(body.fee, 'fee'),
    tax: finite(body.tax, 'tax'),
    price: finite(body.price, 'price'),
    side: normalizeSide(body.orderType),
    clientOrderId: body.orderClientId === undefined ? undefined : String(body.orderClientId),
    timestampMs: finite(body.timestamp, 'timestamp'),
  };
}

function userOrderMatch(body: Record<string, unknown>): BtcTurkWsPrivateEvent {
  return {
    kind: 'USER_ORDER_MATCH',
    eventId: requiredId(body.id, 'id'),
    orderId: body.orderId === undefined ? undefined : String(body.orderId),
    symbol: requiredString(body.symbol, 'symbol'),
    amount: finite(body.amount, 'amount'),
    price: finite(body.price, 'price'),
    side: body.isBid === true ? 'BUY' : 'SELL',
    clientOrderId: body.clientId === undefined ? undefined : String(body.clientId),
    timestampMs: dateLike(body.timestamp, 'timestamp'),
  };
}

function normalizePrivateOrder(body: Record<string, unknown>): VenueOrder {
  const quantity = finite(body.amount, 'amount');
  const denomLeft = body.denomLeft === undefined ? undefined : finite(body.denomLeft, 'denomLeft');
  const numLeft = body.numLeft === undefined ? undefined : finite(body.numLeft, 'numLeft');
  const remaining = numLeft ?? denomLeft;
  if (remaining !== undefined && (remaining < 0 || remaining > quantity)) throw new Error('BTCTURK_PRIVATE_WS_REMAINING_INVALID');
  return {
    orderId: requiredId(body.ID ?? body.id, 'ID'),
    symbol: requiredString(body.symbol, 'symbol'),
    side: body.isBid === true || String(body.type ?? '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
    method: normalizeMethod(body.method),
    status: body.status === undefined ? 'UNKNOWN' : String(body.status),
    quantity,
    price: body.price === undefined ? undefined : finite(body.price, 'price'),
    clientOrderId: body.newOrderClientId === undefined ? undefined : String(body.newOrderClientId),
    createdAtMs: dateLike(body.timestamp ?? body.time, 'timestamp'),
    updatedAtMs: dateLike(body.timestamp ?? body.updateTime ?? body.time, 'updateTime'),
    filledQuantity: remaining === undefined ? undefined : quantity - remaining,
    remainingQuantity: remaining,
  };
}

function normalizeMethod(value: unknown): VenueOrder['method'] {
  const n = Number(value);
  if (n === 0) return 'LIMIT';
  if (n === 1) return 'MARKET';
  if (n === 2) return 'STOP_LIMIT';
  const s = String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s === 'LIMIT') return 'LIMIT';
  if (s === 'MARKET') return 'MARKET';
  if (s === 'STOPLIMIT') return 'STOP_LIMIT';
  if (s === 'STOPMARKET') return 'STOP_MARKET';
  throw new Error(`BTCTURK_PRIVATE_WS_METHOD_INVALID:${String(value)}`);
}

function normalizeSide(value: unknown): 'BUY' | 'SELL' {
  const v = String(value ?? '').toUpperCase();
  if (v === 'BUY' || v === 'SELL') return v;
  throw new Error('BTCTURK_PRIVATE_WS_SIDE_INVALID');
}
function requiredString(value: unknown, name: string): string { const v = String(value ?? '').trim().toUpperCase(); if (!v) throw new Error(`BTCTURK_PRIVATE_WS_${name.toUpperCase()}_REQUIRED`); return v; }
function requiredId(value: unknown, name: string): string { const v = String(value ?? '').trim(); if (!v) throw new Error(`BTCTURK_PRIVATE_WS_${name.toUpperCase()}_REQUIRED`); return v; }
function finite(value: unknown, name: string): number { const n = Number(value); if (!Number.isFinite(n)) throw new Error(`BTCTURK_PRIVATE_WS_${name.toUpperCase()}_INVALID`); return n; }
function dateLike(value: unknown, name: string): number { const n = typeof value === 'number' ? value : Number(value); if (Number.isFinite(n) && n >= 0) return n; if (typeof value === 'string') { const parsed = Date.parse(value); if (Number.isFinite(parsed) && parsed >= 0) return parsed; } throw new Error(`BTCTURK_PRIVATE_WS_${name.toUpperCase()}_INVALID`); }
