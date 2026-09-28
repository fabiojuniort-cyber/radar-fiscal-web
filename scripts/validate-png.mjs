import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let value = n
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
  }
  CRC_TABLE[n] = value >>> 0
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function paeth(left, up, upperLeft) {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upperLeftDistance = Math.abs(prediction - upperLeft)
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left
  if (upDistance <= upperLeftDistance) return up
  return upperLeft
}

function decodeScanlines(inflated, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel
  const expected = height * (stride + 1)
  if (inflated.length !== expected) {
    throw new Error(`Decoded PNG length mismatch: expected ${expected}, got ${inflated.length}`)
  }

  let offset = 0
  let previous = Buffer.alloc(stride)
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[offset]
    offset += 1
    if (filter > 4) throw new Error(`Invalid PNG filter ${filter} on row ${rowIndex}`)

    const source = inflated.subarray(offset, offset + stride)
    offset += stride
    const row = Buffer.allocUnsafe(stride)

    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0
      const up = previous[index]
      const upperLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0
      let value
      switch (filter) {
        case 0: value = source[index]; break
        case 1: value = source[index] + left; break
        case 2: value = source[index] + up; break
        case 3: value = source[index] + Math.floor((left + up) / 2); break
        case 4: value = source[index] + paeth(left, up, upperLeft); break
      }
      row[index] = value & 0xff
    }
    previous = row
  }

  return width * height * bytesPerPixel
}

export function validatePngBuffer(buffer, label = 'PNG') {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer)
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${label}: invalid PNG signature`)
  }

  let offset = 8
  let ihdr = null
  let seenIend = false
  let chunkCount = 0
  const idatParts = []

  while (offset < buffer.length) {
    if (buffer.length - offset < 12) throw new Error(`${label}: truncated PNG chunk header`)
    const length = buffer.readUInt32BE(offset)
    const end = offset + 12 + length
    if (end > buffer.length) throw new Error(`${label}: truncated PNG chunk payload`)

    const typeBuffer = buffer.subarray(offset + 4, offset + 8)
    const type = typeBuffer.toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    const storedCrc = buffer.readUInt32BE(offset + 8 + length)
    const calculatedCrc = crc32(Buffer.concat([typeBuffer, data]))
    if (storedCrc !== calculatedCrc) throw new Error(`${label}: CRC mismatch in ${type}`)

    chunkCount += 1
    if (chunkCount === 1 && type !== 'IHDR') throw new Error(`${label}: IHDR must be the first chunk`)
    if (type === 'IHDR') {
      if (ihdr || length !== 13) throw new Error(`${label}: invalid or duplicate IHDR`)
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'IEND') {
      if (length !== 0) throw new Error(`${label}: IEND must be empty`)
      seenIend = true
      offset = end
      if (offset !== buffer.length) throw new Error(`${label}: trailing bytes after IEND`)
      break
    }

    offset = end
  }

  if (!ihdr) throw new Error(`${label}: missing IHDR`)
  if (!seenIend) throw new Error(`${label}: missing IEND`)
  if (idatParts.length === 0) throw new Error(`${label}: missing IDAT`)
  if (ihdr.width <= 0 || ihdr.height <= 0) throw new Error(`${label}: invalid dimensions`)
  if (ihdr.bitDepth !== 8) throw new Error(`${label}: unsupported bit depth ${ihdr.bitDepth}; expected 8`)
  if (ihdr.compression !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0) {
    throw new Error(`${label}: unsupported PNG compression/filter/interlace method`)
  }

  const bytesPerPixel = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]).get(ihdr.colorType)
  if (!bytesPerPixel) throw new Error(`${label}: unsupported color type ${ihdr.colorType}`)

  let inflated
  try {
    inflated = inflateSync(Buffer.concat(idatParts))
  } catch (error) {
    throw new Error(`${label}: IDAT inflate failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  const decodedBytes = decodeScanlines(inflated, ihdr.width, ihdr.height, bytesPerPixel)

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitDepth: ihdr.bitDepth,
    colorType: ihdr.colorType,
    chunkCount,
    idatCount: idatParts.length,
    decodedBytes,
    iend: true,
    crc: 'ok',
  }
}

export function validatePngFile(filePath) {
  return validatePngBuffer(readFileSync(filePath), filePath)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('Usage: node scripts/validate-png.mjs <file.png> [...]')
    process.exitCode = 2
  } else {
    for (const file of files) {
      const result = validatePngFile(file)
      console.log(`${file}: ${JSON.stringify(result)}`)
    }
  }
}
