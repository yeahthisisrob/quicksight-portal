/**
 * Optimized build script using esbuild
 * Produces smaller, faster Lambda bundles
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json to get external dependencies
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

// AWS SDK v3 modules that are not included in Lambda runtime
const awsSdkV3Externals = dependencies.filter(dep => dep.startsWith('@aws-sdk/'));

/**
 * Validate OpenAPI schema and generate TypeScript types
 */
async function validateAndGenerateTypes() {
  const schemaPath = path.join(__dirname, '../../shared/schemas/api.openapi.yaml');
  const typesPath = path.join(__dirname, '../../shared/generated/types.ts');
  
  // Check if schema exists
  if (!fs.existsSync(schemaPath)) {
    console.warn('⚠️  OpenAPI schema not found, skipping validation');
    return;
  }
  
  try {
    // Validate schema using Redocly CLI
    console.log('🔍 Validating OpenAPI schema...');
    execSync(`npx @redocly/cli lint ${schemaPath} --skip-rule operation-4xx-response`, { 
      stdio: 'pipe',
      cwd: path.join(__dirname, '../..')
    });
    console.log('✅ Schema is valid');
    
    // Generate TypeScript types
    console.log('🔧 Generating TypeScript types from schema...');
    execSync(`npx openapi-typescript ${schemaPath} -o ${typesPath}`, {
      stdio: 'pipe',
      cwd: path.join(__dirname, '../..')
    });
    console.log('✅ Types generated successfully');
  } catch (error) {
    if (error.stdout) {
      const output = error.stdout.toString();
      if (output.includes('error') || output.includes('Error')) {
        console.error('❌ Schema validation failed:', output);
        process.exit(1);
      }
    }
    console.warn('⚠️  Schema validation had warnings but continuing build');
  }
}

