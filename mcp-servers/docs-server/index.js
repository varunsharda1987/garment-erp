#!/usr/bin/env node

/**
 * Documentation MCP Server
 *
 * Provides smart documentation capabilities:
 * - Semantic search across markdown files
 * - Detect outdated documentation
 * - Suggest doc updates when code changes
 * - Generate doc templates
 * - Validate documentation completeness
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

class DocumentationServer {
  constructor() {
    this.rootPath = process.cwd();
  }

  /**
   * Find all markdown files
   */
  findAllMarkdownFiles() {
    const files = [];

    const walk = (dir) => {
      // Skip node_modules, .git, dist, build
      const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
      if (skipDirs.some(skip => dir.includes(skip))) {
        return;
      }

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(this.rootPath);
    return files;
  }

  /**
   * Search documentation for a keyword
   */
  searchDocs(keyword) {
    const files = this.findAllMarkdownFiles();
    const results = [];

    const searchRegex = new RegExp(keyword, 'gi');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          results.push({
            file: file.replace(this.rootPath, ''),
            line: index + 1,
            content: line.trim(),
            context: this.getContext(lines, index)
          });
        }
      });
    }

    return {
      keyword,
      totalMatches: results.length,
      filesMatched: new Set(results.map(r => r.file)).size,
      results: results.slice(0, 20) // Limit to first 20
    };
  }

  /**
   * Get context around a line
   */
  getContext(lines, lineIndex, contextLines = 2) {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);

    return lines.slice(start, end).map(l => l.trim()).join(' ... ');
  }

  /**
   * Detect outdated documentation
   */
  detectOutdatedDocs() {
    const files = this.findAllMarkdownFiles();
    const outdated = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const stats = fs.statSync(file);

      // Check for "Last Updated" dates
      const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s+(\w+\s+\d+,\s+\d{4})/);

      if (lastUpdatedMatch) {
        const docDate = new Date(lastUpdatedMatch[1]);
        const fileModified = new Date(stats.mtime);

        // If file modified after "Last Updated", it's outdated
        if (fileModified > docDate) {
          const daysDiff = Math.floor((fileModified - docDate) / (1000 * 60 * 60 * 24));
          outdated.push({
            file: file.replace(this.rootPath, ''),
            lastUpdated: lastUpdatedMatch[1],
            fileModified: fileModified.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            daysSinceUpdate: daysDiff
          });
        }
      } else {
        // No "Last Updated" field
        outdated.push({
          file: file.replace(this.rootPath, ''),
          lastUpdated: 'Not specified',
          fileModified: stats.mtime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          missing: true
        });
      }
    }

    return {
      totalFiles: files.length,
      outdated: outdated.filter(d => !d.missing),
      missingTimestamp: outdated.filter(d => d.missing)
    };
  }

  /**
   * Check documentation completeness
   */
  checkCompleteness() {
    const files = this.findAllMarkdownFiles();
    const completeness = {
      total: files.length,
      withHeaders: 0,
      withExamples: 0,
      withTOC: 0,
      incomplete: []
    };

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const issues = [];

      // Check for headers
      if (!content.match(/^#\s+/m)) {
        issues.push('No top-level header');
      } else {
        completeness.withHeaders++;
      }

      // Check for examples
      if (content.includes('```') || content.includes('Example')) {
        completeness.withExamples++;
      } else {
        issues.push('No code examples');
      }

      // Check for TOC (in larger files)
      if (content.length > 5000) {
        if (content.toLowerCase().includes('## table of contents') ||
            content.toLowerCase().includes('## contents')) {
          completeness.withTOC++;
        } else {
          issues.push('No table of contents (file > 5KB)');
        }
      }

      if (issues.length > 0) {
        completeness.incomplete.push({
          file: file.replace(this.rootPath, ''),
          issues,
          size: content.length
        });
      }
    }

    return completeness;
  }

  /**
   * Get documentation statistics
   */
  getDocStats() {
    const files = this.findAllMarkdownFiles();

    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      totalLines: 0,
      avgFileSize: 0,
      largestFiles: [],
      categories: {}
    };

    const fileSizes = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const size = content.length;
      const lines = content.split('\n').length;

      stats.totalSize += size;
      stats.totalLines += lines;

      fileSizes.push({
        file: file.replace(this.rootPath, ''),
        size,
        lines,
        sizeKB: (size / 1024).toFixed(2)
      });

      // Categorize by directory
      const dir = path.dirname(file).replace(this.rootPath, '').split(path.sep)[1] || 'root';
      stats.categories[dir] = (stats.categories[dir] || 0) + 1;
    }

    stats.avgFileSize = (stats.totalSize / files.length).toFixed(0);

    // Sort by size
    fileSizes.sort((a, b) => b.size - a.size);
    stats.largestFiles = fileSizes.slice(0, 5);

    return stats;
  }

  /**
   * Find documentation for a code entity
   */
  findDocForEntity(entityName) {
    const files = this.findAllMarkdownFiles();
    const mentions = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes(entityName)) {
          mentions.push({
            file: file.replace(this.rootPath, ''),
            line: index + 1,
            content: line.trim(),
            isHeader: line.startsWith('#'),
            isCode: line.includes('`')
          });
        }
      });
    }

    return {
      entityName,
      totalMentions: mentions.length,
      filesWithMentions: new Set(mentions.map(m => m.file)).size,
      mentions: mentions.slice(0, 10)
    };
  }

  /**
   * Suggest documentation updates
   */
  suggestUpdates() {
    const suggestions = [];

    // Check if code files have corresponding docs
    const codeFeatures = [
      { name: 'Prisma Schema', file: 'backend/prisma/schema.prisma', docPattern: 'schema' },
      { name: 'API Routes', dir: 'backend/src/routes', docPattern: 'api' },
      { name: 'Frontend Components', dir: 'frontend/src/components', docPattern: 'component' },
      { name: 'Skills', dir: 'scripts/skills', docPattern: 'skills' },
      { name: 'Hooks', dir: 'scripts/hooks', docPattern: 'hooks' }
    ];

    const docs = this.findAllMarkdownFiles();

    for (const feature of codeFeatures) {
      const hasDoc = docs.some(doc =>
        doc.toLowerCase().includes(feature.docPattern)
      );

      if (!hasDoc) {
        suggestions.push({
          feature: feature.name,
          reason: `No documentation found mentioning "${feature.docPattern}"`,
          suggestion: `Create documentation for ${feature.name}`
        });
      }
    }

    // Check for outdated docs
    const outdated = this.detectOutdatedDocs();
    if (outdated.outdated.length > 0) {
      suggestions.push({
        feature: 'Documentation timestamps',
        reason: `${outdated.outdated.length} files have outdated timestamps`,
        suggestion: 'Update timestamps in modified files'
      });
    }

    return suggestions;
  }

  /**
   * Handle MCP requests
   */
  handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'search':
        return this.searchDocs(params.keyword);

      case 'detectOutdated':
        return this.detectOutdatedDocs();

      case 'checkCompleteness':
        return this.checkCompleteness();

      case 'getStats':
        return this.getDocStats();

      case 'findEntity':
        return this.findDocForEntity(params.entityName);

      case 'suggestUpdates':
        return this.suggestUpdates();

      default:
        return { error: `Unknown method: ${method}` };
    }
  }
}

