'use strict';

/**
 * Ultra-fast mutex implementation using simple queuing
 * Much faster than async-mutex for high-throughput scenarios
 */
class UltraFastMutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve(() => {
          this.locked = false;
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
          }
        });
      } else {
        this.queue.push(() => {
          this.locked = true;
          resolve(() => {
            this.locked = false;
            if (this.queue.length > 0) {
              const next = this.queue.shift();
              next();
            }
          });
        });
      }
    });
  }
}

/**
 * Memory pool for reusing objects to reduce GC pressure
 */
class MemoryPool {
  constructor(createFn, resetFn, initialSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.inUse = new Set();
    
    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  acquire() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.createFn();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.pool.push(obj);
    }
  }

  size() {
    return { available: this.pool.length, inUse: this.inUse.size };
  }
}

/**
 * Ultra-fast array operations using typed arrays where possible
 */
class FastArrayOps {
  static createTypedArray(type, size) {
    switch (type) {
      case 'INT8': return new Int8Array(size);
      case 'UINT8': return new Uint8Array(size);
      case 'INT16': return new Int16Array(size);
      case 'UINT16': return new Uint16Array(size);
      case 'INT32': return new Int32Array(size);
      case 'UINT32': return new Uint32Array(size);
      case 'FLOAT32': return new Float32Array(size);
      case 'FLOAT64': return new Float64Array(size);
      default: return new Array(size);
    }
  }

  static fastConcat(arrays) {
    // Calculate total length
    let totalLength = 0;
    for (let i = 0; i < arrays.length; i++) {
      totalLength += arrays[i].length;
    }
    
    // Create result array
    const result = new Array(totalLength);
    let offset = 0;
    
    // Copy arrays
    for (let i = 0; i < arrays.length; i++) {
      const arr = arrays[i];
      for (let j = 0; j < arr.length; j++) {
        result[offset + j] = arr[j];
      }
      offset += arr.length;
    }
    
    return result;
  }

  static fastFill(array, value, start = 0, end = array.length) {
    for (let i = start; i < end; i++) {
      array[i] = value;
    }
    return array;
  }
}

/**
 * Ultra-fast buffer operations with optimized bit manipulation
 */
class FastBufferOps {
  static writeInt32Fast(buffer, value, offset) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >>> 8) & 0xff;
    buffer[offset + 2] = (value >>> 16) & 0xff;
    buffer[offset + 3] = (value >>> 24) & 0xff;
  }

  static readInt32Fast(buffer, offset) {
    return buffer[offset] |
           (buffer[offset + 1] << 8) |
           (buffer[offset + 2] << 16) |
           (buffer[offset + 3] << 24);
  }

  static writeFloat64Fast(buffer, value, offset) {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
    view.setFloat64(0, value, true); // little endian
  }

  static readFloat64Fast(buffer, offset) {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
    return view.getFloat64(0, true); // little endian
  }

  static copyFast(source, target, sourceStart, targetStart, length) {
    // Use native copy when possible
    if (source.copy && typeof source.copy === 'function') {
      source.copy(target, targetStart, sourceStart, sourceStart + length);
    } else {
      for (let i = 0; i < length; i++) {
        target[targetStart + i] = source[sourceStart + i];
      }
    }
  }
}

/**
 * Optimized object creation with cached property descriptors
 */
class FastObjectFactory {
  constructor() {
    this.cache = new Map();
  }

  createOptimizedObject(template) {
    const key = JSON.stringify(Object.keys(template).sort());
    
    if (!this.cache.has(key)) {
      // Create constructor function with optimized property access
      const Constructor = new Function(
        'template',
        `
        const obj = {};
        ${Object.keys(template).map(key => 
          `obj.${key} = template.${key};`
        ).join('\n')}
        return obj;
        `
      );
      this.cache.set(key, Constructor);
    }

    const Constructor = this.cache.get(key);
    return Constructor(template);
  }
}

module.exports = {
  UltraFastMutex,
  MemoryPool,
  FastArrayOps,
  FastBufferOps,
  FastObjectFactory
};