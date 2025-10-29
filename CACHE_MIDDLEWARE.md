# Cache Middleware Documentation

A high-performance, universally applicable caching middleware for Express.js with Redis and memory cache support.

## 🚀 Features

- **Multi-Layer Caching**: Redis + Memory Cache with intelligent fallback
- **Multiple Strategies**: Different TTL strategies for various use cases
- **User-Specific Caching**: Cache per user ID for personalized content
- **Public Caching**: Cache for public APIs without user context
- **Automatic Invalidation**: Intelligent cache invalidation on updates
- **Performance Monitoring**: Detailed cache statistics and health checks
- **Flexible Configuration**: Easy configuration via environment variables
- **Automatic Caching**: Responses are cached automatically after first request

## 📦 Installation

The cache middleware is already integrated into the project. Required dependencies:

```json
{
  "node-cache": "^5.1.2",
  "redis": "^4.6.12"
}
```

## ⚙️ Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Cache TTL Configuration (optional)
CACHE_TTL_DEFAULT=300
CACHE_TTL_SHORT=60
CACHE_TTL_LONG=3600
```

### Cache Strategies

```javascript
const cacheStrategies = {
  short: { ttl: 60 }, // 1 minute - for frequently changing data
  default: { ttl: 300 }, // 5 minutes - standard for API responses
  medium: { ttl: 900 }, // 15 minutes - for user profiles
  long: { ttl: 3600 }, // 1 hour - for static content
  veryLong: { ttl: 86400 }, // 24 hours - for truly static data
  none: { ttl: 0 }, // No caching
};
```

## 🎯 Usage

### Basic Caching

```javascript
import { cache } from '#middleware/cache.middleware.js';

// Simple caching with default TTL (5 minutes)
app.get('/api/data', cache(), (req, res) => {
  res.json({ data: 'expensive operation result' });
});

// Caching with specific TTL
app.get('/api/data', cache({ ttl: 60 }), (req, res) => {
  res.json({ data: 'short-lived data' });
});

// Caching with strategy
app.get('/api/data', cache({ strategy: 'long' }), (req, res) => {
  res.json({ data: 'long-lived data' });
});
```

### User-Specific Caching

```javascript
import { userCache } from '#utils/cache.utils.js';

// Cache per user ID (automatically caches based on req.user.id)
app.get('/api/profile', authenticateToken, userCache(), (req, res) => {
  res.json({ user: req.user, profile: 'user-specific data' });
});
```

### Public API Caching

```javascript
import { publicCache } from '#utils/cache.utils.js';

// Cache for public APIs (no user context)
app.get('/api/public/data', publicCache(), (req, res) => {
  res.json({ data: 'public data' });
});
```

### Route-Specific Caching

```javascript
import { userRoutesCache, authRoutesCache } from '#utils/cache.utils.js';

// User routes caching
router.get(
  '/users',
  authenticateToken,
  userRoutesCache(), // Automatically caches based on user ID
  fetchAllUsers
);

// Auth routes caching
router.get('/auth/me', authenticateToken, authRoutesCache(), getCurrentUser);
```

### Conditional Caching

```javascript
import { conditionalCache } from '#utils/cache.utils.js';

// Cache based on headers (e.g., language)
app.get(
  '/api/data',
  conditionalCache({
    includeHeaders: ['accept-language'],
    skipHeaders: ['authorization'],
  }),
  (req, res) => {
    res.json({ data: 'conditional data' });
  }
);
```

### Cache Invalidation

The cache middleware automatically invalidates cache entries when data is updated:

```javascript
import { invalidateCache } from '#middleware/cache.middleware.js';

// Automatically invalidate cache after successful update
app.put(
  '/api/users/:id',
  authenticateToken,
  invalidateCache({
    patterns: [
      'users:*', // All users list
      'user:*', // All user caches
      '*:users:*יות', // Any cache containing users
    ],
    tags: ['users'],
  }),
  updateUser
);

