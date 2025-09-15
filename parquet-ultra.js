const reader = require('./lib/reader');
const writer = require('./lib/writer');
const schema = require('./lib/schema');
const shredder = require('./lib/shred');

// Import ultra-optimized implementations
const { UltraParquetWriter, UltraParquetTransformer } = require('./lib/ultra-writer');
const { ultraShredRecord } = require('./lib/ultra-shred');

module.exports = {
  // Original implementations
  ParquetEnvelopeReader: reader.ParquetEnvelopeReader,
  ParquetReader: reader.ParquetReader,
  ParquetEnvelopeWriter: writer.ParquetEnvelopeWriter,
  ParquetWriter: writer.ParquetWriter,
  ParquetTransformer: writer.ParquetTransformer,
  ParquetSchema: schema.ParquetSchema,
  ParquetShredder: shredder,
  
  // Ultra-optimized implementations
  UltraParquetWriter,
  UltraParquetTransformer,
  ultraShredRecord
};