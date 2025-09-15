#!/usr/bin/env node
'use strict';

const parquet = require('./parquet.js');
const fs = require('fs');

// Deep performance profiler
class PerformanceProfiler {
  constructor() {
    this.timings = new Map();
    this.callCounts = new Map();
    this.memoryUsage = [];
  }

  start(label) {
    this.timings.set(label, process.hrtime.bigint());
    this.callCounts.set(label, (this.callCounts.get(label) || 0) + 1);
  }

  end(label) {
    const start = this.timings.get(label);
    if (start) {
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000; // ms
      const existing = this.timings.get(`${label}_total`) || 0;
      this.timings.set(`${label}_total`, existing + duration);
      return duration;
    }
    return 0;
  }

  recordMemory(label) {
    const usage = process.memoryUsage();
    this.memoryUsage.push({ label, ...usage, timestamp: Date.now() });
  }

  getReport() {
    const report = {
      timings: {},
      callCounts: Object.fromEntries(this.callCounts),
      memory: this.memoryUsage
    };

    for (const [key, value] of this.timings.entries()) {
      if (key.endsWith('_total')) {
        const baseKey = key.replace('_total', '');
        const count = this.callCounts.get(baseKey) || 1;
        report.timings[baseKey] = {
          total: value.toFixed(2) + 'ms',
          average: (value / count).toFixed(2) + 'ms',
          calls: count
        };
      }
    }

    return report;
  }
}

// Monkey patch critical functions for profiling
function instrumentParquet(profiler) {
  const originalShredRecord = parquet.ParquetShredder.shredRecord;
  parquet.ParquetShredder.shredRecord = function(schema, record, buffer) {
    profiler.start('shredRecord');
    const result = originalShredRecord.call(this, schema, record, buffer);
    profiler.end('shredRecord');
    return result;
  };

  // Instrument writer methods
  const ParquetWriter = parquet.ParquetWriter;
  const originalAppendRow = ParquetWriter.prototype.appendRow;
  ParquetWriter.prototype.appendRow = async function(row) {
    profiler.start('appendRow');
    const result = await originalAppendRow.call(this, row);
    profiler.end('appendRow');
    return result;
  };
}

async function deepProfile() {
  console.log('🔍 Deep Performance Profiling');
  console.log('==============================\n');

  const profiler = new PerformanceProfiler();
  instrumentParquet(profiler);

  // Create test data
  const schema = new parquet.ParquetSchema({
    id: { type: 'INT64' },
    name: { type: 'UTF8' },
    value: { type: 'DOUBLE' },
    active: { type: 'BOOLEAN' }
  });

  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push({
      id: i,
      name: `record_${i}`,
      value: Math.random() * 1000,
      active: i % 2 === 0
    });
  }

  profiler.recordMemory('start');

  // Profile write operations
  console.log('Profiling write operations...');
  profiler.start('totalWrite');
  
  const writer = await parquet.ParquetWriter.openFile(schema, 'profile_test.parquet');
  
  for (const row of testData) {
    await writer.appendRow(row);
  }
  
  await writer.close();
  profiler.end('totalWrite');
  profiler.recordMemory('afterWrite');

  // Profile read operations
  console.log('Profiling read operations...');
  profiler.start('totalRead');
  
  const reader = await parquet.ParquetReader.openFile('profile_test.parquet');
  const cursor = reader.getCursor();
  
  let count = 0;
  let record;
  while ((record = await cursor.next())) {
    count++;
  }
  
  await reader.close();
  profiler.end('totalRead');
  profiler.recordMemory('afterRead');

  // Cleanup
  fs.unlinkSync('profile_test.parquet');

  const report = profiler.getReport();
  
  console.log('\n📊 PROFILING RESULTS');
  console.log('=====================');
  
  console.log('\n⏱️ Operation Timings:');
  for (const [operation, data] of Object.entries(report.timings)) {
    console.log(`${operation.padEnd(15)}: ${data.total.padStart(10)} (avg: ${data.average}, calls: ${data.calls})`);
  }

  console.log('\n📈 Memory Usage Pattern:');
  const memStart = report.memory[0];
  for (let i = 1; i < report.memory.length; i++) {
    const mem = report.memory[i];
    const heapDiff = ((mem.heapUsed - memStart.heapUsed) / 1024 / 1024).toFixed(2);
    console.log(`${mem.label.padEnd(15)}: Heap +${heapDiff}MB`);
  }

  return report;
}

if (require.main === module) {
  deepProfile().catch(console.error);
}

module.exports = { deepProfile, PerformanceProfiler };