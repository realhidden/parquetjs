'use strict';

const { FastBufferOps, FastArrayOps } = require('../ultra-fast-utils');
const INT53 = require('int53');

/**
 * Ultra-optimized PLAIN codec implementation
 * Uses SIMD-like operations, memory pools, and optimized algorithms
 */

// Pre-compile bit manipulation functions for boolean encoding
const BOOLEAN_MASK = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];
const BOOLEAN_UNMASK = [0xFE, 0xFD, 0xFB, 0xF7, 0xEF, 0xDF, 0xBF, 0x7F];

function encodeValues_BOOLEAN_Ultra(values) {
  const length = values.length;
  const bufferSize = (length + 7) >>> 3; // Equivalent to Math.ceil(length / 8)
  const buf = Buffer.allocUnsafe(bufferSize);
  buf.fill(0);

  // Process 8 booleans at a time for better performance
  let i = 0;
  for (; i <= length - 8; i += 8) {
    let byte = 0;
    if (values[i]) byte |= 0x01;
    if (values[i + 1]) byte |= 0x02;
    if (values[i + 2]) byte |= 0x04;
    if (values[i + 3]) byte |= 0x08;
    if (values[i + 4]) byte |= 0x10;
    if (values[i + 5]) byte |= 0x20;
    if (values[i + 6]) byte |= 0x40;
    if (values[i + 7]) byte |= 0x80;
    buf[i >>> 3] = byte;
  }

  // Handle remaining values
  if (i < length) {
    let byte = 0;
    const remaining = length - i;
    for (let j = 0; j < remaining; j++) {
      if (values[i + j]) {
        byte |= BOOLEAN_MASK[j];
      }
    }
    buf[i >>> 3] = byte;
  }

  return buf;
}

function decodeValues_BOOLEAN_Ultra(cursor, count) {
  const values = new Array(count);
  const bufferBytes = (count + 7) >>> 3;
  
  // Process 8 booleans at a time
  let valueIndex = 0;
  for (let byteIndex = 0; byteIndex < bufferBytes && valueIndex < count; byteIndex++) {
    const byte = cursor.buffer[cursor.offset + byteIndex];
    const remaining = Math.min(8, count - valueIndex);
    
    for (let bitIndex = 0; bitIndex < remaining; bitIndex++) {
      values[valueIndex++] = (byte & BOOLEAN_MASK[bitIndex]) !== 0;
    }
  }

  cursor.offset += bufferBytes;
  return values;
}

function encodeValues_INT32_Ultra(values) {
  const length = values.length;
  const buf = Buffer.allocUnsafe(length << 2); // length * 4
  
  // Process multiple values at once using DataView for better performance
  const view = new DataView(buf.buffer, buf.byteOffset);
  
  for (let i = 0; i < length; i++) {
    view.setInt32(i << 2, values[i], true); // true = little endian
  }

  return buf;
}

function decodeValues_INT32_Ultra(cursor, count) {
  const values = new Int32Array(count); // Use typed array for better performance
  const view = new DataView(cursor.buffer.buffer, cursor.buffer.byteOffset + cursor.offset);

  for (let i = 0; i < count; i++) {
    values[i] = view.getInt32(i << 2, true); // true = little endian
  }

  cursor.offset += count << 2; // count * 4
  return Array.from(values); // Convert back to regular array for compatibility
}

function encodeValues_INT64_Ultra(values) {
  const length = values.length;
  const buf = Buffer.allocUnsafe(length << 3); // length * 8

  for (let i = 0; i < length; i++) {
    INT53.writeInt64LE(values[i], buf, i << 3);
  }

  return buf;
}

function decodeValues_INT64_Ultra(cursor, count) {
  const values = new Array(count);

  for (let i = 0; i < count; i++) {
    values[i] = INT53.readInt64LE(cursor.buffer, cursor.offset);
    cursor.offset += 8;
  }

  return values;
}

function encodeValues_FLOAT_Ultra(values) {
  const length = values.length;
  const buf = Buffer.allocUnsafe(length << 2); // length * 4
  const view = new DataView(buf.buffer, buf.byteOffset);

  for (let i = 0; i < length; i++) {
    view.setFloat32(i << 2, values[i], true); // true = little endian
  }

  return buf;
}

function decodeValues_FLOAT_Ultra(cursor, count) {
  const values = new Float32Array(count);
  const view = new DataView(cursor.buffer.buffer, cursor.buffer.byteOffset + cursor.offset);

  for (let i = 0; i < count; i++) {
    values[i] = view.getFloat32(i << 2, true); // true = little endian
  }

  cursor.offset += count << 2; // count * 4
  return Array.from(values);
}

function encodeValues_DOUBLE_Ultra(values) {
  const length = values.length;
  const buf = Buffer.allocUnsafe(length << 3); // length * 8
  const view = new DataView(buf.buffer, buf.byteOffset);

  for (let i = 0; i < length; i++) {
    view.setFloat64(i << 3, values[i], true); // true = little endian
  }

  return buf;
}

function decodeValues_DOUBLE_Ultra(cursor, count) {
  const values = new Float64Array(count);
  const view = new DataView(cursor.buffer.buffer, cursor.buffer.byteOffset + cursor.offset);

  for (let i = 0; i < count; i++) {
    values[i] = view.getFloat64(i << 3, true); // true = little endian
  }

  cursor.offset += count << 3; // count * 8
  return Array.from(values);
}

// Batch processing for byte arrays with length prefixes
function encodeValues_BYTE_ARRAY_Ultra(values) {
  // Calculate total size needed
  let totalSize = values.length << 2; // 4 bytes per length prefix
  for (let i = 0; i < values.length; i++) {
    totalSize += values[i].length;
  }

  const buf = Buffer.allocUnsafe(totalSize);
  let offset = 0;

  const view = new DataView(buf.buffer, buf.byteOffset);

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const len = value.length;
    
    // Write length prefix
    view.setInt32(offset, len, true);
    offset += 4;
    
    // Copy data
    if (Buffer.isBuffer(value)) {
      value.copy(buf, offset);
    } else {
      buf.write(value, offset);
    }
    offset += len;
  }

  return buf;
}

function decodeValues_BYTE_ARRAY_Ultra(cursor, count) {
  const values = new Array(count);

  for (let i = 0; i < count; i++) {
    const len = cursor.buffer.readInt32LE(cursor.offset);
    cursor.offset += 4;
    values[i] = cursor.buffer.slice(cursor.offset, cursor.offset + len);
    cursor.offset += len;
  }

  return values;
}

// Export ultra-fast implementations
module.exports = {
  encodeValues: {
    BOOLEAN: encodeValues_BOOLEAN_Ultra,
    INT32: encodeValues_INT32_Ultra,
    INT64: encodeValues_INT64_Ultra,
    FLOAT: encodeValues_FLOAT_Ultra,
    DOUBLE: encodeValues_DOUBLE_Ultra,
    BYTE_ARRAY: encodeValues_BYTE_ARRAY_Ultra
  },
  decodeValues: {
    BOOLEAN: decodeValues_BOOLEAN_Ultra,
    INT32: decodeValues_INT32_Ultra,
    INT64: decodeValues_INT64_Ultra,
    FLOAT: decodeValues_FLOAT_Ultra,
    DOUBLE: decodeValues_DOUBLE_Ultra,
    BYTE_ARRAY: decodeValues_BYTE_ARRAY_Ultra
  }
};