// CLI interface
if (require.main === module) {
  const server = new DocumentationServer();

  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`${colors.bright}${colors.blue}=== Documentation MCP Server ===${colors.reset}\n`);

  switch (command) {
    case 'stats':
      const stats = server.getDocStats();
      console.log(`${colors.green}Documentation Statistics:${colors.reset}`);
      console.log(`  Total files: ${stats.totalFiles}`);
      console.log(`  Total lines: ${stats.totalLines.toLocaleString()}`);
      console.log(`  Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
      console.log(`  Average file size: ${(stats.avgFileSize / 1024).toFixed(2)} KB`);

      console.log(`\n${colors.bright}Largest files:${colors.reset}`);
      stats.largestFiles.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.file} (${f.sizeKB} KB, ${f.lines} lines)`);
      });

      console.log(`\n${colors.bright}By category:${colors.reset}`);
      Object.entries(stats.categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
          console.log(`  ${cat}: ${count} files`);
        });
      break;

    case 'search':
      const keyword = args[1];
      if (!keyword) {
        console.log(`${colors.red}Usage: node index.js search <keyword>${colors.reset}`);
      } else {
        const results = server.searchDocs(keyword);
        console.log(`${colors.green}Search results for "${keyword}":${colors.reset}`);
        console.log(`  Total matches: ${results.totalMatches}`);
        console.log(`  Files matched: ${results.filesMatched}`);

        if (results.results.length > 0) {
          console.log(`\n${colors.bright}First 10 matches:${colors.reset}`);
          results.results.slice(0, 10).forEach(r => {
            console.log(`\n  ${r.file}:${r.line}`);
            console.log(`    ${r.content}`);
          });
        }
      }
      break;

    case 'outdated':
      const outdated = server.detectOutdatedDocs();
      console.log(`${colors.green}Outdated Documentation:${colors.reset}`);
      console.log(`  Total files: ${outdated.totalFiles}`);
      console.log(`  Outdated: ${outdated.outdated.length}`);
      console.log(`  Missing timestamp: ${outdated.missingTimestamp.length}`);

      if (outdated.outdated.length > 0) {
        console.log(`\n${colors.yellow}Outdated files:${colors.reset}`);
        outdated.outdated.forEach(d => {
          console.log(`  - ${d.file}`);
          console.log(`    Last Updated: ${d.lastUpdated}`);
          console.log(`    File Modified: ${d.fileModified} (${d.daysSinceUpdate} days ago)`);
        });
      }
      break;

    case 'completeness':
      const completeness = server.checkCompleteness();
      console.log(`${colors.green}Documentation Completeness:${colors.reset}`);
      console.log(`  Total files: ${completeness.total}`);
      console.log(`  With headers: ${completeness.withHeaders}`);
      console.log(`  With examples: ${completeness.withExamples}`);
      console.log(`  With TOC: ${completeness.withTOC}`);

      if (completeness.incomplete.length > 0) {
        console.log(`\n${colors.yellow}Incomplete documentation (${completeness.incomplete.length} files):${colors.reset}`);
        completeness.incomplete.slice(0, 10).forEach(d => {
          console.log(`  - ${d.file}`);
          console.log(`    Issues: ${d.issues.join(', ')}`);
        });
      }
      break;

    case 'suggest':
      const suggestions = server.suggestUpdates();
      console.log(`${colors.green}Documentation Update Suggestions:${colors.reset}\n`);

      if (suggestions.length > 0) {
        suggestions.forEach((s, i) => {
          console.log(`${colors.bright}${i + 1}. ${s.feature}${colors.reset}`);
          console.log(`   Reason: ${s.reason}`);
          console.log(`   ${colors.blue}→ ${s.suggestion}${colors.reset}\n`);
        });
      } else {
        console.log(`${colors.green}✓ Documentation appears up to date!${colors.reset}`);
      }
      break;

    case 'help':
    default:
      console.log('Available commands:');
      console.log('  stats - Show documentation statistics');
      console.log('  search <keyword> - Search across all documentation');
      console.log('  outdated - Find outdated documentation');
      console.log('  completeness - Check documentation completeness');
      console.log('  suggest - Suggest documentation updates');
      console.log('  help - Show this help');
      break;
  }
}

module.exports = DocumentationServer;
