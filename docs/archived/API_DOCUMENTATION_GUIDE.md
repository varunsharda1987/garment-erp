# API Documentation Guide - Kashaya Fabs Garment ERP

**Last Updated:** November 22, 2025
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Accessing API Documentation](#accessing-api-documentation)
3. [Swagger/OpenAPI Setup](#swaggeropenapi-setup)
4. [Adding Documentation to Routes](#adding-documentation-to-routes)
5. [Authentication in Swagger UI](#authentication-in-swagger-ui)
6. [Documenting Different Endpoint Types](#documenting-different-endpoint-types)
7. [Best Practices](#best-practices)
8. [Common Schemas](#common-schemas)

---

## Overview

The Kashaya Fabs Garment ERP API uses **Swagger/OpenAPI 3.0** for interactive API documentation. This provides:

- **Interactive UI** - Test API endpoints directly from the browser
- **Automatic Schema Validation** - Ensures request/response accuracy
- **JWT Authentication Support** - Test protected endpoints
- **Export Capabilities** - Download OpenAPI spec in JSON/YAML

**Technology Stack:**
- swagger-ui-express - Serves interactive UI
- swagger-jsdoc - Generates spec from JSDoc comments
- OpenAPI 3.0 - API specification standard

---

## Accessing API Documentation

### Development Environment

```
http://localhost:5000/api-docs
```

### Production Environment

```
https://your-domain.com/api-docs
```

### Key Features:
- 🔍 **Search** - Find endpoints quickly
- 🔐 **Authorization** - Add JWT token for protected routes
- 🧪 **Try It Out** - Execute requests directly
- 📥 **Download** - Export OpenAPI spec

---

## Swagger/OpenAPI Setup

### Configuration File

**Location:** `backend/src/config/swagger.ts`

```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kashaya Fabs Garment ERP API',
      version,
      description: 'Comprehensive ERP system for garment manufacturing',
      contact: {
        name: 'Kashaya Fabs',
        email: 'support@kashayafabs.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://api.kashayafabs.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      // Define reusable schemas here
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

### Integration in Express App

**Location:** `backend/src/app.ts`

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Kashaya Fabs ERP API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true, // Remembers JWT token
  },
}));
```

---

## Adding Documentation to Routes

### Basic Example - Authentication Routes

**File:** `backend/src/routes/auth.routes.ts`

```typescript
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/register', authLimiter, register);
```

### GET Endpoint with Query Parameters

```typescript
/**
 * @swagger
 * /api/fabrics:
 *   get:
 *     summary: Get list of fabrics
 *     tags: [Fabrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or code
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of fabrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fabrics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Fabric'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticateToken, getFabrics);
```

### POST Endpoint with Path Parameters

```typescript
/**
 * @swagger
 * /api/fabrics/{id}:
 *   put:
 *     summary: Update fabric by ID
 *     tags: [Fabrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Fabric ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FabricInput'
 *     responses:
 *       200:
 *         description: Fabric updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fabric'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/:id', authenticateToken, updateFabric);
```

### File Upload Endpoint

```typescript
/**
 * @swagger
 * /api/fabrics/{id}/image:
 *   post:
 *     summary: Upload fabric image
 *     tags: [Fabrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Fabric ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *       400:
 *         description: Invalid file
 */
router.post('/:id/image', authenticateToken, upload.single('image'), uploadImage);
```

---

## Authentication in Swagger UI

### How to Use Protected Endpoints

1. **Get JWT Token:**
   - Navigate to `/api/auth/login`
   - Click "Try it out"
   - Enter credentials
   - Click "Execute"
   - Copy the `token` from the response

2. **Authorize:**
   - Click the green "Authorize" button (top right)
   - Enter: `Bearer YOUR_TOKEN_HERE`
   - Click "Authorize"
   - Close the dialog

3. **Test Protected Endpoints:**
   - All endpoints with 🔒 icon now use your token
   - Click "Try it out" on any protected endpoint
   - The Authorization header is added automatically

### Token Format

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Documenting Different Endpoint Types

### Pagination Response

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Pagination:
 *       type: object
 *       properties:
 *         currentPage:
 *           type: integer
 *           example: 1
 *         totalPages:
 *           type: integer
 *           example: 10
 *         totalItems:
 *           type: integer
 *           example: 95
 *         itemsPerPage:
 *           type: integer
 *           example: 10
 */
```

### Bulk Operations

```typescript
/**
 * @swagger
 * /api/fabrics/bulk-delete:
 *   post:
 *     summary: Delete multiple fabrics
 *     tags: [Fabrics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["uuid1", "uuid2", "uuid3"]
 *     responses:
 *       200:
 *         description: Fabrics deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *                   example: 3
 */
```

### Export/Download Endpoints

```typescript
/**
 * @swagger
 * /api/fabrics/export:
 *   get:
 *     summary: Export fabrics to CSV
 *     tags: [Fabrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx]
 *         description: Export format
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
```

---

## Best Practices

### 1. Use Tags for Organization

Group related endpoints together:

```typescript
/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication endpoints
 *   - name: Fabrics
 *     description: Fabric management
 *   - name: Orders
 *     description: Order processing
 */
```

### 2. Reuse Schemas

Define schemas once in `swagger.ts`:

```typescript
components: {
  schemas: {
    User: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string', enum: ['ADMIN', 'USER', 'MANAGER'] },
      },
    },
  },
}
```

Then reference them:

```typescript
/**
 * @swagger
 * responses:
 *   200:
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/User'
 */
```

### 3. Include Examples

Always provide example values:

```typescript
properties:
  email:
    type: string
    format: email
    example: admin@kashayafabs.com
  quantity:
    type: number
    example: 100.5
```

### 4. Document Error Responses

Define common error responses:

```typescript
components:
  responses:
    ValidationError:
      description: Validation error
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Validation failed
              details:
                type: array
                items:
                  type: object
                  properties:
                    field:
                      type: string
                    message:
                      type: string
```

### 5. Keep Descriptions Clear

```typescript
/**
 * @swagger
 * /api/fabrics:
 *   get:
 *     summary: Get list of fabrics  # ✅ Short, clear
 *     description: |  # ✅ Detailed explanation
 *       Retrieves paginated list of fabrics with optional filtering.
 *       Supports search by name, code, and category.
 *       Requires authentication.
 */
```

---

## Common Schemas

### User Schema

```typescript
User: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    role: { type: 'string', enum: ['ADMIN', 'USER', 'MANAGER'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
}
```

### Fabric Schema

```typescript
Fabric: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    code: { type: 'string' },
    category: { type: 'string' },
    composition: { type: 'string' },
    width: { type: 'number' },
    weight: { type: 'number' },
    price: { type: 'number' },
    supplierId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
  },
}
```

### Error Responses

```typescript
UnauthorizedError: {
  description: 'Unauthorized - Invalid or missing token',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Unauthorized' },
          message: { type: 'string', example: 'Invalid or expired token' },
        },
      },
    },
  },
}
```

---

## Testing the Documentation

### Local Testing Steps

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Open Swagger UI:**
   ```
   http://localhost:5000/api-docs
   ```

3. **Verify:**
   - ✅ All endpoints are listed
   - ✅ Schemas are displayed correctly
   - ✅ Authentication works
   - ✅ "Try it out" executes successfully

### Troubleshooting

**Issue:** Endpoints not showing up
```
Solution: Check that route files are included in swagger.ts apis array
apis: ['./src/routes/*.ts']
```

**Issue:** Schema not found
```
Solution: Ensure schema is defined in swagger.ts components.schemas
```

**Issue:** Authorization not working
```
Solution: Verify token format: "Bearer YOUR_TOKEN"
Not: "YOUR_TOKEN" (missing Bearer prefix)
```

---

## Documentation Workflow

### Adding New Endpoints

1. **Create the route:**
   ```typescript
   router.get('/new-endpoint', controller);
   ```

2. **Add JSDoc comment:**
   ```typescript
   /**
    * @swagger
    * /api/new-endpoint:
    *   get:
    *     summary: Description
    *     tags: [Tag Name]
    *     responses:
    *       200:
    *         description: Success
    */
   ```

3. **Test in Swagger UI:**
   - Refresh `/api-docs`
   - Find your endpoint
   - Test with "Try it out"

4. **Document request/response:**
   - Add schemas if needed
   - Include examples
   - Document error cases

---

## Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc GitHub](https://github.com/Surnet/swagger-jsdoc)
- [Best Practices Guide](https://swagger.io/docs/specification/api-host-and-base-path/)

---

**Maintained By:** Kashaya Fabs Development Team
**Last Review:** November 22, 2025
**Next Review:** December 22, 2025
