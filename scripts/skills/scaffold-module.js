#!/usr/bin/env node
/**
 * CRUD Module Scaffolder
 *
 * Generates all 8 files needed for a new CRUD module following project conventions.
 * Based on the Agency module pattern (the canonical reference).
 *
 * Usage:
 *   node scripts/skills/scaffold-module.js --name <module> --fields <fields> [--prefix <PREFIX>] [--help]
 *
 * Examples:
 *   node scripts/skills/scaffold-module.js --name warehouse --fields "name:string, address:string?, capacity:number?" --prefix WH
 *   node scripts/skills/scaffold-module.js --name vendor --fields "name:string, phone:string?, email:string?, gstNumber:string?" --prefix VND
 *   node scripts/skills/scaffold-module.js --preview --name warehouse --fields "name:string"
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

// ─── Argument Parsing ──────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { name: '', fields: '', prefix: '', preview: false, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name': parsed.name = args[++i] || ''; break;
      case '--fields': parsed.fields = args[++i] || ''; break;
      case '--prefix': parsed.prefix = args[++i] || ''; break;
      case '--preview': parsed.preview = true; break;
      case '--help': parsed.help = true; break;
    }
  }
  return parsed;
}

function parseFields(fieldsStr) {
  if (!fieldsStr) return [];
  return fieldsStr.split(',').map(f => {
    const trimmed = f.trim();
    const [nameRaw, typeRaw] = trimmed.split(':');
    const name = nameRaw.trim();
    const optional = name.endsWith('?') || (typeRaw && typeRaw.trim().endsWith('?'));
    const cleanName = name.replace('?', '');
    const type = (typeRaw || 'string').trim().replace('?', '');
    return { name: cleanName, type, optional };
  });
}

function toPascalCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toPlural(str) {
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) return str + 'es';
  return str + 's';
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// ─── Prisma Type Mapping ──────────────────────────────────────

function toPrismaType(type) {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Int';
    case 'float': return 'Float';
    case 'boolean': return 'Boolean';
    case 'date': return 'DateTime';
    case 'decimal': return 'Decimal';
    default: return 'String';
  }
}

function toTsType(type) {
  switch (type) {
    case 'string': return 'string';
    case 'number': case 'float': case 'decimal': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'string'; // ISO string in frontend
    default: return 'string';
  }
}

// ─── Template Generators ──────────────────────────────────────

function generatePrismaModel(name, fields, prefix) {
  const modelName = toPlural(name);
  const fieldLines = fields.map(f => {
    const prismaType = toPrismaType(f.type);
    const opt = f.optional ? '?' : '';
    return `  ${f.name.padEnd(20)} ${prismaType}${opt}`;
  }).join('\n');

  return `// Add this to backend/prisma/schema.prisma

model ${modelName} {
  id                   String    @id @default(uuid())
  code                 String    @unique
${fieldLines}
  isActive             Boolean   @default(true)
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  @@map("${toKebabCase(modelName)}")
}`;
}

function generateBackendService(name, fields, prefix) {
  const Name = toPascalCase(name);
  const plural = toPlural(name);
  const codePrefix = prefix || name.substring(0, 3).toUpperCase();

  const createFields = fields.map(f =>
    `  ${f.name}${f.optional ? '?' : ''}: ${toTsType(f.type)};`
  ).join('\n');

  const updateFields = fields.map(f =>
    `  ${f.name}?: ${toTsType(f.type)};`
  ).join('\n');

  const searchOrFields = fields
    .filter(f => f.type === 'string')
    .map(f => `        { ${f.name}: { contains: search, mode: 'insensitive' } },`)
    .join('\n');

  const createData = fields.map(f =>
    `        ${f.name}: data.${f.name}${f.optional ? ' || null' : ''},`
  ).join('\n');

  return `import prisma from '../config/database';
import { Prisma } from '@prisma/client';

interface ${Name}CreateInput {
${createFields}
  isActive?: boolean;
}

interface ${Name}UpdateInput {
${updateFields}
  isActive?: boolean;
}

interface ${Name}QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ${Name}Service {

  private async generateCode(): Promise<string> {
    const last = await prisma.${plural}.findFirst({
      where: { code: { startsWith: '${codePrefix}-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!last) return '${codePrefix}-001';
    const num = parseInt(last.code.replace('${codePrefix}-', ''), 10) + 1;
    return \`${codePrefix}-\${num.toString().padStart(3, '0')}\`;
  }

  async create(data: ${Name}CreateInput) {
    const code = await this.generateCode();
    return prisma.${plural}.create({
      data: {
        code,
${createData}
        isActive: data.isActive ?? true,
      },
    });
  }

  async getAll(params: ${Name}QueryParams = {}) {
    const { page = 1, limit = 20, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.${plural}WhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
${searchOrFields}
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      prisma.${plural}.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.${plural}.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return prisma.${plural}.findUnique({ where: { id } });
  }

  async update(id: string, data: ${Name}UpdateInput) {
    return prisma.${plural}.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.${plural}.delete({ where: { id } });
  }

  async search(params: { search?: string; limit?: number }) {
    const { search, limit = 50 } = params;

    const where: Prisma.${plural}WhereInput = { isActive: true };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
${searchOrFields}
      ];
    }

    return prisma.${plural}.findMany({
      where,
      take: limit,
      orderBy: { ${fields[0]?.name || 'code'}: 'asc' },
      select: { id: true, code: true, ${fields.slice(0, 2).map(f => `${f.name}: true`).join(', ')} },
    });
  }
}

export const ${name}Service = new ${Name}Service();
`;
}

function generateBackendController(name, fields) {
  const Name = toPascalCase(name);
  const requiredFields = fields.filter(f => !f.optional);
  const allFieldNames = fields.map(f => f.name).join(', ');
  const requiredCheck = requiredFields.length > 0
    ? `\n      if (${requiredFields.map(f => `!${f.name}`).join(' || ')}) {
        return res.status(400).json({ message: '${requiredFields.map(f => f.name).join(', ')} ${requiredFields.length === 1 ? 'is' : 'are'} required' });
      }\n`
    : '';

  return `import { Request, Response } from 'express';
import { ${name}Service } from '../services/${name}.service';

export class ${Name}Controller {

  async getAll(req: Request, res: Response) {
    try {
      const { page = '1', limit = '20', search, isActive, sortBy, sortOrder } = req.query;
      const result = await ${name}Service.getAll({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching ${toPlural(name)}:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch ${toPlural(name)}' });
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { search, limit = '50' } = req.query;
      const result = await ${name}Service.search({
        search: search as string | undefined,
        limit: parseInt(limit as string, 10),
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error searching ${toPlural(name)}:', error);
      res.status(500).json({ message: error.message || 'Failed to search ${toPlural(name)}' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const item = await ${name}Service.getById(id);
      if (!item) return res.status(404).json({ message: '${Name} not found' });
      res.json(item);
    } catch (error: any) {
      console.error('Error fetching ${name}:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch ${name}' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { ${allFieldNames}, isActive } = req.body;
${requiredCheck}
      const item = await ${name}Service.create({ ${allFieldNames}, isActive });
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Error creating ${name}:', error);
      res.status(500).json({ message: error.message || 'Failed to create ${name}' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { ${allFieldNames}, isActive } = req.body;
      const item = await ${name}Service.update(id, { ${allFieldNames}, isActive });
      res.json(item);
    } catch (error: any) {
      console.error('Error updating ${name}:', error);
      if (error.code === 'P2025') return res.status(404).json({ message: '${Name} not found' });
      res.status(500).json({ message: error.message || 'Failed to update ${name}' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await ${name}Service.delete(id);
      res.json({ message: '${Name} deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting ${name}:', error);
      if (error.code === 'P2025') return res.status(404).json({ message: '${Name} not found' });
      res.status(400).json({ message: error.message || 'Failed to delete ${name}' });
    }
  }
}

export const ${name}Controller = new ${Name}Controller();
`;
}

function generateBackendRoutes(name) {
  const Name = toPascalCase(name);
  return `import { Router } from 'express';
import { ${name}Controller } from '../controllers/${name}.controller';

const router = Router();

// GET /api/${toPlural(name)}/search - Search for dropdown (MUST be before /:id)
router.get('/search', ${name}Controller.search.bind(${name}Controller));

// GET /api/${toPlural(name)} - Get all with pagination
router.get('/', ${name}Controller.getAll.bind(${name}Controller));

// GET /api/${toPlural(name)}/:id - Get by ID
router.get('/:id', ${name}Controller.getById.bind(${name}Controller));

// POST /api/${toPlural(name)} - Create new
router.post('/', ${name}Controller.create.bind(${name}Controller));

// PUT /api/${toPlural(name)}/:id - Update
router.put('/:id', ${name}Controller.update.bind(${name}Controller));

// DELETE /api/${toPlural(name)}/:id - Delete
router.delete('/:id', ${name}Controller.delete.bind(${name}Controller));

export default router;
`;
}

function generateFrontendTypes(name, fields) {
  const Name = toPascalCase(name);
  const Plural = toPascalCase(toPlural(name));

  const entityFields = fields.map(f => {
    const tsType = toTsType(f.type);
    return `  ${f.name}${f.optional ? '?' : ''}: ${tsType}${f.optional ? ' | null' : ''};`;
  }).join('\n');

  const createFields = fields.map(f =>
    `  ${f.name}${f.optional ? '?' : ''}: ${toTsType(f.type)};`
  ).join('\n');

  const updateFields = fields.map(f =>
    `  ${f.name}?: ${toTsType(f.type)};`
  ).join('\n');

  return `export interface ${Name} {
  id: string;
  code: string;
${entityFields}
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Create${Name}Request {
${createFields}
  isActive?: boolean;
}

export interface Update${Name}Request {
${updateFields}
  isActive?: boolean;
}

export interface ${Name}QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ${Name}SearchResult {
  id: string;
  code: string;
  ${fields.slice(0, 2).map(f => `${f.name}${f.optional ? '?' : ''}: ${toTsType(f.type)}${f.optional ? ' | null' : ''};`).join('\n  ')}
}

export interface Paginated${Plural} {
  data: ${Name}[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
`;
}

function generateFrontendService(name, fields) {
  const Name = toPascalCase(name);
  const plural = toPlural(name);
  const Plural = toPascalCase(plural);

  return `import api from '../lib/api';
import type {
  ${Name},
  Create${Name}Request,
  Update${Name}Request,
  ${Name}QueryParams,
  ${Name}SearchResult,
  Paginated${Plural},
} from '@/types/${name}.types';

const BASE_URL = '/${plural}';

export async function getAll${Plural}(params: ${Name}QueryParams = {}): Promise<Paginated${Plural}> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

export async function get${Name}ById(id: string): Promise<${Name}> {
  const response = await api.get(\`\${BASE_URL}/\${id}\`);
  return response.data;
}

export async function search${Plural}(params: { search?: string; limit?: number }): Promise<${Name}SearchResult[]> {
  const response = await api.get(\`\${BASE_URL}/search\`, { params });
  return response.data;
}

export async function create${Name}(data: Create${Name}Request): Promise<${Name}> {
  const response = await api.post(BASE_URL, data);
  return response.data;
}

export async function update${Name}(id: string, data: Update${Name}Request): Promise<${Name}> {
  const response = await api.put(\`\${BASE_URL}/\${id}\`, data);
  return response.data;
}

export async function delete${Name}(id: string): Promise<void> {
  await api.delete(\`\${BASE_URL}/\${id}\`);
}
`;
}

function generateFrontendPage(name, fields) {
  const Name = toPascalCase(name);
  const plural = toPlural(name);
  const Plural = toPascalCase(plural);

  const tableHeaders = ['Code', ...fields.slice(0, 3).map(f => toPascalCase(f.name)), 'Status', 'Actions'];
  const headerCells = tableHeaders.map(h => `                    <TableHead>${h}</TableHead>`).join('\n');

  const bodyCells = [
    `                      <TableCell className="font-mono text-sm">{item.code}</TableCell>`,
    ...fields.slice(0, 3).map(f =>
      `                      <TableCell>{item.${f.name}${f.optional ? " || '-'" : ''}}</TableCell>`
    ),
  ].join('\n');

  return `import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getAll${Plural}, create${Name}, update${Name}, delete${Name},
} from '@/services/${name}.service';
import type { ${Name}, Create${Name}Request, Update${Name}Request } from '@/types/${name}.types';

export default function ${Name}List() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<${Name} | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<${Name} | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['${plural}', { page, search }],
    queryFn: () => getAll${Plural}({ page, limit: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: create${Name},
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['${plural}'] }); toast.success('${Name} created'); setDialogOpen(false); },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Failed to create'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Update${Name}Request }) => update${Name}(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['${plural}'] }); toast.success('${Name} updated'); setDialogOpen(false); setSelected(null); },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Failed to update'); },
  });

  const deleteMutation = useMutation({
    mutationFn: delete${Name},
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['${plural}'] }); toast.success('${Name} deleted'); setDeleteOpen(false); setToDelete(null); },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Failed to delete'); },
  });

  const handleSubmit = async (data: Create${Name}Request | Update${Name}Request) => {
    if (selected) {
      await updateMutation.mutateAsync({ id: selected.id, data });
    } else {
      await createMutation.mutateAsync(data as Create${Name}Request);
    }
  };

  const items = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">${Plural}</h1>
          <p className="text-muted-foreground">Manage ${plural}</p>
        </div>
        <Button onClick={() => { setSelected(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add ${Name}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>${Name} List</CardTitle>
              <CardDescription>{pagination?.total || 0} ${plural} total</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No ${plural} found</p>
              <Button variant="outline" className="mt-4"
                onClick={() => { setSelected(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add your first ${name}
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
${headerCells}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
${bodyCells}
                      <TableCell>
                        <Badge variant={item.isActive ? 'default' : 'secondary'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setSelected(item); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setToDelete(item); setDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={pagination.page >= pagination.totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* TODO: Create ${Name}FormDialog component */}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ${Name}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{toDelete?.${fields[0]?.name || 'code'}}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
