# 100k Readiness Checklist

This app can support `100k registered users`, but it should be treated as a staged scale-up project rather than a flip-the-switch moment.

## Current posture

- `MongoDB` is still the primary system of record for most product flows.
- `Redis` is already available for sessions, rate limiting, locks, and now shared read caching.
- The online exam path has the strongest scaling story because it can use the dedicated exam runtime.
- Tenant data is isolated per school database, which helps operational safety, but active tenant cache growth still needs monitoring.

## Implemented now

1. Shared Redis-backed cache for repeat-heavy server reads
   - Workspace support data now uses local cache plus shared Redis cache.
   - Public school lookups now use local cache plus shared Redis cache.
   - Student test server caches now use local cache plus shared Redis cache for hot paper/user payloads.

2. Scale telemetry on the existing health surface
   - `/api/health` now reports process memory, uptime, tenant DB cache size, compiled tenant model count, and local cache activity.
   - The company health page now surfaces these scale signals so operational issues are visible before they become outages.

3. Query/index hardening for hot list paths
   - Added compound indexes for workspace and student course feeds.
   - Added compound indexes for workspace and student diary feeds.
   - Added a student scope index for class/section roster reads.

## Before a real 100k launch

1. Run `npm run build-tenant-indexes` against production data before traffic cutover.
2. Keep `Redis` configured in production so shared caches and lock paths stay active.
3. Keep the exam runtime enabled for high-volume online test traffic.
4. Run the existing stress scripts against production-like infrastructure, not just localhost.
5. Track p95 and p99 latency for:
   - `/api/health`
   - student test list/open/start/save/submit routes
   - teacher course list/detail pages
   - diary list/detail pages
6. Watch the company health dashboard for:
   - heap growth
   - tenant DB cache growth
   - low cache hit rates
   - Redis temporary outage flags

## Next recommended work

1. Add background jobs for notification fan-out, due-soon reminders, and heavy aggregation work.
2. Push more student read traffic onto dedicated runtime-friendly storage paths where possible.
3. Add production load-gate targets for course, diary, and notifications in the same style as the existing online test tooling.

## Must-fix before we can claim 100k

1. Cross-instance live notification delivery
   - Student notification streams must work correctly across horizontally scaled app instances, not only inside one process.
   - Status: in progress. Redis-backed change signaling has now been added to the student notification stream path.

2. Durable background work beyond in-app workers
   - Status: code path upgraded.
   - Student notifications and report dispatch now enqueue into Redis-backed partition queues first, then run through worker routes with Mongo claim fallback.
   - Remaining launch work: run the workers on dedicated infra capacity and alert on queue lag/backlog, not only on app errors.

3. Production-level traffic isolation
   - Status: code path upgraded.
   - `APP_SERVICE_MODE=full|student|staff` plus `STUDENT_APP_ORIGIN` and `STAFF_APP_ORIGIN` now let middleware redirect or reject wrong-surface traffic before it burns capacity.
   - Remaining launch work: actually deploy the student and staff surfaces on separate scaling pools and verify auth/session behavior across both origins.

4. Load-proof, not just code-proof
   - Status: code path upgraded.
   - There is now a real learning-content readiness seed, cleanup, raw stress harness, and gated load wrapper with p95/p99 thresholds and persistence audits.
   - Remaining launch work: run the gate against production-like infrastructure and save the resulting latency/error baselines before claiming 100k readiness.
