// helper/mernKnowledgeService.js
"use strict";

const logger = require("../logger");
const redis = require("../config/redisClient");
const db = require("../db/knex");

/**
 * 40-Day Production-Grade MERN Stack Curriculum & Deep-Dive Insights
 * Categorized across MongoDB, Express.js, React 19, Node.js Core, and Full-Stack Architecture.
 */
const MERN_CURRICULUM = [
  {
    id: "mongo-esr-rule",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "The ESR Rule: Why Compound Indexes Fail Without It",
    mentalModel:
      "Equality fields must come first, Sort fields second, and Range fields last (ESR: Equality, Sort, Range). Violating this ordering forces in-memory sorts and costly table scans.",
    codeIllustration: `// ❌ Wrong: Range before Sort forces in-memory B-tree sort
// Index: { createdAt: -1, status: 1, age: 1 }
// ✅ Right: Equality first, Sort second, Range last
db.users.createIndex({ status: 1, createdAt: -1, age: 1 });
// Matches query: .find({ status: 'active', age: { $gte: 21 } }).sort({ createdAt: -1 })`,
    takeaway:
      "Always design compound indexes in the strict sequence of Equality -> Sort -> Range to guarantee zero in-memory sorting.",
  },
  {
    id: "node-event-loop-microtask",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Event Loop Microtask Starvation: The Hidden Danger of process.nextTick",
    mentalModel:
      "The microtask queue (Promises & process.nextTick) runs completely to exhaustion between every single phase of the libuv event loop. Recursive microtasks will freeze your I/O and HTTP listeners.",
    codeIllustration: `// ❌ Freezes the event loop: recursive nextTick starves I/O
function drainQueue(items) {
  if (items.length) process.nextTick(() => drainQueue(items));
}
// ✅ Yields to libuv event loop: allows incoming HTTP requests to process
function drainQueue(items) {
  if (items.length) setImmediate(() => drainQueue(items));
}`,
    takeaway:
      "Use setImmediate() instead of process.nextTick() for long recursive asynchronous processing to prevent I/O starvation.",
  },
  {
    id: "react-fiber-time-slicing",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "Fiber Reconciliation: Work-in-Progress Trees & Time Slicing",
    mentalModel:
      "React Fiber turns the call stack into an interruptible linked list. React splits rendering into small units of work, yielding back to the browser to ensure smooth 60fps animations.",
    codeIllustration: `// Low-priority transition: Keeps the UI responsive while filtering thousands of items
const [isPending, startTransition] = useTransition();

function handleFilterChange(input) {
  setQuery(input); // Urgent: Updates input box immediately
  startTransition(() => {
    setFilteredList(expensiveFilter(input)); // Non-urgent: Interruptible
  });
}`,
    takeaway:
      "Wrap non-urgent, heavy rendering state updates in startTransition() to prevent frame drops during user typing or navigation.",
  },
  {
    id: "express-4arity-error",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "The 4-Arity Rule: Why Express Error Handlers Silently Fail",
    mentalModel:
      "Express inspects middleware function parameter length (fn.length) at registration. If your error handler omits the fourth parameter, Express treats it as regular middleware and skips it on errors.",
    codeIllustration: `// ❌ Broken: Express sees 3 arguments and treats it as standard route middleware
app.use((err, req, res) => { res.status(500).send(err.message); });

// ✅ Valid: 4 arguments triggers Express's internal error-handling pipeline
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message });
});`,
    takeaway:
      "Always declare all 4 parameters (err, req, res, next) in error middleware, even if your implementation never calls next().",
  },
  {
    id: "mongo-lean-queries",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "The lean() Secret: 5x Throughput & 80% Less Memory in Mongoose",
    mentalModel:
      "Mongoose documents wrap raw database results in rich prototype chains with getters, setters, and change tracking. .lean() skips hydration and returns plain JavaScript objects (POJOs).",
    codeIllustration: `// ❌ Heavy hydration: 10,000 full Mongoose document instances in V8 heap
const users = await User.find({ role: 'member' });

// ✅ 5x faster, 80% less memory: returns pure JSON POJOs
const users = await User.find({ role: 'member' }).lean();`,
    takeaway:
      "Append .lean() to every Mongoose read query where you are only reading or serializing data into API JSON responses.",
  },
  {
    id: "react-closure-trap",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "The Stale Closure Trap in Hooks: Synchronizing Asynchronous State",
    mentalModel:
      "Asynchronous callbacks in useEffect or event handlers capture the state variables of the render in which they were created. Reading that variable after an await reads stale historical state.",
    codeIllustration: `// ❌ Stale closure: always reads the count at timeout registration time
setTimeout(() => { setCount(count + 1); }, 1000);

// ✅ Functional updater: guarantees receiving the latest current state in memory
setTimeout(() => { setCount(prev => prev + 1); }, 1000);`,
    takeaway:
      "Always use functional state updaters (setState(prev => ...)) or mutable refs when referencing state inside timers and async callbacks.",
  },
  {
    id: "node-stream-backpressure",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Stream Backpressure: Preventing Container Out-of-Memory (OOM) Crashes",
    mentalModel:
      "When a readable stream emits chunks faster than the writable destination can flush them to socket/disk, data piles into RAM buffers until the container dies of an OOM crash.",
    codeIllustration: `const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');

// ❌ Unsafe: readable.pipe(writable) does not handle error teardown cleanly
// ✅ Production-safe: pipeline pauses reader when writer buffer is full
await pipeline(
  fs.createReadStream('huge-dataset.csv'),
  transformCsvToNdjson(),
  res // Express response stream
);`,
    takeaway:
      "Always use stream.promises.pipeline() rather than .pipe() to automatically handle backpressure, errors, and resource destruction.",
  },
  {
    id: "express-async-rejections",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "Express Async Error Trapping: Stopping Unhandled Promise Rejections",
    mentalModel:
      "In Express 4, unhandled promise rejections inside async route handlers bypass the global error middleware and crash the Node.js process in modern runtimes.",
    codeIllustration: `// Clean wrapper to ensure asynchronous exceptions reach the error middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage in Express route:
router.get('/data', asyncHandler(async (req, res) => {
  const result = await riskyServiceCall();
  res.json(result);
}));`,
    takeaway:
      "Wrap all Express 4 async route handlers with a centralized asyncHandler utility to guarantee error propagation to your 4-arity handler.",
  },
  {
    id: "mongo-unbounded-arrays",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "The 16MB BSON Limit: Avoiding the Unbounded Array Trap",
    mentalModel:
      "Embedding unbounded collections (like user activity logs or comments) inside a single document causes continuous disk relocation and eventually hits MongoDB's hard 16MB document cap.",
    codeIllustration: `// ❌ Anti-pattern: Unbounded array embedded in User document
// { _id: 1, email: 'alex@work.com', logs: [ ...millions of items ] }

// ✅ Pattern: Dedicated collection referencing the parent with an index
// Log Collection: { _id: 101, userId: 1, action: 'login', timestamp: ISODate() }
db.logs.createIndex({ userId: 1, timestamp: -1 });`,
    takeaway:
      "Embed only for 1-to-few bounded data (addresses, preferences); normalize into a dedicated collection for 1-to-many unbounded relationships.",
  },
  {
    id: "react-compiler-memo",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "React 19 Compiler: The Death of Manual useMemo & useCallback",
    mentalModel:
      "Manual memoization creates code clutter and dependency array drift bugs. The React 19 compiler performs automatic memoization at build-time, preserving referential stability.",
    codeIllustration: `// With React 19 Compiler, write clean, idiomatic JavaScript:
function OrderSummary({ items, discountCode }) {
  // Automatically memoized by React 19 compiler without useMemo:
  const total = items.reduce((acc, item) => acc + item.price, 0);
  const discounted = applyDiscount(total, discountCode);
  
  return <div>Total: \${discounted}</div>;
}`,
    takeaway:
      "Stop over-engineering with manual useMemo/useCallback everywhere; write clean code and let the React 19 compiler handle referential caching.",
  },
  {
    id: "node-uv-threadpool",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Tuning UV_THREADPOOL_SIZE: Unlocking Bcrypt & Crypto Concurrency",
    mentalModel:
      "libuv delegates synchronous file I/O, DNS queries, and crypto functions (like bcrypt and crypto.pbkdf2) to a background C thread pool whose default size is only 4 threads!",
    codeIllustration: `// Must be configured in shell/Docker entrypoint before Node.js initializes:
// Dockerfile / deployment env:
// ENV UV_THREADPOOL_SIZE=16

// In entrypoint index.js (must run before any other require):
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";`,
    takeaway:
      "Scale UV_THREADPOOL_SIZE to 2-4x your CPU core count if your Express API handles concurrent password hashing or image transformations.",
  },
  {
    id: "mern-auth-cookies-vs-jwt",
    category: "Full-Stack Architecture",
    pillarIcon: "🏗️",
    title: "JWT in LocalStorage vs HttpOnly Cookies: Defeating XSS Takeovers",
    mentalModel:
      "Any token placed in localStorage is readable by malicious JavaScript during an XSS vulnerability. HttpOnly, SameSite=Lax cookies are completely invisible to client-side scripts.",
    codeIllustration: `// In Express login controller:
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // Protects against CSRF on top-level navigations
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});`,
    takeaway:
      "Never store auth tokens in localStorage or sessionStorage. Use HttpOnly, Secure, SameSite=Lax cookies for resilient security.",
  },
  {
    id: "mongo-working-set-ram",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "WiredTiger Working Set: Keeping Hot Data in RAM",
    mentalModel:
      "When the active working set (frequently queried documents + indexes) exceeds WiredTiger's RAM allocation, query response times collapse from microseconds to milliseconds due to disk I/O.",
    codeIllustration: `// Check index sizes vs available system memory:
const stats = await db.collection('orders').stats();
console.log('Index size (MB):', stats.totalIndexSize / (1024 * 1024));
console.log('Collection size (MB):', stats.size / (1024 * 1024));`,
    takeaway:
      "Keep total index sizes and your daily hot dataset under 60% of total host RAM to prevent WiredTiger cache thrashing.",
  },
  {
    id: "react-use-transition-ux",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "useTransition vs useDeferredValue: Choosing the Right Primitive",
    mentalModel:
      "useTransition wraps the state setter at the dispatch source. useDeferredValue wraps a prop or state value in consumer components when you cannot control the trigger function.",
    codeIllustration: `// At the event trigger (Parent component):
const [isPending, startTransition] = useTransition();
const updateTab = (tab) => startTransition(() => setSelectedTab(tab));

// Inside the consumer (Child component receiving rapid prop changes):
function SlowChart({ filterValue }) {
  const deferredFilter = useDeferredValue(filterValue);
  return <HeavySvgGraph filter={deferredFilter} />;
}`,
    takeaway:
      "Use useTransition when you dispatch the state change; use useDeferredValue when receiving raw prop values that trigger slow renders.",
  },
  {
    id: "express-graceful-shutdown",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "Zero-Downtime Rolling Deploys: Graceful Connection Draining",
    mentalModel:
      "When your orchestration platform sends SIGTERM, abruptly killing the process drops active HTTP connections. You must stop accepting new requests, drain current ones, and disconnect DBs.",
    codeIllustration: `function setupGracefulShutdown(server, dbConnection) {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received: Closing HTTP server...');
    server.close(async () => {
      logger.info('HTTP server closed. Draining database connections...');
      await dbConnection.destroy();
      process.exit(0);
    });
  });
}`,
    takeaway:
      "Always listen for SIGTERM to close the HTTP listener before severing database pools, ensuring in-flight customer requests finish.",
  },
  {
    id: "node-memory-leaks-listeners",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Diagnosing Node.js Memory Leaks: Retained Closure Listeners",
    mentalModel:
      "Attaching event listeners to global singletons or process within request scopes holds the entire request closure in memory forever, triggering memory leaks.",
    codeIllustration: `// ❌ Leaks: each request appends a listener that retains 'req' and 'res'
globalBus.on('user_action', (data) => res.write(data));

// ✅ Safe: Use once() or remove the listener when the response completes
const onAction = (data) => res.write(data);
globalBus.on('user_action', onAction);
res.on('finish', () => globalBus.off('user_action', onAction));`,
    takeaway:
      "Always pair emitter.on() with emitter.off() in res.on('finish'), or use emitter.once() for single-event lifecycle triggers.",
  },
  {
    id: "mongo-aggregation-pipeline-order",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "Aggregation Optimization: Filter First, Project Early, Join Last",
    mentalModel:
      "Placing $lookup or $sort before $match forces MongoDB to join and sort millions of records in memory before discarding them. Filtering first drastically cuts pipeline memory.",
    codeIllustration: `// ✅ Optimal Aggregation Order:
db.orders.aggregate([
  { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } }, // Filter 95% of data
  { $project: { customerId: 1, total: 1 } }, // Strip unneeded fields
  { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
  { $group: { _id: '$customerId', totalSpend: { $sum: '$total' } } }
]);`,
    takeaway:
      "Put $match and $project at the absolute top of every aggregation pipeline to shrink the dataset before heavy join/group operations.",
  },
  {
    id: "react-state-colocation",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "State Colocation: The Cure for Context Re-render Waterfalls",
    mentalModel:
      "Lifting state into a high-level React Context causes every component consuming that Context to re-render whenever any value changes. Keeping state local confines re-renders.",
    codeIllustration: `// ❌ Bad: Modal open/close state stored in root AppContext
// ✅ Good: Local component state where it is consumed
function Header() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>Open Profile</button>
      {isModalOpen && <ProfileModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
}`,
    takeaway:
      "Colocate state as close to where it is used as possible. Lift state up only when multiple sibling components truly share it.",
  },
  {
    id: "mern-redis-cache-stampede",
    category: "Full-Stack Architecture",
    pillarIcon: "🏗️",
    title: "Cache-Aside & Thundering Herd: Protecting Node.js from Avalanches",
    mentalModel:
      "When a hot cache key expires, thousands of simultaneous Node.js requests query MongoDB simultaneously, causing CPU spikes. A distributed mutex or probabilistic early expiry prevents this.",
    codeIllustration: `// Cache-Aside with distributed locking:
async function getCachedUser(userId) {
  const cached = await redis.get(\`user:\${userId}\`);
  if (cached) return JSON.parse(cached);

  const lock = await redis.set(\`lock:\${userId}\`, '1', 'NX', 'PX', 3000);
  if (lock) {
    const user = await User.findById(userId).lean();
    await redis.set(\`user:\${userId}\`, JSON.stringify(user), 'EX', 3600);
    await redis.del(\`lock:\${userId}\`);
    return user;
  }
  // If locked, wait briefly and fetch cached result
  await new Promise(r => setTimeout(r, 50));
  return getCachedUser(userId);
}`,
    takeaway:
      "Use distributed locks or probabilistic refresh (XFetch) on high-traffic cache keys to prevent thundering herd database crashes.",
  },
  {
    id: "mongo-keyset-pagination",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "Keyset Cursor Pagination: Eliminating Slow skip(10000) Queries",
    mentalModel:
      "skip(N) forces MongoDB to scan through N index keys and discard them one by one. Keyset pagination jumps directly to the target record using an indexed comparison operator.",
    codeIllustration: `// ❌ O(N) scan: db.posts.find().sort({ _id: -1 }).skip(50000).limit(20);
// Takes seconds on large datasets!

// ✅ O(1) index seek: instantly locates the exact B-tree pointer
db.posts.find({ _id: { $lt: lastSeenObjectId } })
        .sort({ _id: -1 })
        .limit(20);`,
    takeaway:
      "Replace offset pagination (.skip()) with cursor/keyset pagination ({ _id: { $lt: cursor } }) for infinite scrolling and large tables.",
  },
  {
    id: "react-rsc-boundaries",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "Server Component Boundaries: The Serialization Contract",
    mentalModel:
      "Props passed across the 'use client' boundary from Server Components to Client Components must be serializable JSON. Functions, class instances, and Symbols cannot cross the network wire.",
    codeIllustration: `// In Server Component:
// ❌ Invalid prop: Functions cannot be serialized across the wire
<ClientButton onClick={() => db.update()} />

// ✅ Valid: Pass primitive IDs or server actions
<ClientButton itemId={item.id} action={serverActionHandler} />`,
    takeaway:
      "Keep Server-to-Client component boundaries lean, and pass only plain serializable objects or Server Actions across the boundary.",
  },
  {
    id: "express-rate-limit-token-bucket",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "Rate Limiting Architecture: Token Bucket vs Fixed Window",
    mentalModel:
      "Fixed window rate limiters allow double traffic at window boundaries (e.g. 100 requests at 11:59 and 100 at 12:00). Sliding window / Token Bucket provides smooth, continuous traffic policing.",
    codeIllustration: `const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Use RedisStore so rate limit counters are shared across clustered workers
});`,
    takeaway:
      "Back your Express rate limiters with Redis so limits are enforced globally across all horizontal Node.js worker instances.",
  },
  {
    id: "node-clustering-cpu",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Horizontal Concurrency: Node.js Cluster Module & Horizontal Slicing",
    mentalModel:
      "Node.js runs on a single CPU core by default. On a 16-core server, 15 cores sit idle unless you fork worker processes via the Node.js cluster module or a process manager like PM2.",
    codeIllustration: `const cluster = require('node:cluster');
const os = require('node:os');

if (cluster.isPrimary) {
  const cpus = os.cpus().length;
  for (let i = 0; i < cpus; i++) cluster.fork();
  cluster.on('exit', (worker) => cluster.fork()); // Auto-restart on failure
} else {
  require('./server'); // Worker boots Express HTTP listener
}`,
    takeaway:
      "Fork one worker per physical CPU core in production containers to achieve 100% hardware utilization and zero-downtime restarts.",
  },
  {
    id: "mongo-write-concern-durability",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "Write Concern & Quorum: Preventing Silent Data Loss on Failover",
    mentalModel:
      "Writing with w: 1 acknowledges as soon as the single primary writes to its local memory. If the primary crashes before replicating to secondaries, that write is permanently lost (rolled back).",
    codeIllustration: `// Financial or mission-critical write:
await Transaction.create([{
  userId,
  amount: 250,
  status: 'confirmed'
}], {
  writeConcern: { w: 'majority', j: true, wtimeout: 5000 }
});`,
    takeaway:
      "Use writeConcern: { w: 'majority', j: true } for sensitive financial and authentication operations to ensure durability across replica sets.",
  },
  {
    id: "react-custom-hooks-isolation",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "Custom Hook Mental Model: Behavior Reusability, Not State Singletons",
    mentalModel:
      "Custom hooks share stateful logic, not state itself. Each component that calls a custom hook gets its own completely isolated copy of the internal state variables.",
    codeIllustration: `function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(v => !v), []);
  return [on, toggle];
}
// Component A and Component B each have their own independent 'on' state!`,
    takeaway:
      "Think of custom hooks as reusable algorithms and lifecycle wiring, not as shared global state singletons.",
  },
  {
    id: "mern-liveness-vs-readiness",
    category: "Full-Stack Architecture",
    pillarIcon: "🏗️",
    title: "Liveness vs Readiness Probes: Why Checking DB in Liveness Kills Apps",
    mentalModel:
      "If your /health/live probe checks MongoDB connectivity and MongoDB has a temporary 10-second lag, Kubernetes will kill all healthy Node containers at once, triggering a cascading outage.",
    codeIllustration: `// Liveness: Is the Node event loop alive and accepting TCP?
app.get('/health/live', (req, res) => res.status(200).send('OK'));

// Readiness: Can this instance handle user traffic right now?
app.get('/health/ready', async (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  return isDbReady ? res.status(200).send('READY') : res.status(503).send('UNREADY');
});`,
    takeaway:
      "Never check external databases or third-party APIs inside Liveness probes; reserve database connectivity checks for Readiness probes.",
  },
  {
    id: "mongo-change-streams-events",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "Change Streams: Building Real-Time Event Pipelines Without Kafka",
    mentalModel:
      "MongoDB Change Streams tap directly into the WiredTiger oplog to emit real-time event notifications whenever documents are inserted, updated, or deleted.",
    codeIllustration: `const userChangeStream = User.watch([
  { $match: { 'operationType': 'update', 'updateDescription.updatedFields.tier': 'pro' } }
]);

userChangeStream.on('change', (change) => {
  logger.info('User upgraded to pro:', change.documentKey._id);
  sendWelcomeNotification(change.documentKey._id);
});`,
    takeaway:
      "Use MongoDB Change Streams with pipeline filtering for real-time WebSockets and cross-service notifications without external message brokers.",
  },
  {
    id: "node-crypto-constant-time",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Timing Attack Prevention: Why crypto.timingSafeEqual() is Mandatory",
    mentalModel:
      "Standard string comparison (a === b) exits at the first non-matching character. Attackers measure response times in nanoseconds to deduce secret API keys and HMAC signatures character by character.",
    codeIllustration: `const crypto = require('node:crypto');

// ❌ Vulnerable to timing analysis: if (userHmac === secretHmac) ...
// ✅ Constant-time comparison: Takes identical time regardless of match position
function verifySignature(userSig, expectedSig) {
  const userBuf = Buffer.from(userSig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (userBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(userBuf, expBuf);
}`,
    takeaway:
      "Always use crypto.timingSafeEqual() for validating webhooks, tokens, and password signatures to eliminate side-channel timing attacks.",
  },
  {
    id: "express-helmet-csp-nonces",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "Content Security Policy: Squelching XSS with Dynamic Script Nonces",
    mentalModel:
      "Allowing unsafe-inline in script-src destroys XSS protection. Generating a cryptographically random nonce per request guarantees only trusted server-rendered scripts can execute in the browser.",
    codeIllustration: `const crypto = require('node:crypto');

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  res.setHeader('Content-Security-Policy', 
    \`default-src 'self'; script-src 'self' 'nonce-\${res.locals.cspNonce}';\`
  );
  next();
});
// In HTML: <script nonce="<%= cspNonce %>">console.log('Safe');</script>`,
    takeaway:
      "Use per-request cryptographic nonces in your CSP headers rather than unsafe-inline to eradicate stored and reflected XSS.",
  },
  {
    id: "react-optimistic-ui",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "Optimistic UI: Delivering Sub-50ms Perceived Latency with Instant Rollback",
    mentalModel:
      "Waiting for network round-trips makes web apps feel sluggish. Optimistic updates render the expected success state immediately, rolling back cleanly if the server rejects the mutation.",
    codeIllustration: `// React 19 useOptimistic:
const [optimisticLikes, setOptimisticLikes] = useOptimistic(
  actualLikes,
  (current, delta) => current + delta
);

async function handleLike() {
  setOptimisticLikes(1); // UI updates instantly!
  try {
    await api.post('/like');
  } catch (err) {
    // React automatically reverts optimistic state on error!
    toast.error('Could not save like');
  }
}`,
    takeaway:
      "Implement optimistic state updates using React 19's useOptimistic hook for like buttons, checkboxes, and routine check-ins.",
  },
  {
    id: "mongo-collation-case-insensitive",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "Case-Insensitive Searching: Why Collation Beats Regex Index Scans",
    mentalModel:
      "Querying with regex case-insensitivity (.find({ email: /^alex/i })) cannot effectively utilize standard B-tree index prefixes, degrading into a full collection scan. Index collations solve this.",
    codeIllustration: `// Create index with case-insensitive collation:
db.users.createIndex(
  { email: 1 }, 
  { collation: { locale: 'en', strength: 2 } }
);

// Blazing fast index search (matches 'alex@test.com', 'ALEX@test.com'):
db.users.find({ email: 'alex@test.com' })
        .collation({ locale: 'en', strength: 2 });`,
    takeaway:
      "Use strength: 2 index collations for case-insensitive email and username queries instead of slow case-insensitive regexes.",
  },
  {
    id: "node-diagnostics-heap-snapshots",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "V8 Heap Snapshot Analysis: Hunting Memory Leaks in Production",
    mentalModel:
      "Garbage collection cannot free objects referenced in the root retention path. Taking heap snapshots before and after stress tests highlights objects with growing shallow and retained sizes.",
    codeIllustration: `const v8 = require('node:v8');
const fs = require('node:fs');

function dumpHeapSnapshot(label) {
  const fileName = \`heap-\${label}-\${Date.now()}.heapsnapshot\`;
  const stream = v8.getHeapSnapshot();
  stream.pipe(fs.createWriteStream(fileName));
  logger.info(\`Heap snapshot saved to \${fileName}\`);
}`,
    takeaway:
      "Inspect heap snapshots using Chrome DevTools Memory profiler to locate objects whose 'Retained Size' balloons after load tests.",
  },
  {
    id: "express-compression-snappy",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "Response Compression: Balancing Bandwidth vs CPU Overhead",
    mentalModel:
      "Gzipping payloads smaller than 1KB wastes more CPU cycles in compression overhead than it saves in network bytes. Always set an intelligent threshold.",
    codeIllustration: `const compression = require('compression');

app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));`,
    takeaway:
      "Configure compression with threshold: 1024 and let reverse proxies (Nginx/Cloudflare) handle static asset compression whenever possible.",
  },
  {
    id: "react-abort-controller",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "Cancelling Stale HTTP Requests: Using AbortController in useEffect",
    mentalModel:
      "When a user types rapidly or changes tabs, prior pending HTTP requests continue in flight. If an older request finishes after a newer one, it overwrites the UI with stale data (race condition).",
    codeIllustration: `useEffect(() => {
  const controller = new AbortController();
  
  fetch(\`/api/search?q=\${query}\`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setResults(data))
    .catch(err => { if (err.name !== 'AbortError') handleError(err); });

  return () => controller.abort(); // Cancels request if query changes or unmounts
}, [query]);`,
    takeaway:
      "Always pass AbortController.signal to fetch() inside useEffect cleanup functions to prevent out-of-order race conditions.",
  },
  {
    id: "mern-polyglot-persistence",
    category: "Full-Stack Architecture",
    pillarIcon: "🏗️",
    title: "Polyglot Persistence: When Document Stores Fail and Relational Knex Wins",
    mentalModel:
      "MongoDB excels at hierarchical, polymorphic, and rapidly evolving document schemas. Relational databases (Knex/PostgreSQL) excel at strict financial ledgers, transactional ACID audits, and foreign keys.",
    codeIllustration: `// Polyglot Architecture in Node.js:
// MongoDB: Stores flexible user profiles, habit logs, rich journal entries
// PostgreSQL/Knex: Stores billing receipts, squad memberships, ACID balances`,
    takeaway:
      "Don't force everything into a single database. Use MongoDB for rapid document hierarchies and SQL for rigorous ACID ledgers.",
  },
  {
    id: "mongo-bulk-write-batches",
    category: "MongoDB",
    pillarIcon: "🍃",
    title: "Bulk Operations with bulkWrite(): 100x Speedup Over Sequential save()",
    mentalModel:
      "Running 1,000 await doc.save() loops in Node.js triggers 1,000 separate network round-trips. bulkWrite() bundles all mutations into a single network transmission to the database server.",
    codeIllustration: `// ❌ Slow: 1,000 network round trips
// for (const user of users) await User.updateOne(...);

// ✅ Blazing: 1 single network payload
await User.bulkWrite(
  users.map(u => ({
    updateOne: {
      filter: { _id: u.id },
      update: { $set: { streak: u.streak, lastSeen: new Date() } }
    }
  })),
  { ordered: false } // Parallel execution on MongoDB shards
);`,
    takeaway:
      "Use bulkWrite({ ordered: false }) for batch syncs, background crons, and mass updates to reduce network latency by 99%.",
  },
  {
    id: "node-unhandled-rejection-lifecycle",
    category: "Node.js Core",
    pillarIcon: "🟢",
    title: "Process Lifecycle: uncaughtException vs unhandledRejection",
    mentalModel:
      "An unhandled rejection means a Promise lacked a .catch(). An uncaught exception means synchronous code threw an untrapped Error. Both leave your process in an undefined, corrupted state.",
    codeIllustration: `process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
  // In production, initiate graceful teardown because internal state may be corrupted
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.stack);
  process.exit(1); // Never attempt to continue running after uncaughtException
});`,
    takeaway:
      "Log unhandled rejections with full stack traces and gracefully restart worker containers rather than allowing corrupt state to persist.",
  },
  {
    id: "express-sub-app-routing",
    category: "Express.js",
    pillarIcon: "🚂",
    title: "Modular Route Architecture: Decoupling Express APIs with Sub-Routers",
    mentalModel:
      "Monolithic route files become unmaintainable spaghetti. Grouping endpoints into isolated, domain-driven express.Router() modules enables clean unit testing and middleware isolation.",
    codeIllustration: `// routes/routine.routes.js
const router = express.Router({ mergeParams: true });
router.get('/checkin', checkinController);
router.post('/sprint', sprintController);

// server.js
app.use('/api/v1/routine', router);`,
    takeaway:
      "Use express.Router({ mergeParams: true }) to structure clean, modular route trees with isolated domain-level middlewares.",
  },
  {
    id: "react-ref-imperative-handle",
    category: "React 19",
    pillarIcon: "⚛️",
    title: "useImperativeHandle: Clean Component APIs Without DOM Leaks",
    mentalModel:
      "Leaking raw DOM nodes through forwardRef breaks encapsulation. useImperativeHandle exposes only a curated set of imperative methods (like .focus() or .scrollIntoView()).",
    codeIllustration: `// React 19: ref is a standard prop (no forwardRef needed)
function CustomEditor({ ref }) {
  const inputRef = useRef();

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    clear: () => { inputRef.current.value = ''; }
  }));

  return <textarea ref={inputRef} />;
}`,
    takeaway:
      "Use useImperativeHandle to restrict what parent components can do with child refs, preserving tight component encapsulation.",
  },
  {
    id: "mern-health-check-metrics",
    category: "Full-Stack Architecture",
    pillarIcon: "🏗️",
    title: "Production Diagnostics: Monitoring Event Loop Lag & Heap Metrics",
    mentalModel:
      "Standard CPU metrics fail to warn you when synchronous code blocks the event loop. Measuring event loop delay (eventLoopDelay) directly detects latency spikes before users feel them.",
    codeIllustration: `const perf_hooks = require('node:perf_hooks');
const histogram = perf_hooks.monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

app.get('/metrics', (req, res) => {
  res.json({
    p50_ms: histogram.percentile(50) / 1e6,
    p99_ms: histogram.percentile(99) / 1e6,
    heapUsed_mb: process.memoryUsage().heapUsed / (1024 * 1024)
  });
});`,
    takeaway:
      "Monitor monitorEventLoopDelay() in your Node.js metrics endpoints to catch CPU-blocking operations before they cause HTTP 504 timeouts.",
  },
];