async function build() {
  console.log('🚀 Starting optimized build with esbuild...');
  
  // Validate schema and generate types first
  await validateAndGenerateTypes();
  
  // For production builds, we use esbuild which handles everything
  // TypeScript is only for type checking during development
  
  try {
    // Build main API Lambda
    const result = await esbuild.build({
      entryPoints: ['./index.ts'],
      bundle: true,
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
      platform: 'node',
      target: 'node18',
      outfile: 'dist/index.js',
      
      // Path aliases for shared code
      alias: {
        '@shared': path.resolve(__dirname, '../../shared'),
      },
      
      // External dependencies that shouldn't be bundled
      external: [
        // Keep AWS SDK v3 external (provided by Lambda runtime)
        ...awsSdkV3Externals,
        // Native modules
        'aws-lambda',
        // Everything else (including aws-sdk v2 and powertools) will be bundled
      ],
      
      // Tree shaking
      treeShaking: true,
      
      // Generate metadata
      metafile: true,
      
      // Define environment variables
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      
      // Logging
      logLevel: 'info',
    });
    
    // Analyze bundle
    const outputs = Object.keys(result.metafile.outputs);
    const mainOutput = outputs.find(o => o.endsWith('index.js'));
    const bundleSize = result.metafile.outputs[mainOutput].bytes;
    
    console.log('✅ API Lambda build complete!');
    console.log(`📦 API Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Build worker Lambda
    console.log('\n🚀 Building worker Lambda...');
    const workerResult = await esbuild.build({
      entryPoints: ['./worker.ts'],
      bundle: true,
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
      platform: 'node',
      target: 'node18',
      outfile: 'dist/worker.js',
      
      // Path aliases for shared code
      alias: {
        '@shared': path.resolve(__dirname, '../../shared'),
      },
      
      // External dependencies that shouldn't be bundled
      external: [
        // Keep AWS SDK v3 external (provided by Lambda runtime)
        ...awsSdkV3Externals,
        // Native modules
        'aws-lambda',
      ],
      
      // Tree shaking
      treeShaking: true,
      
      // Generate metadata
      metafile: true,
      
      // Define environment variables
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      
      // Logging
      logLevel: 'info',
    });
    
    // Analyze worker bundle
    const workerOutputs = Object.keys(workerResult.metafile.outputs);
    const workerMainOutput = workerOutputs.find(o => o.endsWith('worker.js'));
    const workerBundleSize = workerResult.metafile.outputs[workerMainOutput].bytes;
    
    console.log('✅ Worker Lambda build complete!');
    console.log(`📦 Worker Bundle size: ${(workerBundleSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Write metafile for analysis
    fs.writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
    fs.writeFileSync('dist/worker-meta.json', JSON.stringify(workerResult.metafile, null, 2));
    
    // Create a layer package.json with production dependencies
    const layerPackageJson = {
      name: 'quicksight-portal-lambda-layer',
      version: packageJson.version,
      dependencies: packageJson.dependencies,
    };
    
    fs.writeFileSync(
      'dist/layer-package.json',
      JSON.stringify(layerPackageJson, null, 2)
    );
    
    console.log('📋 Layer package.json created');
    
    // Analyze dependencies
    analyzeDependencies(result.metafile);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

function analyzeDependencies(metafile) {
  console.log('\n📊 Bundle Analysis:');
  
  const inputs = Object.entries(metafile.inputs);
  const moduleStats = {};
  
  // Group by module
  inputs.forEach(([file, info]) => {
    const match = file.match(/node_modules\/([^\/]+)/);
    if (match) {
      const module = match[1];
      if (!moduleStats[module]) {
        moduleStats[module] = { count: 0, bytes: 0 };
      }
      moduleStats[module].count++;
      moduleStats[module].bytes += info.bytes;
    }
  });
  
  // Sort by size
  const sortedModules = Object.entries(moduleStats)
    .sort(([,a], [,b]) => b.bytes - a.bytes)
    .slice(0, 10);
  
  console.log('Top 10 largest dependencies:');
  sortedModules.forEach(([module, stats]) => {
    console.log(`  ${module}: ${(stats.bytes / 1024).toFixed(1)} KB (${stats.count} files)`);
  });
}

// Development build
async function buildDev() {
  console.log('🔧 Starting development build...');
  
  // Validate schema and generate types first
  await validateAndGenerateTypes();
  
  await esbuild.build({
    entryPoints: ['./index.ts'],
    bundle: true,
    sourcemap: 'inline',
    platform: 'node',
    target: 'node18',
    outfile: 'dist/index.js',
    external: [...awsSdkV3Externals, 'aws-lambda'],
    logLevel: 'info',
  });
  
  await esbuild.build({
    entryPoints: ['./worker.ts'],
    bundle: true,
    sourcemap: 'inline',
    platform: 'node',
    target: 'node18',
    outfile: 'dist/worker.js',
    external: [...awsSdkV3Externals, 'aws-lambda'],
    logLevel: 'info',
  });
  
  console.log('✅ Development build complete!');
}

// Watch mode
async function watch() {
  console.log('👀 Starting watch mode...');
  
  const apiCtx = await esbuild.context({
    entryPoints: ['./index.ts'],
    bundle: true,
    sourcemap: 'inline',
    platform: 'node',
    target: 'node18',
    outfile: 'dist/index.js',
    external: [...awsSdkV3Externals, 'aws-lambda'],
    logLevel: 'info',
  });
  
  const workerCtx = await esbuild.context({
    entryPoints: ['./worker.ts'],
    bundle: true,
    sourcemap: 'inline',
    platform: 'node',
    target: 'node18',
    outfile: 'dist/worker.js',
    external: [...awsSdkV3Externals, 'aws-lambda'],
    logLevel: 'info',
  });
  
  await apiCtx.watch();
  await workerCtx.watch();
  console.log('👀 Watching for changes...');
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'dev':
    buildDev();
    break;
  case 'watch':
    watch();
    break;
  default:
    build();
}