`;
}

// ─── Route Registration Snippets ──────────────────────────────

function generateRouteRegistration(name) {
  const plural = toPlural(name);
  return {
    importLine: `import ${name}Routes from './${name}.routes';`,
    useLine: `router.use('/${plural}', ${name}Routes);`,
  };
}

function generateLazyRoute(name) {
  const Name = toPascalCase(name);
  return `export const ${Name}List = lazy(() => import('@/pages/${Name}List'));`;
}

function generateAppRoute(name) {
  const Name = toPascalCase(name);
  const plural = toPlural(name);
  return `<Route path="/${plural}" element={<ProtectedRoute><Suspense fallback={<LoadingSpinner />}><${Name}List /></Suspense></ProtectedRoute>} />`;
}

// ─── File Writer ──────────────────────────────────────────────

function writeFile(filePath, content, preview) {
  const fullPath = path.join(process.cwd(), filePath);
  if (preview) {
    console.log(`  ${c('cyan', '📄')} ${c('dim', 'Would create:')} ${filePath}`);
    return;
  }

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(fullPath)) {
    console.log(`  ${c('yellow', '⚠')}  ${c('yellow', 'EXISTS (skipped):')} ${filePath}`);
    return false;
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`  ${c('green', '✓')}  ${c('bright', 'Created:')} ${filePath}`);
  return true;
}

// ─── Help ─────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${c('bright', c('cyan', 'CRUD Module Scaffolder'))}

Generates all files for a new CRUD module following project conventions.

${c('bright', 'Usage:')}
  node scripts/skills/scaffold-module.js --name <module> --fields <fields> [options]

${c('bright', 'Required:')}
  ${c('cyan', '--name')}     Module name in camelCase (e.g., warehouse, testingLab)
  ${c('cyan', '--fields')}   Comma-separated fields as name:type (e.g., "name:string, capacity:number?")

${c('bright', 'Options:')}
  ${c('cyan', '--prefix')}   Code prefix (default: first 3 chars uppercase, e.g., WAR for warehouse)
  ${c('cyan', '--preview')}  Show what would be generated without creating files
  ${c('cyan', '--help')}     Show this help

${c('bright', 'Field Types:')}
  string, number, float, decimal, boolean, date
  Append ? for optional: "address:string?"

${c('bright', 'Examples:')}
  node scripts/skills/scaffold-module.js --name warehouse --fields "name:string, address:string?, capacity:number?" --prefix WH
  node scripts/skills/scaffold-module.js --preview --name vendor --fields "name:string, phone:string?"

${c('bright', 'Generated Files (8):')}
  1. backend/src/services/<name>.service.ts
  2. backend/src/controllers/<name>.controller.ts
  3. backend/src/routes/<name>.routes.ts
  4. frontend/src/types/<name>.types.ts
  5. frontend/src/services/<name>.service.ts
  6. frontend/src/pages/<Name>List.tsx
  + Prisma model snippet (printed to console)
  + Registration snippets for routes/index.ts, lazy-routes.tsx, App.tsx, Sidebar.tsx
`);
}