// In-memory fallback tracking for active session or test runs
const seenMemoryStore = new Map();
const resetMemoryStore = new Map();

/**
 * Retrieve previously seen insight IDs for a subscriber from Redis, DB, or memory
 * @param {string} email
 * @returns {Promise<Set<string>>}
 */
async function getSeenMernInsightIds(email) {
  const normEmail = String(email || "")
    .toLowerCase()
    .trim();
  const seenSet = new Set();

  // 1. Check in-memory store
  if (seenMemoryStore.has(normEmail)) {
    for (const id of seenMemoryStore.get(normEmail)) {
      seenSet.add(id);
    }
  }

  // 2. Check Redis Set
  try {
    if (redis && typeof redis.smembers === "function") {
      const redisSeen = await redis.smembers(`mern:seen:${normEmail}`);
      if (Array.isArray(redisSeen)) {
        for (const id of redisSeen) {
          seenSet.add(id);
        }
      }
    }
  } catch (redisErr) {
    logger.debug("MERN Redis smembers lookup skipped", { error: redisErr.message });
  }

  // Check last curriculum reset timestamp
  let lastResetAt = resetMemoryStore.get(normEmail) || 0;
  try {
    if (redis && typeof redis.get === "function") {
      const redisReset = await redis.get(`mern:reset_at:${normEmail}`);
      if (redisReset && Number(redisReset) > lastResetAt) {
        lastResetAt = Number(redisReset);
      }
    }
  } catch (redisErr) {
    logger.debug("MERN Redis reset_at lookup skipped", { error: redisErr.message });
  }

  // 3. Query past sent email tracker metadata if available (only after last curriculum reset)
  try {
    if (db && typeof db === "function") {
      let query = db("email_tracker")
        .where({ recipient_email: normEmail })
        .select("metadata", "created_at");

      if (lastResetAt > 0) {
        query = query.where("created_at", ">", new Date(lastResetAt));
      }

      const pastTrackerRows = await query.limit(100);

      for (const row of pastTrackerRows) {
        if (!row.metadata) continue;
        let meta = row.metadata;
        if (typeof meta === "string") {
          try {
            meta = JSON.parse(meta);
          } catch (_err) {
            meta = null;
          }
        }
        if (meta && meta.mernInsightId) {
          seenSet.add(meta.mernInsightId);
        }
      }
    }
  } catch (dbErr) {
    logger.debug("MERN DB email_tracker lookup skipped", { error: dbErr.message });
  }

  return seenSet;
}

