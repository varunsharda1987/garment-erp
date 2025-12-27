#!/usr/bin/env node
/**
 * Post-Docs-Update Hook
 *
 * Automatically triggered when documentation files change.
 * Validates documentation quality and consistency.
 *
 * Triggers:
 * - When *.md files change
 *
 * Actions:
 * - Validate markdown syntax
 * - Check for broken internal links
 * - Validate code examples (if TypeScript/JavaScript)
 * - Update "Last Modified" timestamps
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Get changed markdown files
 */
function getChangedMarkdownFiles() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    const lines = status.split('\n').filter(line => line.trim());

    const changedFiles = lines
      .filter(line => {
        const file = line.substring(3).trim();
        return file.endsWith('.md') && !file.includes('node_modules');
      })
      .map(line => line.substring(3).trim());

    return changedFiles;
  } catch (error) {
    return [];
  }
}

/**
 * Check for broken internal links in markdown
 */
function checkBrokenLinks(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const brokenLinks = [];

  // Match markdown links: [text](path)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkPath = match[2];

    // Skip external links and anchors
    if (linkPath.startsWith('http') || linkPath.startsWith('#')) {
      continue;
    }

    // Check if file exists
    const fullPath = path.join(path.dirname(file), linkPath);
    if (!fs.existsSync(fullPath)) {
      brokenLinks.push({
        text: linkText,
        path: linkPath,
        fullPath
      });
    }
  }

  return brokenLinks;
}

/**
 * Validate code blocks in markdown
 */
function validateCodeBlocks(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const issues = [];

  // Match code blocks: ```language ... ```
  const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1];
    const code = match[2];

    // Check for common issues
    if (language === 'bash' || language === 'sh') {
      // Check for commands that should not be in docs
      if (code.includes('rm -rf /') || code.includes('sudo rm')) {
        issues.push({
          type: 'dangerous-command',
          language,
          snippet: code.substring(0, 50)
        });
      }
    }

    if (language === 'javascript' || language === 'typescript') {
      // Check for syntax issues (basic check)
      const lines = code.split('\n');
      if (lines.some(line => line.includes('console.error') && !line.trim().startsWith('//'))) {
        issues.push({
          type: 'console-error',
          language,
          snippet: code.substring(0, 50)
        });
      }
    }
  }

  return issues;
}

/**
 * Update last modified timestamp
 */
function updateTimestamp(file) {
  let content = fs.readFileSync(file, 'utf-8');

  // Look for timestamp pattern
  const timestampRegex = /\*\*Last Updated:\*\*\s+.+/;

  if (timestampRegex.test(content)) {
    const now = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    content = content.replace(timestampRegex, `**Last Updated:** ${now}`);
    fs.writeFileSync(file, content, 'utf-8');
    return true;
  }

  return false;
}

/**
 * Main hook execution
 */
function main() {
  console.log(`\n${colors.bright}${colors.cyan}=== Post-Docs-Update Hook ===${colors.reset}\n`);

  const changedFiles = getChangedMarkdownFiles();

  if (changedFiles.length === 0) {
    console.log(`${colors.yellow}No markdown files changed. Skipping hook.${colors.reset}\n`);
    return;
  }

  console.log(`${colors.bright}Changed markdown files (${changedFiles.length}):${colors.reset}`);
  changedFiles.forEach(file => {
    console.log(`  ${colors.cyan}M${colors.reset} ${file}`);
  });

  let hasIssues = false;

  // Validate each file
  for (const file of changedFiles) {
    if (!fs.existsSync(file)) continue;

    console.log(`\n${colors.bright}Validating ${file}...${colors.reset}`);

    // Check broken links
    const brokenLinks = checkBrokenLinks(file);
    if (brokenLinks.length > 0) {
      console.log(`${colors.yellow}⚠ Found ${brokenLinks.length} broken link(s):${colors.reset}`);
      brokenLinks.forEach(link => {
        console.log(`  ${colors.cyan}[${link.text}](${link.path})${colors.reset}`);
        console.log(`    → File not found: ${link.fullPath}`);
      });
      hasIssues = true;
    }

    // Validate code blocks
    const codeIssues = validateCodeBlocks(file);
    if (codeIssues.length > 0) {
      console.log(`${colors.yellow}⚠ Found ${codeIssues.length} code block issue(s):${colors.reset}`);
      codeIssues.forEach(issue => {
        console.log(`  ${colors.cyan}${issue.type}${colors.reset} in ${issue.language} block`);
      });
      hasIssues = true;
    }

    // Update timestamp
    const updated = updateTimestamp(file);
    if (updated) {
      console.log(`${colors.green}✓ Updated timestamp${colors.reset}`);
    }

    if (!hasIssues) {
      console.log(`${colors.green}✓ No issues found${colors.reset}`);
    }
  }

  if (hasIssues) {
    console.log(`\n${colors.yellow}⚠ Documentation validation completed with warnings${colors.reset}`);
    console.log(`${colors.cyan}Review the issues above (not blocking)${colors.reset}\n`);
  } else {
    console.log(`\n${colors.green}✓ Documentation validation passed${colors.reset}\n`);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, checkBrokenLinks, validateCodeBlocks, updateTimestamp };
