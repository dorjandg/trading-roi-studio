// Offline, review-only Access signing-key lifecycle. No fetch, file access,
// timers, credential changes, token issuance, listeners or runtime dispatch.
// The factory, clock and publish capability belong to a trusted in-process
// owner, never an HTTP/MCP caller. Data descriptors are checked before reading;
// arbitrary same-process Proxies and hostile trusted callbacks are out of scope.
// This in-memory controller does NOT prove key-source provenance or persist a
// rollback floor/tombstones across restarts. Both remain runtime release gates.
// Defaults: freshness 300 s; overlap min(300 s, assertion lifetime); 64 lifetime
// key identities. Freshness is bounded to 1..3600 s, overlap to 0..lifetime,
// history to 4..64 identities, and simultaneous accepted keys to P2-A's four.
import {createHash} from 'node:crypto';
import {createTrustedIngress} from './access-identity-boundary.mjs';
import {copyData, validateIngressConfig} from './access-trusted-ingress.mjs';

const kidPattern = /^[A-Za-z0-9._-]{1,128}$/;
const integer = n => Number.isSafeInteger(n) && n >= 0;
const boundedText = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const fingerprint = key => createHash('sha256')
  .update(JSON.stringify({e:key.e,kty:key.kty,n:key.n})).digest('hex');
const result = (decision, reason, detail = {}) => Object.freeze({
  decision, reason, ...detail, admissionAuthorized:false, executionAuthorized:false,
  trustedIngressVerified:false, keyLifecycleRuntimeVerified:false,
  requiresTrustedKeySource:true, requiresDurableGenerationFloor:true,
  requiresExternalOwnershipFence:true
});
const denied = reason => result('DENY', reason);

