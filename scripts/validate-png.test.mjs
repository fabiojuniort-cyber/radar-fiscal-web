import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { validatePngBuffer, validatePngFile } from './validate-png.mjs'

const logoPath = 'public/brand/tribusca-logo-horizontal-dark.png'
const iconPath = 'public/brand/tribusca-icon.png'
const trifarosLogoPath = 'public/brand/trifaros-logo-horizontal.png'
const trifarosLogoSha256 = 'a9e4dab1392861c1927629bd181a60c462c32514e9427cc2ef8e3da0e2a64b4f'

test('WEB-09 validates the complete official PNG masters', () => {
  const logo = validatePngFile(logoPath)
  const icon = validatePngFile(iconPath)
  const trifarosLogo = validatePngFile(trifarosLogoPath)

  assert.deepEqual([logo.width, logo.height, logo.crc, logo.iend], [2172, 724, 'ok', true])
  assert.deepEqual([icon.width, icon.height, icon.crc, icon.iend], [1254, 1254, 'ok', true])
  assert.equal(logo.decodedBytes, 2172 * 724 * 3)
  assert.equal(icon.decodedBytes, 1254 * 1254 * 4)
  assert.deepEqual([trifarosLogo.width, trifarosLogo.height, trifarosLogo.crc, trifarosLogo.iend], [2048, 682, 'ok', true])
  assert.equal(trifarosLogo.decodedBytes, 2048 * 682 * 4)
  assert.equal(createHash('sha256').update(readFileSync(trifarosLogoPath)).digest('hex'), trifarosLogoSha256)
})

test('WEB-09 rejects a deliberately truncated PNG', () => {
  const original = readFileSync(logoPath)
  const truncated = original.subarray(0, original.length - 64)
  assert.throws(
    () => validatePngBuffer(truncated, 'deliberately-truncated-logo.png'),
    /truncated|missing IEND|CRC|inflate/i,
  )
})

test('WEB-09 rejects a PNG with a corrupted chunk CRC', () => {
  const corrupt = Buffer.from(readFileSync(iconPath))
  const idat = corrupt.indexOf(Buffer.from('IDAT'))
  assert.ok(idat > 0, 'IDAT chunk not found')
  corrupt[idat + 8] ^= 0x01
  assert.throws(() => validatePngBuffer(corrupt, 'crc-corrupted-icon.png'), /CRC mismatch/i)
})