/**
 * Mark an insight ID as delivered to an email
 * @param {string} email
 * @param {string} insightId
 */
async function markMernInsightDelivered(email, insightId) {
  const normEmail = String(email || "")
    .toLowerCase()
    .trim();
  if (!normEmail || !insightId) return;

  // 1. Update in-memory store
  if (!seenMemoryStore.has(normEmail)) {
    seenMemoryStore.set(normEmail, new Set());
  }
  seenMemoryStore.get(normEmail).add(insightId);

  // 2. Update Redis Set
  try {
    if (redis && typeof redis.sadd === "function") {
      await redis.sadd(`mern:seen:${normEmail}`, insightId);
      // Retain history for 180 days
      if (typeof redis.expire === "function") {
        await redis.expire(`mern:seen:${normEmail}`, 180 * 24 * 60 * 60);
      }
    }
  } catch (redisErr) {
    logger.debug("MERN Redis sadd record skipped", { error: redisErr.message });
  }
}

/**
 * Reset MERN learning progress for a subscriber
 * @param {string} email
 */
async function resetMernProgress(email) {
  const normEmail = String(email || "")
    .toLowerCase()
    .trim();
  if (!normEmail) return;

  seenMemoryStore.delete(normEmail);
  const now = Date.now();
  resetMemoryStore.set(normEmail, now);

  try {
    if (redis && typeof redis.del === "function") {
      await redis.del(`mern:seen:${normEmail}`);
      if (typeof redis.set === "function") {
        await redis.set(`mern:reset_at:${normEmail}`, String(now));
      }
    }
  } catch (redisErr) {
    logger.debug("MERN Redis del reset skipped", { error: redisErr.message });
  }
}

