import assert from 'node:assert/strict';
import test from 'node:test';
import { HYPER_QUANT_SPEC_STATUS, HYPER_QUANT_SPEC_VERSION } from '../../src/index.js';

test('implementation is pinned to the v2.8 review candidate specification', () => {
  assert.equal(HYPER_QUANT_SPEC_VERSION, '2.8');
  assert.equal(HYPER_QUANT_SPEC_STATUS, 'REVIEW_REQUIRED');
});
