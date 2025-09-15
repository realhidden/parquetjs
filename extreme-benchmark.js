#!/usr/bin/env node
'use strict';

const parquet = require('./parquet.js');
const { UltraParquetWriter } = require('./lib/ultra-writer');
const { getMemoryPoolStats } = require('./lib/ultra-shred');
const fs = require('fs');
const os = require('os');

// Extreme performance benchmark with all optimizations enabled
const BENCHMARK_ROWS = 25000; // Increased for more stress testing
const ITERATIONS = 5;
const BATCH_SIZES = [50, 100, 500, 1000]; // Test different batch sizes

function generateComplexTestData(numRows) {
  const rows = [];
  const baseDate = new Date('2023-01-01');
  
  // Create more complex test data to stress-test optimizations
  for (let i = 0; i < numRows; i++) {
    rows.push({
      id: i,
      name: `user_${i}_${String(Math.random()).slice(2, 8)}`, // Variable length strings
      email: `user${i}@domain${i % 100}.com`,
      score: Math.random() * 1000,
      timestamp: new Date(baseDate.getTime() + i * 1000),
      active: i % 3 === 0,
      premium: i % 7 === 0,
      balance: Math.random() * 10000,
      tags: [`tag_${i % 20}`, `category_${i % 10}`, `segment_${i % 5}`],
      settings: {
        theme: i % 2 === 0 ? 'dark' : 'light',
        language: ['en', 'es', 'fr', 'de', 'ja'][i % 5],
        notifications: i % 4 === 0
      },
      metrics: [
        { name: 'clicks', value: Math.floor(Math.random() * 1000) },
        { name: 'views', value: Math.floor(Math.random() * 5000) },
        { name: 'conversions', value: Math.floor(Math.random() * 100) }
      ]
    });
  }
  
  return rows;
}

function createComplexSchema() {
  return new parquet.ParquetSchema({
    id: { type: 'INT64' },
    name: { type: 'UTF8' },
    email: { type: 'UTF8' },
    score: { type: 'DOUBLE' },
    timestamp: { type: 'TIMESTAMP_MILLIS' },
    active: { type: 'BOOLEAN' },
    premium: { type: 'BOOLEAN' },
    balance: { type: 'DOUBLE' },
    tags: { type: 'UTF8', repeated: true },
    settings: {
      fields: {
        theme: { type: 'UTF8' },
        language: { type: 'UTF8' },
        notifications: { type: 'BOOLEAN' }
      }
    },
    metrics: {
      repeated: true,
      fields: {
        name: { type: 'UTF8' },
        value: { type: 'INT32' }
      }
    }
  });
}

async function benchmarkOriginalWriter(rows, schema, filename, compression = 'UNCOMPRESSED') {
  const start = process.hrtime.bigint();
  
  const writer = await parquet.ParquetWriter.openFile(schema, filename, { compression });
  
  for (const row of rows) {
    await writer.appendRow(row);
  }
  
  await writer.close();
  
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // Convert to milliseconds
}

async function benchmarkUltraWriter(rows, schema, filename, batchSize, compression = 'UNCOMPRESSED') {
  const start = process.hrtime.bigint();
  
  const writer = await UltraParquetWriter.openFile(schema, filename, { 
    compression, 
    batchSize,
    autoFlush: true
  });
  
  // Process in batches for maximum efficiency
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await writer.appendRows(batch);
  }
  
  await writer.close();
  
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // Convert to milliseconds
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
  return { duration: Number(end - start) / 1_000_000, count };
}

