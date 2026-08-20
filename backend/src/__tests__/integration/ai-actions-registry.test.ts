/**
 * AI Actions Registry Drift Test
 *
 * Every registry entry points at a REAL endpoint and promises a payload shape. If someone
 * moves a route or tightens a Zod schema, the mismatch would otherwise only surface when a
 * user presses Confirm in production — the exact schema-drift bug class this repo already
 * guards against everywhere else.
 *
 * This asserts the structural contract without creating any records:
 *  - the mounted path exists (not 404)
 *  - the tool definition and the two schemas are coherent
 *  - allowedRoles are real UserRole values
 */

import request from 'supertest';
import { UserRole } from '@prisma/client';
import app from '../../app';
import { aiActionsService } from '../../services/ai/ai-actions.service';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `AIR${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@airegistry.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
});

afterAll(async () => {
  await prisma.users.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
});

const actions = aiActionsService.getAllActions();

describe('AI action registry', () => {
  it('registers at least one action', () => {
    expect(actions.length).toBeGreaterThan(0);
  });

  it.each(actions.map((a) => [a.actionType, a] as const))('%s — definition is coherent', (_name, action) => {
    // The tool the model sees must match the action it triggers
    expect(action.tool.function.name).toBe(action.actionType);
    expect(action.tool.function.description.length).toBeGreaterThan(20);

    // Two distinct schema roles must both be present (tool = names, execution = ids)
    expect(action.toolSchema).toBeDefined();
    expect(action.executionSchema).toBeDefined();

    // Roles must be real enum values, and never empty (an empty list hides the action from everyone)
    expect(action.allowedRoles.length).toBeGreaterThan(0);
    for (const role of action.allowedRoles) {
      expect(Object.values(UserRole)).toContain(role);
    }

    // Every field the tool marks required must exist in its declared properties
    const params = action.tool.function.parameters as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    for (const field of params.required || []) {
      expect(Object.keys(params.properties || {})).toContain(field);
    }
  });

  it.each(actions.filter((a) => typeof a.path === 'string').map((a) => [a.actionType, a.path as string] as const))(
    '%s — target endpoint %s exists',
    async (_name, path) => {
      // POST an empty body: we expect the endpoint to REJECT it (400/403/422) — what must never
      // happen is 404, which means the registry points at a route that no longer exists.
      const res = await request(app).post(path).set(authHeader).send({});
      expect(res.status).not.toBe(404);
    }
  );

  it('payload keys never collide with serializer relation mappings', () => {
    // applyRelationMappings recurses into Json columns, so a payload key named like a relation
    // (e.g. "styles") would be silently renamed before the frontend ever sees it.
    const forbidden = ['styles', 'customers', 'suppliers', 'materials', 'orders'];
    for (const action of actions) {
      const params = action.tool.function.parameters as { properties?: Record<string, unknown> };
      for (const key of Object.keys(params.properties || {})) {
        expect(forbidden).not.toContain(key);
      }
    }
  });
});
