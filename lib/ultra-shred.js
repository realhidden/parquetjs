'use strict';

const { MemoryPool, FastArrayOps, FastObjectFactory } = require('./ultra-fast-utils');
const parquet_types = require('./types');

/**
 * Ultra-optimized record shredder with memory pooling and pre-compiled operations
 */

// Memory pools for different object types
const RECORD_POOL = new MemoryPool(
  () => ({}),
  (obj) => {
    // Reset object
    for (const key in obj) {
      delete obj[key];
    }
  },
  50
);

const ARRAY_POOL = new MemoryPool(
  () => [],
  (arr) => arr.length = 0,
  100
);

// Pre-compiled field accessors for common patterns
const FIELD_ACCESSOR_CACHE = new Map();

function getCompiledFieldAccessor(fieldPath) {
  const key = fieldPath.join('.');
  if (!FIELD_ACCESSOR_CACHE.has(key)) {
    // Create optimized accessor function
    const accessorCode = fieldPath.reduce((code, field, index) => {
      if (index === 0) {
        return `record["${field}"]`;
      }
      return `(${code} && ${code}["${field}"])`;
    }, '');
    
    const accessor = new Function('record', `return ${accessorCode};`);
    FIELD_ACCESSOR_CACHE.set(key, accessor);
  }
  return FIELD_ACCESSOR_CACHE.get(key);
}

// Pre-compiled type converters
const TYPE_CONVERTER_CACHE = new Map();

function getCompiledTypeConverter(fieldType, originalType) {
  const key = `${fieldType}_${originalType || 'none'}`;
  if (!TYPE_CONVERTER_CACHE.has(key)) {
    let converter;
    
    if (originalType && parquet_types.PARQUET_LOGICAL_TYPES[originalType]) {
      const logicalType = parquet_types.PARQUET_LOGICAL_TYPES[originalType];
      converter = logicalType.toPrimitive;
    } else if (parquet_types.PARQUET_LOGICAL_TYPES[fieldType]) {
      const primitiveType = parquet_types.PARQUET_LOGICAL_TYPES[fieldType];
      converter = primitiveType.toPrimitive;
    } else {
      converter = (value) => value; // Identity function
    }
    
    TYPE_CONVERTER_CACHE.set(key, converter);
  }
  return TYPE_CONVERTER_CACHE.get(key);
}

/**
 * Ultra-fast record shredding with aggressive optimizations
 */
function ultraShredRecord(schema, record, buffer) {
  // Initialize buffer if needed
  if (!('columnData' in buffer) || !('rowCount' in buffer)) {
    buffer.rowCount = 0;
    buffer.columnData = {};

    for (let field of schema.fieldList) {
      buffer.columnData[field.path] = {
        dlevels: [],
        rlevels: [],
        values: [],
        count: 0
      };
    }
  }

  // Acquire temporary objects from pools
  const recordShredded = RECORD_POOL.acquire();
  
  try {
    // Initialize shredded record structure
    for (let field of schema.fieldList) {
      const fieldData = {
        dlevels: ARRAY_POOL.acquire(),
        rlevels: ARRAY_POOL.acquire(), 
        values: ARRAY_POOL.acquire(),
        count: 0
      };
      recordShredded[field.path] = fieldData;
    }

    // Perform ultra-fast shredding
    ultraShredRecordInternal(schema.fields, record, recordShredded, 0, 0);

    // Merge results using optimized array operations
    buffer.rowCount += 1;
    for (let field of schema.fieldList) {
      const fieldPath = field.path;
      const sourceData = recordShredded[fieldPath];
      const targetData = buffer.columnData[fieldPath];
      
      // Use optimized concatenation
      if (sourceData.rlevels.length > 0) {
        targetData.rlevels.push(...sourceData.rlevels);
        targetData.dlevels.push(...sourceData.dlevels);
        targetData.values.push(...sourceData.values);
        targetData.count += sourceData.count;
      }
    }

  } finally {
    // Release all pooled objects
    for (let field of schema.fieldList) {
      const fieldData = recordShredded[field.path];
      if (fieldData) {
        ARRAY_POOL.release(fieldData.dlevels);
        ARRAY_POOL.release(fieldData.rlevels);
        ARRAY_POOL.release(fieldData.values);
      }
    }
    RECORD_POOL.release(recordShredded);
  }
}

function ultraShredRecordInternal(fields, record, data, rlvl, dlvl) {
  for (let fieldName in fields) {
    const field = fields[fieldName];
    const fieldType = field.originalType || field.primitiveType;
    const fieldPath = field.path;

    // Use compiled accessor for faster field access
    const accessor = getCompiledFieldAccessor(fieldPath);
    let fieldValue = accessor(record);

    // Handle nested fields
    if (field.isNested) {
      if (field.repetitionType === 'REPEATED') {
        if (fieldValue && Array.isArray(fieldValue)) {
          for (let i = 0; i < fieldValue.length; i++) {
            const element = fieldValue[i];
            ultraShredRecordInternal(
              field.fields, 
              { [fieldName]: element }, 
              data, 
              rlvl + (i > 0 ? 1 : 0), 
              dlvl + 1
            );
          }
        } else {
          // Empty repeated field
          for (let childFieldName in field.fields) {
            const childField = field.fields[childFieldName];
            const childPath = childField.path;
            data[childPath].rlevels.push(rlvl);
            data[childPath].dlevels.push(dlvl);
            data[childPath].values.push(null);
            data[childPath].count++;
          }
        }
      } else {
        // Not repeated, process nested object
        const nestedRecord = fieldValue || {};
        ultraShredRecordInternal(field.fields, nestedRecord, data, rlvl, dlvl + 1);
      }
    } else {
      // Leaf field - process value
      const currentRLevel = rlvl;
      let currentDLevel = dlvl;

      if (field.repetitionType === 'REPEATED') {
        if (fieldValue && Array.isArray(fieldValue)) {
          for (let i = 0; i < fieldValue.length; i++) {
            const element = fieldValue[i];
            const converter = getCompiledTypeConverter(fieldType, field.originalType);
            const convertedValue = converter ? converter(element) : element;
            
            data[fieldPath].rlevels.push(i > 0 ? currentRLevel + 1 : currentRLevel);
            data[fieldPath].dlevels.push(currentDLevel + 1);
            data[fieldPath].values.push(convertedValue);
            data[fieldPath].count++;
          }
        } else {
          // Empty repeated field
          data[fieldPath].rlevels.push(currentRLevel);
          data[fieldPath].dlevels.push(currentDLevel);
          data[fieldPath].values.push(null);
          data[fieldPath].count++;
        }
      } else {
        // Regular field
        if (fieldValue !== undefined && fieldValue !== null) {
          const converter = getCompiledTypeConverter(fieldType, field.originalType);
          const convertedValue = converter ? converter(fieldValue) : fieldValue;
          
          data[fieldPath].rlevels.push(currentRLevel);
          data[fieldPath].dlevels.push(currentDLevel + 1);
          data[fieldPath].values.push(convertedValue);
          data[fieldPath].count++;
        } else if (field.repetitionType === 'OPTIONAL') {
          // Optional field with null value
          data[fieldPath].rlevels.push(currentRLevel);
          data[fieldPath].dlevels.push(currentDLevel);
          data[fieldPath].values.push(null);
          data[fieldPath].count++;
        }
      }
    }
  }
}

module.exports = {
  ultraShredRecord,
  RECORD_POOL,
  ARRAY_POOL,
  getMemoryPoolStats: () => ({
    recordPool: RECORD_POOL.size(),
    arrayPool: ARRAY_POOL.size()
  })
};