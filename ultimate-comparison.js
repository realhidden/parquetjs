#!/usr/bin/env node
'use strict';

const parquet = require('./parquet.js');
const parquetUltra = require('./parquet-ultra.js');
const fs = require('fs');
const { performance } = require('perf_hooks');

// Ultimate comparison: Original vs All Optimizations
async function ultimateComparison() {
  console.log('🚀 ULTIMATE PARQUET PERFORMANCE COMPARISON');
  console.log('===========================================\n');

  const ROWS = 50000; // Even more stress testing
  
  // Create ultra-complex test data
  const testData = [];
  for (let i = 0; i < ROWS; i++) {
    testData.push({
      user_id: i,
      username: `user_${i}_${Math.random().toString(36).slice(2)}`,
      email: `user${i}@example${i % 1000}.com`,
      first_name: `FirstName${i}`,
      last_name: `LastName${i}`,
      age: 18 + (i % 60),
      balance: Math.random() * 100000,
      score: Math.random() * 1000,
      rating: Math.random() * 5,
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      updated_at: new Date(),
      is_active: i % 3 === 0,
      is_premium: i % 7 === 0,
      is_verified: i % 11 === 0,
      preferences: {
        theme: ['light', 'dark'][i % 2],
        language: ['en', 'es', 'fr', 'de', 'ja'][i % 5],
        timezone: `UTC${(i % 24) - 12}`,
        notifications: {
          email: i % 4 === 0,
          sms: i % 6 === 0,
          push: i % 8 === 0
        }
      },
      tags: [
        `category_${i % 20}`,
        `segment_${i % 10}`,
        `region_${i % 50}`,
        `tier_${i % 5}`
      ],
      metrics: [
        { name: 'login_count', value: Math.floor(Math.random() * 1000) },
        { name: 'session_duration', value: Math.floor(Math.random() * 3600) },
        { name: 'page_views', value: Math.floor(Math.random() * 10000) },
        { name: 'clicks', value: Math.floor(Math.random() * 500) },
        { name: 'purchases', value: Math.floor(Math.random() * 50) }
      ],
      activities: generateActivities(i, 5 + (i % 10))
    });
  }

  function generateActivities(userId, count) {
    const activities = [];
    const actionTypes = ['click', 'view', 'purchase', 'like', 'share', 'comment'];
    
    for (let i = 0; i < count; i++) {
      activities.push({
        id: userId * 1000 + i,
        action: actionTypes[i % actionTypes.length],
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        value: Math.random() * 100
      });
    }
    return activities;
  }

  const complexSchema = new parquet.ParquetSchema({
    user_id: { type: 'INT64' },
    username: { type: 'UTF8' },
    email: { type: 'UTF8' },
    first_name: { type: 'UTF8' },
    last_name: { type: 'UTF8' },
    age: { type: 'INT32' },
    balance: { type: 'DOUBLE' },
    score: { type: 'DOUBLE' },
    rating: { type: 'FLOAT' },
    created_at: { type: 'TIMESTAMP_MILLIS' },
    updated_at: { type: 'TIMESTAMP_MILLIS' },
    is_active: { type: 'BOOLEAN' },
    is_premium: { type: 'BOOLEAN' },
    is_verified: { type: 'BOOLEAN' },
    preferences: {
      fields: {
        theme: { type: 'UTF8' },
        language: { type: 'UTF8' },
        timezone: { type: 'UTF8' },
        notifications: {
          fields: {
            email: { type: 'BOOLEAN' },
            sms: { type: 'BOOLEAN' },
            push: { type: 'BOOLEAN' }
          }
        }
      }
    },
    tags: { type: 'UTF8', repeated: true },
    metrics: {
      repeated: true,
      fields: {
        name: { type: 'UTF8' },
        value: { type: 'INT32' }
      }
    },
    activities: {
      repeated: true,
      fields: {
        id: { type: 'INT64' },
        action: { type: 'UTF8' },
        timestamp: { type: 'TIMESTAMP_MILLIS' },
        value: { type: 'DOUBLE' }
      }
    }
  });

  console.log(`📊 Ultra-Complex Test Dataset:`);
  console.log(`• ${ROWS.toLocaleString()} records`);
  console.log(`• ${Object.keys(complexSchema.fields).length} top-level fields`);
  console.log(`• Deeply nested structures (3+ levels)`);
  console.log(`• Multiple repeated fields with varying lengths`);
  console.log(`• ${testData[0].tags.length} tags per record`);
  console.log(`• ${testData[0].metrics.length} metrics per record`);
  console.log(`• ~${testData[0].activities.length} activities per record (variable)`);
  console.log('');

  // Test 1: Original Implementation
  console.log('🐌 ORIGINAL Implementation Test...');
  const originalStart = performance.now();
  
  const originalWriter = await parquet.ParquetWriter.openFile(
    complexSchema, 
    'ultimate_original.parquet',
    { compression: 'SNAPPY' }
  );
  
  for (const row of testData) {
    await originalWriter.appendRow(row);
  }
  
  await originalWriter.close();
  const originalTime = performance.now() - originalStart;
  const originalRate = (ROWS / originalTime) * 1000;
  
  console.log(`   Time: ${originalTime.toFixed(0)}ms`);
  console.log(`   Rate: ${originalRate.toFixed(0)} rows/sec`);
  
  const originalStats = fs.statSync('ultimate_original.parquet');
  console.log(`   Size: ${(originalStats.size / 1024 / 1024).toFixed(2)}MB`);

  // Test 2: Ultra-Optimized Implementation
  console.log('\n⚡ ULTRA-OPTIMIZED Implementation Test...');
  const ultraStart = performance.now();
  
  const ultraWriter = await parquetUltra.UltraParquetWriter.openFile(
    complexSchema, 
    'ultimate_ultra.parquet',
    { 
      compression: 'SNAPPY',
      batchSize: 500,
      autoFlush: true
    }
  );
  
  // Process in optimized batches
  const batchSize = 500;
  for (let i = 0; i < testData.length; i += batchSize) {
    const batch = testData.slice(i, i + batchSize);
    await ultraWriter.appendRows(batch);
  }
  
  await ultraWriter.close();
  const ultraTime = performance.now() - ultraStart;
  const ultraRate = (ROWS / ultraTime) * 1000;
  
  console.log(`   Time: ${ultraTime.toFixed(0)}ms`);
  console.log(`   Rate: ${ultraRate.toFixed(0)} rows/sec`);
  
  const ultraStats = fs.statSync('ultimate_ultra.parquet');
  console.log(`   Size: ${(ultraStats.size / 1024 / 1024).toFixed(2)}MB`);

  // Verify data integrity
  console.log('\n🔍 Data Integrity Verification...');
  const originalReader = await parquet.ParquetReader.openFile('ultimate_original.parquet');
  const ultraReader = await parquet.ParquetReader.openFile('ultimate_ultra.parquet');
  
  console.log(`   Original rows: ${originalReader.getRowCount()}`);
  console.log(`   Ultra rows:    ${ultraReader.getRowCount()}`);
  console.log(`   ✅ Row count match: ${originalReader.getRowCount() === ultraReader.getRowCount()}`);
  
  await originalReader.close();
  await ultraReader.close();

  // Calculate final improvements
  const timeImprovement = ((originalTime - ultraTime) / originalTime) * 100;
  const throughputGain = ((ultraRate - originalRate) / originalRate) * 100;
  
  console.log('\n🏆 ULTIMATE PERFORMANCE RESULTS');
  console.log('================================');
  console.log(`Speed Improvement:    ${timeImprovement.toFixed(1)}%`);
  console.log(`Throughput Gain:      ${throughputGain.toFixed(1)}%`);
  console.log(`Processing Rate:      ${ultraRate.toFixed(0)} rows/sec (was ${originalRate.toFixed(0)})`);
  console.log(`Time Saved:           ${(originalTime - ultraTime).toFixed(0)}ms per ${ROWS.toLocaleString()} records`);
  
  if (timeImprovement > 0) {
    console.log(`⚡ Performance multiplier: ${(originalTime / ultraTime).toFixed(1)}x faster`);
  }
  
  console.log('\n🔥 ALL OPTIMIZATIONS APPLIED:');
  console.log('• Ultra-fast custom mutex (replaced async-mutex)');
  console.log('• Memory pooling with object reuse');
  console.log('• Pre-compiled field accessors with caching');
  console.log('• SIMD-like buffer operations');
  console.log('• Typed arrays for numeric data');
  console.log('• Batch processing with optimal sizing');
  console.log('• Eliminated allocations in hot code paths');
  console.log('• Optimized bit manipulation for boolean encoding');
  console.log('• DataView for fast numeric serialization');
  console.log('• Custom data structures for high-frequency operations');

  // Cleanup
  fs.unlinkSync('ultimate_original.parquet');
  fs.unlinkSync('ultimate_ultra.parquet');
  
  return {
    originalTime,
    ultraTime,
    timeImprovement,
    throughputGain,
    originalRate,
    ultraRate
  };
}

if (require.main === module) {
  ultimateComparison().catch(console.error);
}

module.exports = { ultimateComparison };