import { test } from 'node:test'
import assert from 'node:assert/strict'

import { evalExpr, toNumber, isValidExpr } from '../src/main/services/expr.js'
import { premioFor, formatEuro } from '../src/main/services/premioService.js'

// ─── Valutatore di espressioni ───────────────────────────────────────────────
test('evalExpr: aritmetica e precedenza', () => {
  assert.equal(evalExpr('1 + 2 * 3'), 7)
  assert.equal(evalExpr('(1 + 2) * 3'), 9)
  assert.equal(evalExpr('10 / 4'), 2.5)
  assert.equal(evalExpr('-3 + 5'), 2)
  assert.equal(evalExpr('2 * -4'), -8)
  assert.equal(evalExpr('7 % 3'), 1)
})

test('evalExpr: decimali con virgola o punto', () => {
  assert.equal(evalExpr('12,5 + 0,5'), 13)
  assert.equal(evalExpr('12.5 + 0.5'), 13)
})

test('evalExpr: variabili (case-insensitive, assenti = 0)', () => {
  assert.equal(evalExpr('premio * 2', { premio: 22.5 }), 45)
  assert.equal(evalExpr('IMPORTO + premio', { importo: '10', premio: 5 }), 15)
  assert.equal(evalExpr('mancante + 3', {}), 3)
})

test('evalExpr: funzioni', () => {
  assert.equal(evalExpr('max(premio, 15)', { premio: 10 }), 15)
  assert.equal(evalExpr('min(premio, 15)', { premio: 10 }), 10)
  assert.equal(evalExpr('round(10,4)'), 10)
  assert.equal(evalExpr('ceil(10,1)'), 11)
  assert.equal(evalExpr('abs(0 - 7)'), 7)
})

test('evalExpr: errori', () => {
  assert.throws(() => evalExpr('1 / 0'))
  assert.throws(() => evalExpr('1 +'))
  assert.throws(() => evalExpr('2 ** 3'))
  assert.throws(() => evalExpr('drop table; 1'))
  assert.equal(isValidExpr('premio * 2', { premio: 1 }), true)
  assert.equal(isValidExpr('premio *', {}), false)
})

test('toNumber: pulisce €, spazi e separatori', () => {
  assert.equal(toNumber('22,50'), 22.5)
  assert.equal(toNumber('€ 1.234,56'), 1234.56)
  assert.equal(toNumber(39), 39)
  assert.ok(Number.isNaN(toNumber('abc')))
})

// ─── premioFor con formula ───────────────────────────────────────────────────
const PREZZI = {
  '00001': { pacchetto: 'A', premio: '22,50' },
  '00010': { pacchetto: 'X', premio: '10,00', formula: 'premio * 2' },
  '00020': { pacchetto: 'Y', premio: '0,00', formula: 'importo * 0,05' },
  '00030': { pacchetto: 'Z', premio: '5,00', formula: 'premio *' } // formula rotta
}

test('premioFor: senza formula usa il valore fisso', () => {
  assert.deepEqual(premioFor('00001', PREZZI), { pacchetto: 'A', premio: '22,50' })
})

test('premioFor: formula sulla variabile premio', () => {
  assert.deepEqual(premioFor('00010', PREZZI), { pacchetto: 'X', premio: '20,00' })
})

test('premioFor: formula su un campo del record', () => {
  assert.deepEqual(premioFor('00020', PREZZI, { importo: '300' }), { pacchetto: 'Y', premio: '15,00' })
})

test('premioFor: formula non valida → ricade sul premio fisso', () => {
  assert.deepEqual(premioFor('00030', PREZZI, {}), { pacchetto: 'Z', premio: '5,00' })
})

test('formatEuro: 2 decimali con virgola', () => {
  assert.equal(formatEuro(20), '20,00')
  assert.equal(formatEuro(15.5), '15,50')
  assert.equal(formatEuro(NaN), '')
})
