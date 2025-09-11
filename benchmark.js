#!/usr/bin/env node
'use strict';

const parquet = require('./parquet.js');
const fs = require('fs');
const os = require('os');

// Performance benchmark script
const BENCHMARK_ROWS = 10000;
const ITERATIONS = 3;

function generateTestData(numRows) {
  const rows = [];
  const baseDate = new Date('2023-01-01');
  
  for (let i = 0; i < numRows; i++) {
    rows.push({
      id: i,
      name: `record_${i}`,
      value: Math.random() * 1000,
      timestamp: new Date(baseDate.getTime() + i * 1000),
      active: i % 2 === 0,
      tags: [`tag_${i % 10}`, `category_${i % 5}`],
      metadata: {
        version: 1,
        score: Math.floor(Math.random() * 100)
      }
    });
  }
  
  return rows;
}

function createSchema() {
  return new parquet.ParquetSchema({
    id: { type: 'INT64' },
    name: { type: 'UTF8' },
    value: { type: 'DOUBLE' },
    timestamp: { type: 'TIMESTAMP_MILLIS' },
    active: { type: 'BOOLEAN' },
    tags: { type: 'UTF8', repeated: true },
    metadata: {
      fields: {
        version: { type: 'INT32' },
        score: { type: 'INT32' }
      }
    }
  });
}

async function benchmarkWrite(rows, schema, filename, compression = 'UNCOMPRESSED') {
  const start = process.hrtime.bigint();
  
  const writer = await parquet.ParquetWriter.openFile(schema, filename, { compression });
  
  for (const row of rows) {
    await writer.appendRow(row);
  }
  
  await writer.close();
  
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  
  return duration;
}

async function benchmarkRead(filename) {
  const start = process.hrtime.bigint();
  
  const reader = await parquet.ParquetReader.openFile(filename);
  const cursor = reader.getCursor();
  
  let count = 0;
  let record;
  while ((record = await cursor.next())) {
    count++;
  }
  
  await reader.close();
  
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  
  return { duration, count };
}

async function runBenchmarks() {
  console.log('🚀 ParquetJS Performance Benchmark');
  console.log('====================================');
  console.log(`Rows per test: ${BENCHMARK_ROWS.toLocaleString()}`);
  console.log(`Iterations per test: ${ITERATIONS}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${os.platform()} ${os.arch()}`);
  console.log('');

  const schema = createSchema();
  const testData = generateTestData(BENCHMARK_ROWS);
  
  const results = {};
  
  // Test different compression methods
  const compressions = ['UNCOMPRESSED', 'GZIP', 'SNAPPY'];
  
  for (const compression of compressions) {
    console.log(`📊 Testing ${compression} compression...`);
    
    const writeResults = [];
    const readResults = [];
    
    for (let i = 0; i < ITERATIONS; i++) {
      const filename = `benchmark_${compression}_${i}.parquet`;
      
      // Benchmark write
      const writeTime = await benchmarkWrite(testData, schema, filename, compression);
      writeResults.push(writeTime);
      
      // Benchmark read
      const { duration: readTime, count } = await benchmarkRead(filename);
      readResults.push(readTime);
      
      // Get file size
      const stats = fs.statSync(filename);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      console.log(`  Iteration ${i + 1}: Write ${writeTime.toFixed(0)}ms, Read ${readTime.toFixed(0)}ms, Size ${fileSizeMB.toFixed(2)}MB`);
      
      // Cleanup
      fs.unlinkSync(filename);
    }
    
    const avgWrite = writeResults.reduce((a, b) => a + b) / writeResults.length;
    const avgRead = readResults.reduce((a, b) => a + b) / readResults.length;
    const writeRate = (BENCHMARK_ROWS / avgWrite) * 1000; // rows per second
    const readRate = (BENCHMARK_ROWS / avgRead) * 1000; // rows per second
    
    results[compression] = {
      avgWrite: avgWrite.toFixed(0),
      avgRead: avgRead.toFixed(0),
      writeRate: writeRate.toFixed(0),
      readRate: readRate.toFixed(0)
    };
    
    console.log(`  ✅ ${compression}: Write ${avgWrite.toFixed(0)}ms (${writeRate.toFixed(0)} rows/sec), Read ${avgRead.toFixed(0)}ms (${readRate.toFixed(0)} rows/sec)`);
    console.log('');
  }
  
  // Summary table
  console.log('📈 Performance Summary');
  console.log('=====================');
  console.log('Format      | Write (ms) | Write Rate | Read (ms) | Read Rate');
  console.log('------------|------------|------------|-----------|----------');
  
  for (const [compression, result] of Object.entries(results)) {
    const name = compression.padEnd(11);
    const writeMs = result.avgWrite.padStart(10);
    const writeRate = (result.writeRate + ' r/s').padStart(10);
    const readMs = result.avgRead.padStart(9);
    const readRate = (result.readRate + ' r/s').padStart(9);
    
    console.log(`${name} | ${writeMs} | ${writeRate} | ${readMs} | ${readRate}`);
  }
  
  return results;
}

// Run benchmarks if called directly
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

module.exports = { runBenchmarks, benchmarkWrite, benchmarkRead };