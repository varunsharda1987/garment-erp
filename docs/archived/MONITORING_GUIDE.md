# Monitoring & Observability Guide - Kashaya Fabs Garment ERP

**Last Updated:** November 22, 2025
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Error Tracking with Sentry](#error-tracking-with-sentry)
3. [Health Check Endpoints](#health-check-endpoints)
4. [Application Metrics](#application-metrics)
5. [Log Monitoring](#log-monitoring)
6. [Performance Monitoring](#performance-monitoring)
7. [Alerting Setup](#alerting-setup)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Kashaya Fabs ERP implements comprehensive monitoring and observability to ensure:

- **Error Tracking** - Real-time error capture and alerting (Sentry)
- **Health Monitoring** - Application health, readiness, and liveness checks
- **Performance Monitoring** - Request tracing and profiling
- **Log Aggregation** - Centralized logging with Winston
- **Metrics Collection** - System and application metrics

**Technology Stack:**
- **Sentry** - Error tracking and performance monitoring
- **Winston** - Structured logging
- **Health Endpoints** - Custom health check APIs
- **PM2** - Process monitoring (production)

---

## Error Tracking with Sentry

### What is Sentry?

Sentry provides real-time error tracking, performance monitoring, and session replays. It helps identify, prioritize, and fix bugs faster.

**Features:**
- 🐛 Real-time error capture
- 📊 Performance monitoring
- 🎥 Session replay (frontend)
- 🔍 Stack trace analysis
- 📧 Alert notifications
- 📈 Trend analysis

---

### Backend Setup

#### 1. Create Sentry Project

1. Go to [sentry.io](https://sentry.io/)
2. Create account or login
3. Create new project
4. Select "Node.js" as platform
5. Copy the DSN (Data Source Name)

#### 2. Configure Environment Variables

Add to `backend/.env`:

```bash
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% profiling
```

#### 3. Integration (Already Configured)

**File:** `backend/src/config/sentry.ts`

```typescript
import { initializeSentry } from './config/sentry';

// Initialize Sentry early in app.ts
initializeSentry(app);
```

The configuration automatically:
- Captures all unhandled errors
- Tracks performance of HTTP requests
- Profiles slow functions
- Filters out 4xx errors (client errors)
- Adds user context when available

#### 4. Usage Examples

**Capture exceptions manually:**

```typescript
import { captureException } from '../config/sentry';

try {
  // Your code
} catch (error) {
  captureException(error as Error, {
    extra: { userId, orderId },
  });
}
```

**Add user context:**

```typescript
import { setUserContext } from '../config/sentry';

setUserContext({
  id: user.id,
  email: user.email,
  username: user.name,
});
```

**Add breadcrumbs for debugging:**

```typescript
import { addBreadcrumb } from '../config/sentry';

addBreadcrumb('User clicked export button', 'user-action', {
  exportType: 'csv',
  recordCount: 100,
});
```

---

### Frontend Setup

#### 1. Configure Environment Variables

Add to `frontend/.env`:

```bash
# Sentry Configuration
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
```

#### 2. Initialize in main.tsx

**File:** `frontend/src/main.tsx`

```typescript
import { initializeSentry, ErrorBoundary } from './lib/sentry';

// Initialize Sentry before rendering
initializeSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

#### 3. Error Boundary Component

Create `frontend/src/components/ErrorFallback.tsx`:

```typescript
export function ErrorFallback() {
  return (
    <div className="error-fallback">
      <h1>Something went wrong</h1>
      <p>We've been notified and are working on a fix.</p>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  );
}
```

#### 4. Session Replay

Sentry automatically records user sessions when errors occur. Configure in `frontend/src/lib/sentry.ts`:

```typescript
replaysSessionSampleRate: 0.1,  // Record 10% of sessions
replaysOnErrorSampleRate: 1.0,  // Record 100% of sessions with errors
```

**Privacy:** Session replay masks sensitive data by default.

---

### Viewing Errors in Sentry

1. **Navigate to Sentry Dashboard**
   - Login to sentry.io
   - Select your project

2. **Issues Tab**
   - View all captured errors
   - Click any issue to see details
   - View stack trace, breadcrumbs, user context

3. **Performance Tab**
   - View transaction traces
   - Identify slow endpoints
   - Analyze performance trends

4. **Replays Tab**
   - Watch session recordings
   - See exact user interactions before error

---

## Health Check Endpoints

### Overview

Health check endpoints allow monitoring systems to verify application status.

**Use Cases:**
- Container orchestrator health checks (Kubernetes, Docker)
- Load balancer health probes
- Uptime monitoring services
- Automated alerting

---

### Available Endpoints

#### 1. Basic Health Check

```
GET /health
```

**Purpose:** Verify API is running

**Response:**
```json
{
  "status": "ok",
  "message": "Kashaya Fabs ERP API is running",
  "timestamp": "2025-11-22T10:00:00.000Z",
  "environment": "production",
  "version": "1.0.0"
}
```

**Usage:**
```bash
curl http://localhost:5000/health
```

---

#### 2. Readiness Check

```
GET /health/readiness
```

**Purpose:** Check if application is ready to accept traffic

**Checks:**
- Database connection
- Database response time
- Required services availability

**Response (Healthy):**
```json
{
  "status": "ready",
  "timestamp": "2025-11-22T10:00:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": "15ms"
    }
  }
}
```

**Response (Unhealthy):**
```json
{
  "status": "not_ready",
  "timestamp": "2025-11-22T10:00:00.000Z",
  "checks": {
    "database": {
      "status": "down",
      "error": "Connection refused"
    }
  }
}
```

**Status Codes:**
- `200 OK` - Application is ready
- `503 Service Unavailable` - Application is not ready

**Usage:**
```bash
curl http://localhost:5000/health/readiness
```

---

#### 3. Liveness Check

```
GET /health/liveness
```

**Purpose:** Verify application process is alive

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2025-11-22T10:00:00.000Z"
}
```

**Usage:**
```bash
curl http://localhost:5000/health/liveness
```

**Kubernetes Example:**
```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10
```

---

#### 4. Metrics Endpoint

```
GET /health/metrics
```

**Purpose:** Retrieve system and application metrics

**Response:**
```json
{
  "timestamp": "2025-11-22T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "system": {
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v18.17.0",
    "cpus": 4,
    "totalMemory": "8192MB",
    "freeMemory": "4096MB",
    "uptime": "86400s"
  },
  "process": {
    "pid": 1234,
    "uptime": "3600s",
    "memory": {
      "rss": "150MB",
      "heapTotal": "80MB",
      "heapUsed": "60MB",
      "external": "5MB"
    }
  },
  "database": {
    "responseTime": "12ms",
    "counts": {
      "users_count": 50,
      "customers_count": 200,
      "suppliers_count": 75,
      "orders_count": 1500
    }
  }
}
```

**Usage:**
```bash
curl http://localhost:5000/health/metrics
```

---

#### 5. Version Endpoint

```
GET /health/version
```

**Purpose:** Get application version information

**Response:**
```json
{
  "version": "1.0.0",
  "nodeVersion": "v18.17.0",
  "environment": "production"
}
```

---

### Docker Health Check

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

### Kubernetes Health Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: garment-erp-backend
spec:
  containers:
    - name: backend
      image: garment-erp-backend:latest
      ports:
        - containerPort: 5000
      livenessProbe:
        httpGet:
          path: /health/liveness
          port: 5000
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /health/readiness
          port: 5000
        initialDelaySeconds: 10
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 3
```

---

## Application Metrics

### System Metrics

**CPU Usage:**
```typescript
const cpuUsage = process.cpuUsage();
```

**Memory Usage:**
```typescript
const memUsage = process.memoryUsage();
// Returns: rss, heapTotal, heapUsed, external
```

**Uptime:**
```typescript
const uptime = process.uptime(); // seconds
```

---

### Database Metrics

**Connection Pool:**
```typescript
// Prisma doesn't expose pool stats directly
// Monitor via database logs or external tools
```

**Query Performance:**
```typescript
const start = Date.now();
await prisma.users.findMany();
const duration = Date.now() - start;
logInfo(`Query took ${duration}ms`);
```

---

### HTTP Metrics

**Request Logging:**

Already configured via Winston HTTP logger:

```typescript
// Logs every HTTP request
app.use(httpLogger);
```

**Example Log:**
```
[HTTP] GET /api/fabrics 200 - 45ms
[HTTP] POST /api/auth/login 401 - 120ms
```

---

## Log Monitoring

### Winston Logs

**Location:**
- `backend/logs/combined.log` - All logs
- `backend/logs/error.log` - Errors only
- Console output (development)

**Log Levels:**
- `error` - Error messages
- `warn` - Warnings
- `info` - Informational messages
- `http` - HTTP requests
- `debug` - Debug information (dev only)

**View Logs:**

```bash
# Tail all logs
tail -f backend/logs/combined.log

# View errors only
tail -f backend/logs/error.log

# Search logs
grep "ERROR" backend/logs/combined.log
```

---

### Log Aggregation (Optional)

#### Using ELK Stack (Elasticsearch, Logstash, Kibana)

**1. Install Filebeat:**

```bash
# Configure filebeat.yml
filebeat.inputs:
  - type: log
    paths:
      - /app/logs/*.log
    json.keys_under_root: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

**2. View in Kibana:**
- Navigate to http://localhost:5601
- Create index pattern
- View logs in Discover tab

---

#### Using Grafana Loki

**docker-compose.yml:**

```yaml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"

promtail:
  image: grafana/promtail:latest
  volumes:
    - ./backend/logs:/logs
    - ./promtail-config.yml:/etc/promtail/config.yml
```

---

## Performance Monitoring

### Sentry Performance

**Automatic Transaction Tracking:**
- HTTP requests
- Database queries
- External API calls

**View in Sentry:**
1. Navigate to Performance tab
2. View transaction list
3. Click any transaction to see flame graph
4. Identify slow spans

**Custom Instrumentation:**

```typescript
import * as Sentry from '@sentry/node';

const transaction = Sentry.startTransaction({
  op: 'task',
  name: 'Heavy Computation',
});

try {
  // Your code
  const span = transaction.startChild({
    op: 'db',
    description: 'Query users',
  });

  await prisma.users.findMany();

  span.finish();
} finally {
  transaction.finish();
}
```

---

### Database Performance

**Query Logging:**

Enable in Prisma:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

**Slow Query Log:**

Enable in PostgreSQL (`postgresql.conf`):

```conf
log_min_duration_statement = 1000  # Log queries > 1s
```

---

## Alerting Setup

### Sentry Alerts

**1. Configure Alert Rules:**
- Navigate to Settings → Alerts
- Create new alert rule
- Set conditions (e.g., "Errors > 10 in 5 minutes")
- Configure notification channels

**2. Notification Channels:**
- Email
- Slack
- PagerDuty
- Webhooks
- Discord

**Example Slack Integration:**
1. Go to Settings → Integrations
2. Add Slack integration
3. Choose channels for alerts
4. Test notification

---

### Uptime Monitoring

**Using UptimeRobot (Free):**

1. Go to [uptimerobot.com](https://uptimerobot.com/)
2. Add new monitor
3. URL: `https://your-domain.com/health`
4. Interval: 5 minutes
5. Configure alerts (email, SMS, Slack)

**Using Pingdom:**

Similar setup with more advanced features.

---

### Custom Alerts

**Health Check Monitoring Script:**

```bash
#!/bin/bash
# check-health.sh

ENDPOINT="http://localhost:5000/health"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

response=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)

if [ "$response" != "200" ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"⚠️ Backend health check failed!"}' \
    $SLACK_WEBHOOK
fi
```

**Run via Cron:**

```cron
*/5 * * * * /path/to/check-health.sh
```

---

## Troubleshooting

### Issue: Sentry not capturing errors

**Check:**
1. Verify `SENTRY_DSN` is set
2. Check environment is not 'test'
3. Verify error is not in `ignoreErrors` list
4. Check Sentry project settings

**Solution:**
```bash
# Test Sentry connection
curl -X POST "https://sentry.io/api/YOUR_PROJECT_ID/store/" \
  -H "X-Sentry-Auth: Sentry sentry_key=YOUR_KEY" \
  -d '{"message":"Test from curl"}'
```

---

### Issue: Health check returning 503

**Check:**
1. Database connection
2. Network connectivity
3. Database credentials
4. Database server status

**Debug:**
```bash
# Test database connection
psql -h localhost -U postgres -d garment_erp -c "SELECT 1"
```

---

### Issue: High memory usage

**Check metrics:**
```bash
curl http://localhost:5000/health/metrics
```

**Common causes:**
- Memory leaks
- Large result sets
- Caching issues
- Unoptimized queries

**Solution:**
- Use pagination
- Optimize queries
- Implement caching
- Profile with Sentry

---

### Issue: Logs not writing

**Check:**
1. Log directory exists and is writable
2. Winston configuration
3. Log rotation settings

**Debug:**
```bash
# Check permissions
ls -la backend/logs/

# Manually test Winston
node -e "require('./dist/utils/logger').logInfo('test')"
```

---

## Best Practices

### 1. Set Appropriate Sample Rates

**Production:**
```env
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% profiling
```

**Development:**
```env
SENTRY_TRACES_SAMPLE_RATE=1.0  # 100% for testing
```

### 2. Use Structured Logging

```typescript
logInfo('Order created', {
  orderId: order.id,
  userId: user.id,
  amount: order.total,
});
```

### 3. Monitor Critical Paths

Focus on:
- Authentication endpoints
- Payment processing
- Order creation
- Data exports
- API integrations

### 4. Set Up Alerts

- Error rate > threshold
- Response time > threshold
- Health check failures
- Database connection issues

### 5. Regular Reviews

- Review Sentry issues weekly
- Check performance trends
- Analyze error patterns
- Update alert thresholds

---

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Health Check API Pattern](https://microservices.io/patterns/observability/health-check-api.html)
- [Prometheus Monitoring](https://prometheus.io/)
- [Grafana Loki](https://grafana.com/oss/loki/)

---

**Maintained By:** Kashaya Fabs Development Team
**Last Review:** November 22, 2025
**Next Review:** December 22, 2025