/**
 * Get daily dynamic MERN insight for a subscriber, guaranteeing non-repetition.
 *
 * @param {Object} options
 * @param {string} options.email - Subscriber email
 * @param {string} [options.timezone] - Subscriber timezone
 * @param {number} [options.streakCount] - Active streak count
 * @param {string|number} [options.dayNumber] - Day of the month
 * @param {string} [options.forceId] - Force a specific insight by ID (for tests/previews)
 * @returns {Promise<Object>}
 */
async function getDailyMernInsight(options = {}) {
  const normEmail = String(options.email || "developer@example.com")
    .toLowerCase()
    .trim();

  // If a specific ID is requested
  if (options.forceId) {
    const matched = MERN_CURRICULUM.find((item) => item.id === options.forceId);
    if (matched) {
      const idx = MERN_CURRICULUM.indexOf(matched);
      return {
        ...matched,
        sequenceNumber: idx + 1,
        totalLessons: MERN_CURRICULUM.length,
        isMasteryReview: false,
      };
    }
  }

  // Retrieve seen IDs for this subscriber
  const seenSet = await getSeenMernInsightIds(normEmail);

  // Find candidates that have NOT been delivered yet
  let candidates = MERN_CURRICULUM.filter((item) => !seenSet.has(item.id));
  let isMasteryReview = false;

  // If the subscriber has completed all 40 lessons, reset and start Mastery Review cycle!
  if (candidates.length === 0) {
    logger.info(
      "🎉 Subscriber completed full MERN curriculum! Resetting for Mastery Review cycle.",
      {
        email: normEmail,
        totalCompleted: MERN_CURRICULUM.length,
      },
    );
    await resetMernProgress(normEmail);
    candidates = [...MERN_CURRICULUM];
    isMasteryReview = true;
  }

  // Pick the next candidate in sequence
  const selected = candidates[0];
  const sequenceNumber = MERN_CURRICULUM.findIndex((item) => item.id === selected.id) + 1;

  // Pre-emptively record in memory so repeated synchronous calls within the same run don't duplicate
  if (!seenMemoryStore.has(normEmail)) {
    seenMemoryStore.set(normEmail, new Set());
  }
  seenMemoryStore.get(normEmail).add(selected.id);

  return {
    id: selected.id,
    category: selected.category,
    pillarIcon: selected.pillarIcon,
    title: selected.title,
    mentalModel: selected.mentalModel,
    codeIllustration: selected.codeIllustration,
    takeaway: selected.takeaway,
    sequenceNumber,
    totalLessons: MERN_CURRICULUM.length,
    isMasteryReview,
  };
}

/**
 * Return the full curriculum
 */
function getCurriculum() {
  return [...MERN_CURRICULUM];
}

module.exports = {
  MERN_CURRICULUM,
  getDailyMernInsight,
  markMernInsightDelivered,
  getSeenMernInsightIds,
  resetMernProgress,
  getCurriculum,
};
