import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCurrencyValue, parseQuantityValue } from '../utils/currency.js';

test('currency values preserve cents in Colombian formatting', () => {
  assert.equal(parseCurrencyValue('$ 1.234.567,89'), 1234567.89);
  assert.equal(parseCurrencyValue('1250000.50'), 1250000.5);
  assert.equal(Number.isNaN(parseCurrencyValue(125.123)), true);
  assert.equal(Number.isNaN(parseCurrencyValue('')), true);
});

test('harvest and inventory quantities allow up to three decimals', () => {
  assert.equal(parseQuantityValue('1.234,567'), 1234.567);
  assert.equal(parseQuantityValue('2.5'), 2.5);
  assert.equal(Number.isNaN(parseQuantityValue('1.2345')), true);
  assert.equal(Number.isNaN(parseQuantityValue(1.2345)), true);
});
