#!/usr/bin/env node
/**
 * Route + Sidebar Registration
 *
 * Updates the 3 frontend files needed to register a new page:
 *   1. frontend/src/routes/lazy-routes.tsx (lazy import)
 *   2. frontend/src/App.tsx (route definition)
 *   3. Prints sidebar entry snippet for manual addition
 *
 * Also handles backend route registration in routes/index.ts.
 *
 * Usage:
 *   node scripts/skills/register-route.js --page <PageName> --route <path> [--section <SidebarSection>] [--icon <IconName>] [--backend <moduleName>] [--preview] [--help]
 *
 * Examples:
 *   node scripts/skills/register-route.js --page WarehouseList --route /warehouses --section Masters --icon Warehouse
 *   node scripts/skills/register-route.js --page WarehouseList --route /warehouses --backend warehouse --preview
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m',
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

// ─── Argument Parsing ─────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { page: '', route: '', section: '', icon: '', backend: '', preview: false, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--page': parsed.page = args[++i] || ''; break;
      case '--route': parsed.route = args[++i] || ''; break;
      case '--section': parsed.section = args[++i] || ''; break;
      case '--icon': parsed.icon = args[++i] || ''; break;
      case '--backend': parsed.backend = args[++i] || ''; break;
      case '--preview': parsed.preview = true; break;
      case '--help': parsed.help = true; break;
    }
  }
  return parsed;
}

// ─── File Updaters ────────────────────────────────────────────

function updateLazyRoutes(pageName, preview) {
  const filePath = path.join(process.cwd(), 'frontend', 'src', 'routes', 'lazy-routes.tsx');

  if (!fs.existsSync(filePath)) {
    console.log(`  ${c('yellow', '⚠')}  lazy-routes.tsx not found at expected path`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lazyLine = `export const ${pageName} = lazy(() => import('@/pages/${pageName}'));`;

  // Check if already registered
  if (content.includes(pageName)) {
    console.log(`  ${c('yellow', '⚠')}  ${pageName} already exists in lazy-routes.tsx`);
    return false;
  }

  if (preview) {
    console.log(`  ${c('cyan', '📄')} ${c('dim', 'Would add to')} frontend/src/routes/lazy-routes.tsx:`);
    console.log(`     ${c('dim', lazyLine)}`);
    return true;
  }

  // Add before the last line (or at end)
  const newContent = content.trimEnd() + '\n' + lazyLine + '\n';
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`  ${c('green', '✓')}  Added lazy import to lazy-routes.tsx`);
  return true;
}

function updateAppRoutes(pageName, routePath, preview) {
  const filePath = path.join(process.cwd(), 'frontend', 'src', 'App.tsx');

  if (!fs.existsSync(filePath)) {
    console.log(`  ${c('yellow', '⚠')}  App.tsx not found at expected path`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check if route already exists
  if (content.includes(`path="${routePath}"`) || content.includes(`path={"${routePath}"}`)) {
    console.log(`  ${c('yellow', '⚠')}  Route "${routePath}" already exists in App.tsx`);
    return false;
  }

  // Check if page component is imported in lazy-routes
  const hasLazyImport = content.includes(pageName);

  const routeSnippet = `                <Route path="${routePath}" element={<ProtectedRoute><Suspense fallback={<LoadingSpinner />}><${pageName} /></Suspense></ProtectedRoute>} />`;

  if (preview) {
    console.log(`  ${c('cyan', '📄')} ${c('dim', 'Would add to')} frontend/src/App.tsx:`);
    console.log(`     ${c('dim', routeSnippet.trim())}`);
    if (!hasLazyImport) {
      console.log(`     ${c('yellow', 'Note:')} Also need to import ${pageName} from lazy-routes.tsx`);
    }
    return true;
  }

  // Find a good insertion point — look for the last Route element before closing Routes
  // Strategy: find the last </Route> or /> in the routes section and insert before it
  const routeEndPattern = /(\s*<\/Routes>)/;
  const routeEndMatch = content.match(routeEndPattern);

  if (!routeEndMatch) {
    console.log(`  ${c('yellow', '⚠')}  Could not find </Routes> in App.tsx. Add route manually:`);
    console.log(`     ${c('dim', routeSnippet.trim())}`);
    return false;
  }

  const insertIndex = content.indexOf(routeEndMatch[0]);
  const newContent = content.slice(0, insertIndex) + routeSnippet + '\n' + content.slice(insertIndex);
  fs.writeFileSync(filePath, newContent, 'utf8');

  // Also add import if not present
  if (!hasLazyImport) {
    const updatedContent = fs.readFileSync(filePath, 'utf8');
    // Find existing lazy-routes import and add the new component
    const lazyImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@?\.?\/routes\/lazy-routes['"]/;
    const lazyMatch = updatedContent.match(lazyImportRegex);
    if (lazyMatch) {
      const existingImports = lazyMatch[1].trim();
      const newImports = existingImports + `,\n  ${pageName}`;
      const newImportLine = updatedContent.replace(lazyMatch[0],
        `import {\n  ${newImports}\n} from '@/routes/lazy-routes'`
      );
      // This is getting complex — better to just note it
    }
    console.log(`  ${c('yellow', '⚠')}  Remember to add ${pageName} to the lazy-routes import in App.tsx`);
  }

  console.log(`  ${c('green', '✓')}  Added route "${routePath}" to App.tsx`);
  return true;
}

function updateBackendRoutes(moduleName, preview) {
  if (!moduleName) return false;

  const indexPath = path.join(process.cwd(), 'backend', 'src', 'routes', 'index.ts');
  if (!fs.existsSync(indexPath)) {
    console.log(`  ${c('yellow', '⚠')}  routes/index.ts not found`);
    return false;
  }

  const content = fs.readFileSync(indexPath, 'utf8');
  const plural = moduleName.endsWith('y')
    ? moduleName.slice(0, -1) + 'ies'
    : moduleName.endsWith('s') ? moduleName : moduleName + 's';

  const importLine = `import ${moduleName}Routes from './${moduleName}.routes';`;
  const useLine = `  router.use('/${plural}', ${moduleName}Routes);`;

  if (content.includes(`${moduleName}Routes`)) {
    console.log(`  ${c('yellow', '⚠')}  ${moduleName}Routes already registered in routes/index.ts`);
    return false;
  }

  if (preview) {
    console.log(`  ${c('cyan', '📄')} ${c('dim', 'Would add to')} backend/src/routes/index.ts:`);
    console.log(`     ${c('dim', importLine)}`);
    console.log(`     ${c('dim', useLine)}`);
    return true;
  }

  // Add import at the top (after last import)
  const lastImportIndex = content.lastIndexOf('import ');
  const endOfLastImport = content.indexOf('\n', lastImportIndex);
  const newContent1 = content.slice(0, endOfLastImport + 1) + importLine + '\n' + content.slice(endOfLastImport + 1);

  // Add router.use before the last router.use or before export/return
  const lastUseLine = newContent1.lastIndexOf('router.use(');
  const endOfLastUse = newContent1.indexOf('\n', lastUseLine);
  const newContent2 = newContent1.slice(0, endOfLastUse + 1) + useLine + '\n' + newContent1.slice(endOfLastUse + 1);

  fs.writeFileSync(indexPath, newContent2, 'utf8');
  console.log(`  ${c('green', '✓')}  Registered ${moduleName}Routes in routes/index.ts`);
  return true;
}

// ─── Sidebar Snippet ──────────────────────────────────────────

function printSidebarSnippet(pageName, routePath, section, icon) {
  console.log(`\n  ${c('yellow', 'Manual step:')} Add sidebar entry in ${c('bright', 'frontend/src/components/Sidebar.tsx')}`);
  console.log(`  Under the "${section || 'appropriate'}" section, add:\n`);

  const iconName = icon || 'FileText';
  console.log(c('dim', `    {
      title: '${pageName.replace(/List$/, '').replace(/([A-Z])/g, ' $1').trim()}',
      path: '${routePath}',
      icon: ${iconName},
    },`));
  console.log();
  if (icon) {
    console.log(c('dim', `  Don't forget to import: import { ${iconName} } from 'lucide-react';`));
  }
}

// ─── Help ─────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${c('bright', c('cyan', 'Route + Sidebar Registration'))}

Updates frontend files to register a new page route.

${c('bright', 'Usage:')}
  node scripts/skills/register-route.js --page <PageName> --route <path> [options]

${c('bright', 'Required:')}
  ${c('cyan', '--page')}      Page component name (e.g., WarehouseList)
  ${c('cyan', '--route')}     URL path (e.g., /warehouses)

${c('bright', 'Options:')}
  ${c('cyan', '--section')}   Sidebar section name (e.g., Masters, Manufacturing)
  ${c('cyan', '--icon')}      Lucide icon name (e.g., Warehouse, Package)
  ${c('cyan', '--backend')}   Backend module name to also register in routes/index.ts
  ${c('cyan', '--preview')}   Show what would change without modifying files
  ${c('cyan', '--help')}      Show this help

${c('bright', 'Updates these files:')}
  1. frontend/src/routes/lazy-routes.tsx (lazy import)
  2. frontend/src/App.tsx (route definition)
  3. backend/src/routes/index.ts (if --backend specified)
  + Prints sidebar snippet for manual addition

${c('bright', 'Examples:')}
  node scripts/skills/register-route.js --page WarehouseList --route /warehouses --section Masters --icon Warehouse
  node scripts/skills/register-route.js --page WarehouseList --route /warehouses --backend warehouse --preview
`);
}

// ─── Main ─────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) { showHelp(); return 0; }

  if (!args.page || !args.route) {
    console.error(`${c('red', 'Error:')} --page and --route are required. Use --help for usage.`);
    return 1;
  }

  const { page, route, section, icon, backend, preview } = args;

  console.log(`\n${c('bright', c('cyan', '=== Route Registration ==='))}\n`);
  console.log(`  Page:     ${c('bright', page)}`);
  console.log(`  Route:    ${route}`);
  if (section) console.log(`  Section:  ${section}`);
  if (icon) console.log(`  Icon:     ${icon}`);
  if (backend) console.log(`  Backend:  ${backend}`);
  console.log(`  Mode:     ${preview ? c('yellow', 'PREVIEW') : c('green', 'APPLY')}\n`);

  let changes = 0;

  // 1. Lazy routes
  console.log(`${c('bright', '1. Lazy Routes')}`);
  if (updateLazyRoutes(page, preview)) changes++;
  console.log();

  // 2. App.tsx routes
  console.log(`${c('bright', '2. App Routes')}`);
  if (updateAppRoutes(page, route, preview)) changes++;
  console.log();

  // 3. Backend routes (optional)
  if (backend) {
    console.log(`${c('bright', '3. Backend Routes')}`);
    if (updateBackendRoutes(backend, preview)) changes++;
    console.log();
  }

  // 4. Sidebar snippet (always manual)
  console.log(`${c('bright', `${backend ? '4' : '3'}. Sidebar`)}`);
  printSidebarSnippet(page, route, section, icon);

  // Summary
  console.log(`${c('cyan', '─'.repeat(50))}`);
  if (preview) {
    console.log(`\n${c('yellow', 'Preview complete.')} Run without --preview to apply changes.\n`);
  } else {
    console.log(`\n${c('green', `✓ ${changes} file(s) updated.`)} Complete the sidebar entry manually.\n`);
  }

  return 0;
}

if (require.main === module) {
  process.exit(main());
}