// Delete operation also invalidates cache
app.delete(
  '/api/users/:id',
  authenticateToken,
  invalidateCache({
    patterns: ['users:*', 'user:*'],
  }),
  deleteUser
);
```

## 🔧 Cache Management API

### Get Cache Statistics

```bash
GET /api/cache/stats
```

Response:

```json
{
  "success": true,
  "data": {
    "hits": 150,
    "misses": 25,
    "sets": 30,
    "deletes": 5,
    "errors": 0,
    "hitRate": 0.857,
    "memoryKeys": 45,
    "redisConnected": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Cache Health Check

```bash
GET /api/cache/health
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "OK",
    "hits": 150,
    "misses": 25,
    "hitRate": 0.857,
    "memoryKeys": 45,
    "redisConnected": true
  }
}
```

### Clear All Cache

```bash
POST /api/cache/clear
```

Response:

```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

**⚠️ Warning**: This clears ALL cache entries. Use with caution!

### Invalidate Specific Cache

```bash
POST /api/cache/invalidate
Content-Type: application/json

{
  "patterns": ["user:123:*"],
  "tags": ["users"],
  "userId": "123",
  "endpoint": "/api/users",
  "resource": "users"
}
```

Response:

```json
{
  "success": true,
  "message": "Invalidated 5 cache entries",
  "invalidatedCount": 5
}
```

### Get Cache Strategies

```bash
GET /api/cache/strategies
```

Response:

```json
{
  "success": true,
  "data": {
    "strategies": {
      "short": { "ttl": 60 },
      "default": { "ttl": 300 },
      "medium": { "ttl": 900 },
      "long": { "ttl": 3600 },
      "veryLong": { "ttl": 86400 },
      "none": { "ttl": 0 }
    },
    "keys": {
      "user": "user:{id}",
      "users": "users:{page}:{limit}",
      "auth": "auth:{token}",
      "api": "api:{path}:{params}",
      "session": "session:{id}",
      "custom": "{prefix}:{args}"
    }
  }
}
```

### Get Cache Info

```bash
GET /api/cache/info
```

Response:

```json
{
  "success": true,
  "data": {
    "strategies": ["short", "default", "medium", "long", "veryLong", "none"],
    "keyPatterns": {
      "user": "user:{userId}:{endpoint}:{query}",
      "public": "public:{endpoint}:{query}",
      "api": "api:{userId}:{endpoint}:{query}",
      "session": "session:{sessionId}:{endpoint}",
      "conditional": "conditional:{endpoint}:{headers}:{query}"
    },
    "ttl": {
      "short": 60,
      "default": 300,
      "medium": 900,
      "long": 3600,
      "veryLong": 86400
    }
  }
}
```

## 📊 Performance Monitoring

### Cache Headers

The middleware adds the following headers to responses:

```
X-Cache: HIT|MISS
X-Cache-Key: <base64-encoded-cache-key>
X-Cache-TTL: 300
X-Cache-Tags: users,profile
```

### Performance Logging

```javascript
import { cachePerformance } from '#utils/cache.utils.js';

// Enable monitoring for all requests
app.use(cachePerformance());
```

Logs contain:

- Request method and URL
- Response status and duration
- Cache status (HIT/MISS)
- Cache key and TTL

Example log:

```json
{
  "method": "GET",
  "url": "/api/users",
  "statusCode": 200,
  "duration": 13,
  "cacheStatus": "HIT",
  "cacheKey": "dXNlcnM6MTc6Ont9",
  "cacheTTL": "300"
}
```

## 🎨 Cache Key Patterns

### Automatic Key Generation

The middleware automatically generates cache keys based on:

- **Request method**: GET, POST, etc.
- **URL path**: `/api/users`
- **User ID**: From `req.user.id` (if authenticated)
- **Query parameters**: `?page=1&limit=10`

Examples:

```javascript
// User-specific
user:123:profile:{"page":1}
user:123:/api/users:{"page":1,"limit":10}

// Public APIs
public:/api/products:{"category":"electronics"}
public:/api/news:{"page":1}

// Anonymous users
anonymous:/api/products:{"search":"laptop"}

// Sessions
session:abc123:/api/cart
```

### Custom Key Generation

```javascript
import { cacheKey } from '#middleware/cache.middleware.js';

app.get(
  '/api/data',
  cache({
    keyGenerator: req => {
      return cacheKey.custom('custom', req.params.id, req.query.type);
    },
  }),
  (req, res) => {
    res.json({ data: 'custom cached data' });
  }
);
```

Available key helpers:

```javascript
cacheKey.user(id); // user:123
cacheKey.users(page, limit); // users:1:10
cacheKey.auth(token); // auth:token123
cacheKey.api(path, params); // api:/users:{"page":1}
cacheKey.session(id); // session:abc123
cacheKey.custom(prefix, ...args); // custom:prefix:arg1:arg2
```

## 🔄 Cache Invalidation Strategies

### Automatic Invalidation

Cache is automatically invalidated when using the `invalidateCache` middleware:

```javascript
// Pattern-based invalidation
invalidateCache({
  patterns: [
    'users:*', // All entries starting with "users:"
    '*:profile:*', // All entries containing ":profile:"
  ],
  tags: ['users'], // Tag-based invalidation
});
```

### Manual Invalidation via API

```javascript
// Invalidate specific user cache
POST /api/cache/invalidate
{
  "userId": "123"
}

// Invalidate by pattern
POST /api/cache/invalidate
{
  "patterns": ["user:123:*"]
}

// Invalidate by tags
POST /api/cache/invalidate
{
  "tags": ["users"]
}
```

### Utility Functions

```javascript
import {
  invalidateUserCache,
  invalidateApiCache,
  invalidateResourceCache,
} from '#utils/cache.utils.js';

// Invalidate all cache for a specific user
await invalidateUserCache('123');

// Invalidate all cache for a user (middleware form)
router.put('/users/:id', invalidateUserCache(req.params.id), updateUser);

// Invalidate API endpoint cache
await invalidateApiCache('/api/users');

// Invalidate resource cache
await invalidateResourceCache('products');
```

## 🚀 Best Practices

### 1. Choose Appropriate TTL Strategies

```javascript
// Short-lived: User-specific data that changes frequently
userCache({ strategy: 'short' }); // 1 minute

// Medium: Standard API responses
apiRoutesCache({ strategy: 'medium' }); // 15 minutes

// Long: Static or rarely changing data
publicCache({ strategy: 'long' }); // 1 hour

// Very Long: Truly static data
publicCache({ strategy: 'veryLong' }); // 24 hours
```

### 2. Always Invalidate Cache on Updates

```javascript
// ✅ Good: Invalidate cache after updates
router.put(
  '/users/:id',
  authenticateToken,
  invalidateCache({ patterns: ['users:*', 'user:*'] }),
  updateUser
);

// ❌ Bad: No invalidation - stale data
router.put(
  '/users/:id',
  authenticateToken,
  updateUser // Cache won't update!
);
```

### 3. Use Performance Monitoring

```javascript
// Enable performance monitoring globally
app.use(cachePerformance());

// Monitor cache health periodically
setInterval(async () => {
  const health = await cacheHealthCheck();
  if (health.status !== 'OK') {
    logger.warn('Cache health issue:', health);
  }
}, 60000); // Every minute
```

### 4. Handle Cache Errors Gracefully

```javascript
// Cache errors are automatically caught and logged
// The application continues to work without cache
app.get('/api/data', cache(), (req, res) => {
  // If cache fails, request still processes normally
  res.json({ data: 'always works' });
});
```

### 5. Use Redis for Distributed Systems

```javascript
// Redis enables cache sharing across multiple servers
// Memory cache is used as fallback if Redis is unavailable
REDIS_URL=redis://redis:6379
```

## 🐛 Troubleshooting

### Redis Connection Issues

```javascript
import { getRedisClient } from '#config/cache.js';

// Check Redis connection
const redisClient = getRedisClient();
if (!redisClient?.isReady) {
  logger.warn('Redis not available, using memory cache only');
  // Memory cache will be used as fallback
}
```

**Symptoms**: Cache works but only per-server (not shared)
**Solution**: Check Redis connection and REDIS_URL environment variable

### Cache Performance Issues

```javascript
import { getCacheStats } from '#middleware/cache.middleware.js';

// Check hit rate
const stats = getCacheStats();
if (stats.hitRate < 0.5) {
  logger.warn('Low cache hit rate:', stats.hitRate);
  // Consider:
  // - Increasing TTL for frequently accessed data
  // - Checking if cache keys are too specific
  // - Verifying cache invalidation isn't too aggressive
}
```

**Symptoms**: Low hit rate (< 50%)
**Solutions**:

- Increase TTL for static data
- Review cache key patterns
- Check invalidation frequency

### Memory Usage

```javascript
import { memoryCache } from '#config/cache.js';

// Monitor memory cache size
const memoryKeys = memoryCache.keys().length;
if (memoryKeys > 1000) {
  logger.warn('High memory cache usage:', memoryKeys);
  // Consider increasing Redis usage or reducing TTL
}
```

**Symptoms**: High memory usage
**Solutions**:

- Ensure Redis is connected (distributed cache)
- Reduce TTL for less critical data
- Implement cache size limits

## 📈 Performance Metrics

### Expected Performance Improvements

- **Response Time**: 50-90% reduction for cached requests
- **Database Load**: 60-80% reduction for frequent queries
- **Memory Usage**: ~10-20MB for memory cache (with Redis: distributed)
- **Hit Rate**: 70-90% with optimal configuration

### Monitoring Metrics

```javascript
// Collect cache metrics
const stats = getCacheStats();
const metrics = {
  hitRate: stats.hitRate, // Target: > 70%
  hits: stats.hits, // Cache hits
  misses: stats.misses, // Cache misses
  memoryKeys: stats.memoryKeys, // Keys in memory
  redisConnected: stats.redisConnected, // Redis status
};

// Calculate cache efficiency
const efficiency = stats.hits / (stats.hits + stats.misses);
console.log(`Cache efficiency: ${(efficiency * 100).toFixed(2)}%`);
```

## 🔧 Advanced Configuration

### Custom Cache Strategies

You can use custom TTL values directly:

```javascript
// Custom TTL in seconds
cache({ ttl: 120 }); // 2 minutes

// Or use strategy names
cache({ strategy: 'medium' }); // 15 minutes
```

### Skip Caching for Specific Conditions

```javascript
// Skip caching for certain conditions
cache({
  skipIf: req => {
    // Don't cache admin users
    return req.user?.role === 'admin';
  },
});

// Skip caching entirely
cache({ strategy: 'none' }); // No caching
```

### Tag-Based Cache Management

```javascript
// Add tags to cache entries
cache({
  tags: ['users', 'profile'],
});

// Invalidate by tags
invalidateCache({
  tags: ['users'], // Invalidates all entries with 'users' tag
});
```

## 📚 Implementation Details

### How It Works

1. **Request comes in** → Middleware checks cache
2. **Cache HIT** → Return cached data immediately
3. **Cache MISS** → Execute route handler
4. **Response generated** → Automatically cached for next time
5. **Update operation** → Cache automatically invalidated

### Multi-Layer Architecture

```
Request
  ↓
Memory Cache (fastest, per-server)
  ↓ (miss)
Redis Cache (distributed, shared)
  ↓ (miss)
Database/API
  ↓
Store in both caches
```

### Cache Key Generation Flow

```
Request: GET /api/users?page=1
User: { id: 123, role: 'user' }
  ↓
Generated Key: "get:/api/users:123:{\"page\":1}"
  ↓
Base64 Encoded (for headers): "dXNlcnM6MTc6Ont9"
```

## 🔒 Security Considerations

### Sensitive Data

```javascript
// Don't cache sensitive data
cache({ strategy: 'none' });

// Or skip caching for authenticated admin routes
cache({
  skipIf: req => req.user?.role === 'admin',
});
```

### Cache Key Security

Cache keys are automatically sanitized when used in HTTP headers:

- Keys are base64 encoded
- Keys are truncated to 100 characters
- No sensitive information should be in cache keys

## 🎯 Real-World Examples

### Example 1: User Profile API

```javascript
// GET: Cache user profile for 15 minutes
router.get(
  '/users/:id',
  authenticateToken,
  userRoutesCache({ strategy: 'medium' }),
  fetchUserById
);

// PUT: Update and invalidate cache
router.put(
  '/users/:id',
  authenticateToken,
  invalidateCache({
    patterns: [`user:${req.params.id}:*`, 'users:*'],
  }),
  updateUserById
);
```

### Example 2: Public Product Listing

```javascript
// Cache products for 1 hour (static data)
router.get('/products', publicCache({ strategy: 'long' }), fetchProducts);
```

### Example 3: Dynamic User Dashboard

```javascript
// Cache for 1 minute (frequently changing)
router.get(
  '/dashboard',
  authenticateToken,
  userCache({ strategy: 'short' }),
  getDashboard
);
```

## 📝 Summary

The cache middleware provides a robust, scalable solution for all caching requirements:

- ✅ **Automatic caching** - No manual cache management needed
- ✅ **Multi-layer** - Redis + Memory with automatic fallback
- ✅ **User-aware** - Per-user caching support
- ✅ **Auto-invalidation** - Cache updates automatically
- ✅ **Monitoring** - Built-in statistics and health checks
- ✅ **Flexible** - Multiple strategies and configuration options
- ✅ **Production-ready** - Error handling and graceful degradation

The cache middleware is fully integrated into the project and ready for production use.
