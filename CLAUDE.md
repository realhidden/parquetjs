# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is parquetjs, a pure JavaScript implementation of the Apache Parquet file format. It provides async APIs for reading and writing Parquet files in Node.js environments.

**Status**: Currently inactive and requires major overhaul (as noted in README.md).

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with code coverage
npm run test:coverage

# Generate HTML coverage report
npm run coverage

# Run specific test files (to avoid hanging integration tests)
npx mocha test/codec_plain.js test/codec_rle.js
```

## Architecture Overview

### Core Module Structure

The main entry point is `parquet.js` which exports:
- `ParquetReader` / `ParquetEnvelopeReader` - Read Parquet files
- `ParquetWriter` / `ParquetEnvelopeWriter` - Write Parquet files  
- `ParquetTransformer` - Transform data streams
- `ParquetSchema` - Define file schemas
- `ParquetShredder` - Data shredding utilities

### Directory Structure

- `lib/` - Core library implementation
  - `reader.js` - File reading logic with cursor-based iteration
  - `writer.js` - File writing with buffering/batching
  - `schema.js` - Schema definition and validation
  - `shred.js` - Data shredding and reconstruction
  - `types.js` - Parquet type definitions
  - `compression.js` - Compression algorithms (Brotli, ZSTD, Snappy, LZO)
  - `util.js` - Utility functions
  - `codec/` - Encoding implementations (PLAIN, RLE)
- `test/` - Test files using Mocha framework
- `gen-nodejs/` - Generated Thrift definitions
- `examples/` - Usage examples

### Key Implementation Details

1. **Async/Await Pattern**: All file operations use promises and async/await
2. **Cursor-based Reading**: `ParquetCursor` provides iterator-like access to rows
3. **Buffered Writing**: `ParquetWriter` buffers rows until row group completion
4. **Schema-first Approach**: Requires strict schema definition before read/write
5. **Thrift Integration**: Uses Apache Thrift for metadata serialization
6. **Compression Support**: Multiple algorithms via dedicated compression module

### Data Flow

**Writing**: Schema → Writer → Shredder → Codec → Compression → File
**Reading**: File → Decompression → Codec → Shredder → Cursor → Records

### Testing

- Uses Mocha test framework with nyc for code coverage
- Test files cover codecs, schema validation, integration tests, and shredding
- Run with `npm test` or `npm run test:coverage`
- Some integration tests may hang after package updates - use specific test files when needed
- Code coverage reports are generated in `coverage/` directory

### Dependencies

Key runtime dependencies:
- `thrift` - Apache Thrift library for metadata
- `brotli`, `fast-zstd`, `snappyjs`, `lzo` - Compression algorithms
- `async-mutex` - Concurrency control
- `bson` - BSON data handling

### Common Patterns

- Schema definitions use nested objects with `type`, `encoding`, `optional`, `repeated` properties
- Error handling typically uses try/catch with async operations
- File operations use streams for memory efficiency
- Type validation occurs during schema construction