async function runExtremePerformanceTest() {
  console.log('🚀 EXTREME ParquetJS Performance Benchmark');
  console.log('============================================');
  console.log(`Rows per test: ${BENCHMARK_ROWS.toLocaleString()}`);
  console.log(`Iterations per test: ${ITERATIONS}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${os.platform()} ${os.arch()}`);
  console.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
  console.log('');

  const schema = createComplexSchema();
  const testData = generateComplexTestData(BENCHMARK_ROWS);
  
  console.log('📊 Test Data Complexity:');
  console.log(`• ${testData[0].tags.length} tags per record`);
  console.log(`• ${testData[0].metrics.length} metrics per record`);
  console.log(`• Nested objects with ${Object.keys(testData[0].settings).length} settings`);
  console.log('');

  const results = {
    original: {},
    ultra: {},
    improvements: {}
  };

  // Test original implementation
  console.log('🔄 Testing ORIGINAL Implementation...');
  for (const compression of ['UNCOMPRESSED', 'SNAPPY']) {
    console.log(`  • ${compression}...`);
    
    const times = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const filename = `extreme_orig_${compression}_${i}.parquet`;
      const writeTime = await benchmarkOriginalWriter(testData, schema, filename, compression);
      times.push(writeTime);
      
      // Cleanup
      if (fs.existsSync(filename)) fs.unlinkSync(filename);
    }
    
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const rate = (BENCHMARK_ROWS / avgTime) * 1000;
    
    results.original[compression] = {
      avgTime: avgTime.toFixed(0),
      rate: rate.toFixed(0)
    };
    
    console.log(`    Average: ${avgTime.toFixed(0)}ms (${rate.toFixed(0)} rows/sec)`);
  }

  // Test ultra-optimized implementation with different batch sizes
  console.log('\n⚡ Testing ULTRA-OPTIMIZED Implementation...');
  for (const compression of ['UNCOMPRESSED', 'SNAPPY']) {
    console.log(`  • ${compression}...`);
    
    let bestTime = Infinity;
    let bestBatchSize = 0;
    let bestRate = 0;
    
    for (const batchSize of BATCH_SIZES) {
      const times = [];
      
      for (let i = 0; i < ITERATIONS; i++) {
        const filename = `extreme_ultra_${compression}_${batchSize}_${i}.parquet`;
        const writeTime = await benchmarkUltraWriter(testData, schema, filename, batchSize, compression);
        times.push(writeTime);
        
        // Cleanup
        if (fs.existsSync(filename)) fs.unlinkSync(filename);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const rate = (BENCHMARK_ROWS / avgTime) * 1000;
      
      if (avgTime < bestTime) {
        bestTime = avgTime;
        bestBatchSize = batchSize;
        bestRate = rate;
      }
      
      console.log(`    Batch ${batchSize}: ${avgTime.toFixed(0)}ms (${rate.toFixed(0)} rows/sec)`);
    }
    
    results.ultra[compression] = {
      avgTime: bestTime.toFixed(0),
      rate: bestRate.toFixed(0),
      bestBatchSize
    };
    
    console.log(`    ✅ Best: Batch ${bestBatchSize} - ${bestTime.toFixed(0)}ms (${bestRate.toFixed(0)} rows/sec)`);
  }

  // Calculate improvements
  console.log('\n🎯 PERFORMANCE IMPROVEMENTS');
  console.log('============================');
  console.log('Format       | Original  | Ultra     | Improvement | Throughput Gain');
  console.log('-------------|-----------|-----------|-------------|----------------');
  
  for (const compression of ['UNCOMPRESSED', 'SNAPPY']) {
    const orig = results.original[compression];
    const ultra = results.ultra[compression];
    
    const timeImprovement = ((parseFloat(orig.avgTime) - parseFloat(ultra.avgTime)) / parseFloat(orig.avgTime)) * 100;
    const throughputGain = ((parseFloat(ultra.rate) - parseFloat(orig.rate)) / parseFloat(orig.rate)) * 100;
    
    results.improvements[compression] = {
      timeImprovement: timeImprovement.toFixed(1),
      throughputGain: throughputGain.toFixed(1)
    };
    
    const name = compression.padEnd(12);
    const origTime = (orig.avgTime + 'ms').padStart(9);
    const ultraTime = (ultra.avgTime + 'ms').padStart(9);
    const improvement = (timeImprovement.toFixed(1) + '%').padStart(11);
    const gain = (throughputGain.toFixed(1) + '%').padStart(15);
    
    console.log(`${name} | ${origTime} | ${ultraTime} | ${improvement} | ${gain}`);
  }

  // Memory pool statistics
  const memoryStats = getMemoryPoolStats();
  console.log('\n🧠 MEMORY POOL STATISTICS');
  console.log('==========================');
  console.log(`Record Pool: ${memoryStats.recordPool.available} available, ${memoryStats.recordPool.inUse} in use`);
  console.log(`Array Pool:  ${memoryStats.arrayPool.available} available, ${memoryStats.arrayPool.inUse} in use`);

  // Final summary
  const avgTimeImprovement = Object.values(results.improvements)
    .reduce((sum, imp) => sum + parseFloat(imp.timeImprovement), 0) / 2;
  const avgThroughputGain = Object.values(results.improvements)
    .reduce((sum, imp) => sum + parseFloat(imp.throughputGain), 0) / 2;

  console.log('\n🏆 FINAL RESULTS');
  console.log('=================');
  console.log(`Average Time Improvement:    ${avgTimeImprovement.toFixed(1)}%`);
  console.log(`Average Throughput Gain:     ${avgThroughputGain.toFixed(1)}%`);
  console.log(`Best Configuration:          Batch size ${results.ultra.SNAPPY.bestBatchSize}`);
  console.log(`Peak Performance:            ${Math.max(parseFloat(results.ultra.UNCOMPRESSED.rate), parseFloat(results.ultra.SNAPPY.rate)).toFixed(0)} rows/sec`);

  console.log('\n🔥 OPTIMIZATIONS IMPLEMENTED:');
  console.log('• Ultra-fast mutex (no async-mutex overhead)');
  console.log('• Memory pooling (reduced GC pressure)');
  console.log('• Pre-compiled field accessors');
  console.log('• Optimized data structures');
  console.log('• SIMD-like buffer operations');
  console.log('• Batch processing with optimal sizes');
  console.log('• Typed array usage for numeric data');
  console.log('• Eliminated object allocations in hot paths');

  return results;
}

if (require.main === module) {
  runExtremePerformanceTest().catch(console.error);
}

module.exports = { runExtremePerformanceTest };