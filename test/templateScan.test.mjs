import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  scanPlaceholders, mergePlaceholders, classifyFieldDocx, unmappedPlaceholders, AUTO_PLACEHOLDERS
} from '../src/main/services/templateScan.js'

test('scanPlaceholders: estrae nomi unici in ordine', () => {
  const html = '<p>{{nome}} {{cognome}}</p><span>{{nome}}</span> {{ targa }} {{cap}}'
  // "{{ targa }}" ha spazi → non è un match valido (\w+), come nel riempimento reale
  assert.deepEqual(scanPlaceholders(html), ['nome', 'cognome', 'cap'])
})

test('scanPlaceholders: testo vuoto/nullo', () => {
  assert.deepEqual(scanPlaceholders(''), [])
  assert.deepEqual(scanPlaceholders(null), [])
})

test('mergePlaceholders: unione ordinata su più pagine', () => {
  assert.deepEqual(
    mergePlaceholders(['{{a}} {{b}}', '{{b}} {{c}}']),
    ['a', 'b', 'c']
  )
})

test('classifyFieldDocx: unset / ok / mismatch', () => {
  const ph = ['nome', 'cognome', 'targa']
  assert.equal(classifyFieldDocx('', ph), 'unset')
  assert.equal(classifyFieldDocx(null, ph), 'unset')
  assert.equal(classifyFieldDocx('nome', ph), 'ok')
  assert.equal(classifyFieldDocx('inesistente', ph), 'mismatch')
})

test('classifyFieldDocx: segnaposto automatici sempre ok', () => {
  const ph = ['nome']
  for (const auto of AUTO_PLACEHOLDERS) assert.equal(classifyFieldDocx(auto, ph), 'ok')
})

test('classifyFieldDocx: senza inventario nessun vincolo', () => {
  assert.equal(classifyFieldDocx('qualsiasi', []), 'ok')
  assert.equal(classifyFieldDocx('qualsiasi', null), 'ok')
})

test('unmappedPlaceholders: esclude automatici e già usati dai campi', () => {
  const ph = ['nome', 'cognome', 'premio', 'targa']
  const fields = [{ docx: 'nome' }, { docx: '' }, { docx: 'targa' }]
  // 'premio' è automatico → escluso; 'nome' e 'targa' sono usati → esclusi; resta 'cognome'
  assert.deepEqual(unmappedPlaceholders(ph, fields), ['cognome'])
})
