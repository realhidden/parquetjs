#!/usr/bin/env node
'use strict';

const { runBenchmarks } = require('./benchmark.js');
const { runOptimizedBenchmarks } = require('./benchmark-optimized.js');

async function comparePerformance() {
  console.log('🔥 ParquetJS Performance Comparison');
  console.log('=====================================\n');

  console.log('Running original benchmarks...');
  const originalResults = await runBenchmarks();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('Running optimized benchmarks...');
  const optimizedResults = await runOptimizedBenchmarks();
  
  // Debug: Check if results are properly returned
  if (!originalResults) {
    console.error('Original results are undefined');
    return;
  }
  if (!optimizedResults) {
    console.error('Optimized results are undefined');  
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Calculate improvements
  console.log('🚀 PERFORMANCE IMPROVEMENTS');
  console.log('============================');
  console.log('Format      | Write Improv | Read Improv | Write Rate Improv | Read Rate Improv');
  console.log('------------|--------------|-------------|-------------------|------------------');
  
  const formats = ['UNCOMPRESSED', 'GZIP', 'SNAPPY'];
  let totalWriteImprovement = 0;
  let totalReadImprovement = 0;
  
  for (const format of formats) {
    const orig = originalResults[format];
    const opt = optimizedResults[format];
    
    const writeImprovement = ((parseFloat(orig.avgWrite) - parseFloat(opt.avgWrite)) / parseFloat(orig.avgWrite)) * 100;
    const readImprovement = ((parseFloat(orig.avgRead) - parseFloat(opt.avgRead)) / parseFloat(orig.avgRead)) * 100;
    const writeRateImprovement = ((parseFloat(opt.writeRate) - parseFloat(orig.writeRate)) / parseFloat(orig.writeRate)) * 100;
    const readRateImprovement = ((parseFloat(opt.readRate) - parseFloat(orig.readRate)) / parseFloat(orig.readRate)) * 100;
    
    totalWriteImprovement += writeImprovement;
    totalReadImprovement += readImprovement;
    
    const name = format.padEnd(11);
    const writeImp = (writeImprovement >= 0 ? '+' : '') + writeImprovement.toFixed(1) + '%';
    const readImp = (readImprovement >= 0 ? '+' : '') + readImprovement.toFixed(1) + '%';
    const writeRateImp = (writeRateImprovement >= 0 ? '+' : '') + writeRateImprovement.toFixed(1) + '%';
    const readRateImp = (readRateImprovement >= 0 ? '+' : '') + readRateImprovement.toFixed(1) + '%';
    
    console.log(`${name} | ${writeImp.padStart(12)} | ${readImp.padStart(11)} | ${writeRateImp.padStart(17)} | ${readRateImp.padStart(16)}`);
  }
  
  const avgWriteImprovement = totalWriteImprovement / formats.length;
  const avgReadImprovement = totalReadImprovement / formats.length;
  
  console.log('\n📊 SUMMARY');
  console.log('===========');
  console.log(`Average Write Time Improvement: ${avgWriteImprovement.toFixed(1)}%`);
  console.log(`Average Read Time Improvement:  ${avgReadImprovement.toFixed(1)}%`);
  
  console.log('\n🎯 KEY OPTIMIZATIONS IMPLEMENTED:');
  console.log('• Replaced Array.prototype.push.apply with spread operator in data shredding');
  console.log('• Pre-allocated arrays in decoders instead of using push operations');
  console.log('• Added batch write functionality to reduce mutex overhead');
  console.log('• Optimized buffer operations with direct index assignment');
  
  // Test performance improvements
  console.log('\n⏱️ TESTING PERFORMANCE WITH ACTUAL TESTS:');
  const testStart = process.hrtime.bigint();
  
  // Import and run a quick test
  const { execSync } = require('child_process');
  try {
    execSync('npm test > /dev/null 2>&1');
    const testEnd = process.hrtime.bigint();
    const testDuration = Number(testEnd - testStart) / 1_000_000_000; // Convert to seconds
    console.log(`Full test suite completed in: ${testDuration.toFixed(2)} seconds`);
  } catch (error) {
    console.log('Test execution failed, but benchmarks are still valid');
  }
}

if (require.main === module) {
  comparePerformance().catch(console.error);
}