export function createAccessKeysetLifecycle(config) {
  let c, base, clock, maxSnapshotAgeSeconds, maxOverlapSeconds, maxTrackedKeys, generationFloor;
  try {
    c = copyData(config, ['issuer','audience','allowedSubjects','expectedHost','clock',
      'maxLifetimeSeconds','maxHeaderBytes','maxBodyBytes','maxSnapshotAgeSeconds',
      'maxOverlapSeconds','maxTrackedKeys','generationFloor'], true);
    clock = c.clock;
    const {maxLifetimeSeconds = 3600} = c;
    maxSnapshotAgeSeconds = c.maxSnapshotAgeSeconds === undefined ? 300 : c.maxSnapshotAgeSeconds;
    maxOverlapSeconds = c.maxOverlapSeconds === undefined ? Math.min(300, maxLifetimeSeconds) : c.maxOverlapSeconds;
    maxTrackedKeys = c.maxTrackedKeys === undefined ? 64 : c.maxTrackedKeys;
    generationFloor = c.generationFloor === undefined ? 0 : c.generationFloor;
    if (typeof clock !== 'function' || typeof c.issuer !== 'string' ||
        !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(c.issuer) ||
        c.issuer.length > 256 || !boundedText(c.audience) ||
        !Array.isArray(c.allowedSubjects) || c.allowedSubjects.length !== 1 ||
        !boundedText(c.allowedSubjects[0]) || !integer(maxLifetimeSeconds) ||
        maxLifetimeSeconds < 60 || maxLifetimeSeconds > 3600 ||
        !integer(maxSnapshotAgeSeconds) || maxSnapshotAgeSeconds < 1 || maxSnapshotAgeSeconds > 3600 ||
        !integer(maxOverlapSeconds) || maxOverlapSeconds > maxLifetimeSeconds ||
        !integer(maxTrackedKeys) || maxTrackedKeys < 4 || maxTrackedKeys > 64 ||
        !integer(generationFloor)) throw Error('config');
    base = Object.freeze({issuer:c.issuer,audience:c.audience,
      allowedSubjects:c.allowedSubjects,maxLifetimeSeconds,...validateIngressConfig(c)});
  } catch { throw Error('INVALID_LIFECYCLE_CONFIG'); }

  let generation = generationFloor, observedAt = null, freshUntil = null, lastClock = null;
  // Retired and revoked entries stay in history so neither kid reuse nor a new
  // label for old key material can silently revive trust in this instance.
  let history = new Map();
  function readClock() {
    const now = clock();
    if (!integer(now) || (lastClock !== null && now < lastClock)) throw Error('clock');
    lastClock = now;
    return now;
  }
  function selectedKeys(now) {
    return [...history.values()].filter(entry => entry.state === 'active' ||
      (entry.state === 'retiring' && now < entry.retireAt)).map(entry => entry.jwk);
  }
  function freshnessReason(now) {
    if (freshUntil === null) return 'KEYSET_MISSING';
    if (now >= freshUntil) return 'KEYSET_STALE';
    if (selectedKeys(now).length === 0) return 'KEYSET_EMPTY';
    return null;
  }

  return Object.freeze({
    publish(update) {
      let now;
      try { now = readClock(); } catch { return denied('CLOCK_REJECTED'); }
      try {
        const next = copyData(update, ['generation','observedAtSeconds','publicJwks','revokedKids']);
        const keys = next.publicJwks, revoked = next.revokedKids;
        if (!integer(next.generation) || next.generation <= generation)
          return denied('GENERATION_NOT_ADVANCING');
        if (!integer(next.observedAtSeconds) || next.observedAtSeconds > now ||
            now - next.observedAtSeconds >= maxSnapshotAgeSeconds ||
            !Number.isSafeInteger(next.observedAtSeconds + maxSnapshotAgeSeconds) ||
            !Number.isSafeInteger(now + maxOverlapSeconds)) return denied('SNAPSHOT_NOT_FRESH');
        if (observedAt !== null && next.observedAtSeconds < observedAt)
          return denied('SNAPSHOT_TIME_REVERSED');
        if (!Array.isArray(keys) || keys.length > 4 || !Array.isArray(revoked) ||
            revoked.length > maxTrackedKeys || revoked.some(kid => typeof kid !== 'string' || !kidPattern.test(kid)) ||
            new Set(revoked).size !== revoked.length) return denied('INVALID_SNAPSHOT');
        // Reuse all P2-A key validation, including canonical RSA modulus checks.
        if (keys.length) createTrustedIngress({...base,publicJwks:keys,clock:()=>now});
        const incoming = new Map(), material = new Map();
        for (const key of keys) {
          const hash = fingerprint(key), old = history.get(key.kid);
          if (material.has(hash)) return denied('KEY_MATERIAL_REUSED');
          if (old && old.fingerprint !== hash) return denied('KEY_ID_REUSED');
          if (old && old.state !== 'active') return denied('KEY_RETIRED_OR_REVOKED');
          for (const [knownKid, entry] of history) {
            if (knownKid !== key.kid && entry.fingerprint === hash)
              return denied('KEY_MATERIAL_REUSED');
          }
          incoming.set(key.kid, {jwk:key,fingerprint:hash,state:'active'});
          material.set(hash,key.kid);
        }
        // A revocation must name an already known key and cannot simultaneously
        // declare it active. It persists even if later publications omit it.
        for (const kid of revoked) {
          if (!history.has(kid) || incoming.has(kid)) return denied('INVALID_REVOCATION');
        }
        const candidate = new Map(history), revokedSet = new Set(revoked);
        for (const [kid, entry] of history) {
          if (revokedSet.has(kid)) {
            candidate.set(kid, {...entry,state:'revoked'});
          } else if (entry.state === 'active' && !incoming.has(kid)) {
            // No refresh may extend this deadline. A stale former snapshot has
            // no overlap at all; removed keys cannot regain active status.
            candidate.set(kid, {...entry,state:'retiring',
              retireAt:Math.min(now + maxOverlapSeconds, freshUntil ?? now)});
          }
        }
        for (const [kid, entry] of incoming) candidate.set(kid, entry);
        if (candidate.size > maxTrackedKeys) return denied('KEY_HISTORY_LIMIT');
        const acceptedCount = [...candidate.values()].filter(entry => entry.state === 'active' ||
          (entry.state === 'retiring' && now < entry.retireAt)).length;
        if (acceptedCount > 4) return denied('KEYSET_LIMIT');
        // Commit only after the entire candidate is checked. No await or
        // external effect occurs between validation and this state transition.
        history = candidate;
        generation = next.generation;
        observedAt = next.observedAtSeconds;
        freshUntil = observedAt + maxSnapshotAgeSeconds;
        return result('STRUCTURE_REVIEWABLE','KEYSET_PUBLISHED_OFFLINE',{generation});
      } catch { return denied('INVALID_SNAPSHOT'); }
    },
    assess(request) {
      let now;
      try { now = readClock(); } catch { return denied('CLOCK_REJECTED'); }
      const reason = freshnessReason(now);
      if (reason) return denied(reason);
      try {
        // Time is captured once from the trusted clock, never from the request.
        const boundary = createTrustedIngress({...base,publicJwks:selectedKeys(now),clock:()=>now});
        if (boundary.assess(request).decision !== 'STRUCTURE_REVIEWABLE') return denied('REQUEST_DENIED');
        return result('STRUCTURE_REVIEWABLE','OFFLINE_KEYSET_BOUNDARY_ONLY');
      } catch { return denied('REQUEST_DENIED'); }
    },
    status() {
      let now;
      try { now = readClock(); } catch { return denied('CLOCK_REJECTED'); }
      const reason = freshnessReason(now);
      return result(reason ? 'HOLD' : 'STRUCTURE_REVIEWABLE', reason ?? 'KEYSET_FRESH', {
        generation,
        activeKeyCount:[...history.values()].filter(entry => entry.state === 'active').length,
        retiringKeyCount:[...history.values()].filter(entry => entry.state === 'retiring' && now < entry.retireAt).length,
        revokedKeyCount:[...history.values()].filter(entry => entry.state === 'revoked').length
      });
    }
  });
}