// ─── Main ─────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) { showHelp(); return 0; }

  if (!args.name) {
    console.error(`${c('red', 'Error:')} --name is required. Use --help for usage.`);
    return 1;
  }

  if (!args.fields) {
    console.error(`${c('red', 'Error:')} --fields is required. Use --help for usage.`);
    return 1;
  }

  const name = args.name;
  const Name = toPascalCase(name);
  const plural = toPlural(name);
  const fields = parseFields(args.fields);
  const prefix = args.prefix || name.substring(0, 3).toUpperCase();
  const preview = args.preview;

  console.log(`\n${c('bright', c('cyan', '=== CRUD Module Scaffolder ==='))}\n`);
  console.log(`  Module:  ${c('bright', Name)}`);
  console.log(`  Plural:  ${plural}`);
  console.log(`  Prefix:  ${prefix}`);
  console.log(`  Fields:  ${fields.map(f => `${f.name}:${f.type}${f.optional ? '?' : ''}`).join(', ')}`);
  console.log(`  Mode:    ${preview ? c('yellow', 'PREVIEW') : c('green', 'CREATE')}\n`);

  // ─── Step 1: Prisma Model ──────────────
  console.log(`${c('cyan', '─'.repeat(50))}`);
  console.log(`${c('bright', '1. Prisma Model')} (add manually to schema.prisma)\n`);
  console.log(c('dim', generatePrismaModel(name, fields, prefix)));
  console.log();

  // ─── Step 2: Backend Files ─────────────
  console.log(`${c('cyan', '─'.repeat(50))}`);
  console.log(`${c('bright', '2. Backend Files')}\n`);

  writeFile(`backend/src/services/${name}.service.ts`, generateBackendService(name, fields, prefix), preview);
  writeFile(`backend/src/controllers/${name}.controller.ts`, generateBackendController(name, fields), preview);
  writeFile(`backend/src/routes/${name}.routes.ts`, generateBackendRoutes(name), preview);

  // ─── Step 3: Frontend Files ────────────
  console.log(`\n${c('cyan', '─'.repeat(50))}`);
  console.log(`${c('bright', '3. Frontend Files')}\n`);

  writeFile(`frontend/src/types/${name}.types.ts`, generateFrontendTypes(name, fields), preview);
  writeFile(`frontend/src/services/${name}.service.ts`, generateFrontendService(name, fields), preview);
  writeFile(`frontend/src/pages/${Name}List.tsx`, generateFrontendPage(name, fields), preview);

  // ─── Step 4: Registration Snippets ─────
  console.log(`\n${c('cyan', '─'.repeat(50))}`);
  console.log(`${c('bright', '4. Manual Registration Steps')}\n`);

  const reg = generateRouteRegistration(name);
  console.log(`  ${c('yellow', 'a)')} Add to ${c('bright', 'backend/src/routes/index.ts')}:`);
  console.log(`     ${c('dim', reg.importLine)}`);
  console.log(`     ${c('dim', reg.useLine)}\n`);

  console.log(`  ${c('yellow', 'b)')} Add to ${c('bright', 'frontend/src/routes/lazy-routes.tsx')}:`);
  console.log(`     ${c('dim', generateLazyRoute(name))}\n`);

  console.log(`  ${c('yellow', 'c)')} Add to ${c('bright', 'frontend/src/App.tsx')}:`);
  console.log(`     ${c('dim', generateAppRoute(name))}\n`);

  console.log(`  ${c('yellow', 'd)')} Add sidebar entry in ${c('bright', 'frontend/src/components/Sidebar.tsx')}\n`);

  console.log(`  ${c('yellow', 'e)')} Run migration: ${c('dim', 'cd backend && npx prisma migrate dev --name add_' + plural)}\n`);

  // ─── Summary ───────────────────────────
  console.log(`${c('cyan', '─'.repeat(50))}`);
  if (preview) {
    console.log(`\n${c('yellow', 'Preview complete.')} Run without --preview to create files.\n`);
  } else {
    console.log(`\n${c('green', '✓ Scaffold complete!')} 6 files created + 5 manual registration steps above.\n`);
  }

  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { parseFields, toPascalCase, toPlural, generatePrismaModel };
