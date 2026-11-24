// Offline, review-only Access signing-key lifecycle. No fetch, file access,
// timers, credential changes, token issuance, listeners or runtime dispatch.
// The factory, clock and publish capability belong to a trusted in-process
// owner, never an HTTP/MCP caller. Data descriptors are checked before reading;
// arbitrary same-process Proxies and hostile trusted callbacks are out of scope.
// Checkpoints preserve complete state but do NOT establish key-source provenance
// or durable anti-rollback storage. A trusted owner must bind their exact bytes
// to its latest durable revision; a hash beside an untrusted file is insufficient.
// Restore always holds for fresh publication. fork() is an in-process staging
// capability, not persistence, authorization or a resource-side ownership fence.
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
const checkpointSchema = 'api1-access-keyset-checkpoint-v1';
const checkpointLimit = 128 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/;
const checkpointKeys = ['schema','policySha256','generation','observedAt','freshUntil','lastClock','history'];
const anchorKeys = ['revision','sha256','generationFloor','lastClockFloorSeconds'];
const digest = text => createHash('sha256').update(text).digest('hex');

// Inspect the small envelope before traversing history. The P2-A data copier's
// 512-node budget is deliberately unchanged: each history entry is copied and
// validated separately, with a cumulative bound on the complete JSON encoding.
function dataFields(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error('data');
  const names = Reflect.ownKeys(value), out = Object.create(null);
  if (names.length > allowed.length) throw Error('data');
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value,name);
    if (typeof name !== 'string' || !allowed.includes(name) ||
        !Object.hasOwn(descriptor,'value') || !descriptor.enumerable) throw Error('data');
    out[name] = descriptor.value;
  }
  if (required.some(name => !Object.hasOwn(out,name))) throw Error('data');
  return out;
}
function canonicalJwk(key) {
  const out = {};
  for (const name of ['kid','kty','n','e','alg','use','key_ops']) {
    if (Object.hasOwn(key,name)) out[name] = name === 'key_ops' ? Object.freeze([...key[name]]) : key[name];
  }
  return Object.freeze(out);
}
function checkpointOf(policySha256, {generation,observedAt,freshUntil,lastClock,history}) {
  const entries = [...history.values()].sort((a,b) => a.jwk.kid < b.jwk.kid ? -1 : a.jwk.kid > b.jwk.kid ? 1 : 0)
    .map(entry => Object.freeze({jwk:canonicalJwk(entry.jwk),fingerprint:entry.fingerprint,state:entry.state,
      ...(Object.hasOwn(entry,'retireAt') ? {retireAt:entry.retireAt} : {})}));
  const checkpoint = Object.freeze({schema:checkpointSchema,policySha256,generation,observedAt,freshUntil,lastClock,
    history:Object.freeze(entries)});
  const serialized = JSON.stringify(checkpoint);
  if (Buffer.byteLength(serialized,'utf8') > checkpointLimit) throw Error('INVALID_LIFECYCLE_CHECKPOINT');
  return Object.freeze({checkpoint,sha256:digest(serialized)});
}

function lifecycleConfig(config) {
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
  const policySha256 = digest(JSON.stringify({...base,maxSnapshotAgeSeconds,maxOverlapSeconds,maxTrackedKeys}));
  return Object.freeze({base,clock,maxSnapshotAgeSeconds,maxOverlapSeconds,maxTrackedKeys,generationFloor,policySha256});
}

export function createAccessKeysetLifecycle(config) {
  return lifecycle(lifecycleConfig(config));
}

// Constructor-only trusted-owner import. revision belongs to the external
// store's CAS protocol, not the keyset generation. This codec validates the
// supplied anchor but cannot prove that it names the latest durable state.
// null clock floor means no independent floor; the saved lastClock still holds.
export function restoreAccessKeysetLifecycle(config, checkpoint, trustedAnchor) {
  const settings = lifecycleConfig(config);
  const {base,maxSnapshotAgeSeconds,maxOverlapSeconds,maxTrackedKeys,policySha256} = settings;
  let restored;
  try {
    const anchor = copyData(dataFields(trustedAnchor,anchorKeys),anchorKeys);
    if (!integer(anchor.revision) || !sha256Pattern.test(anchor.sha256) ||
        !integer(anchor.generationFloor) || (anchor.lastClockFloorSeconds !== null &&
        !integer(anchor.lastClockFloorSeconds))) throw Error('anchor');
    const fields = dataFields(checkpoint,checkpointKeys);
    const header = copyData(Object.fromEntries(checkpointKeys.filter(name => name !== 'history')
      .map(name => [name,fields[name]])));
    if (header.schema !== checkpointSchema || header.policySha256 !== policySha256 ||
        !integer(header.generation) || header.generation < settings.generationFloor ||
        header.generation < anchor.generationFloor ||
        ![header.observedAt,header.freshUntil,header.lastClock].every(value => value === null || integer(value)) ||
        (header.observedAt === null) !== (header.freshUntil === null) ||
        (anchor.lastClockFloorSeconds !== null && (header.lastClock === null ||
          header.lastClock < anchor.lastClockFloorSeconds))) throw Error('header');
    if (header.observedAt !== null && (header.generation === 0 || header.lastClock === null ||
        header.observedAt > header.lastClock ||
        !Number.isSafeInteger(header.observedAt + maxSnapshotAgeSeconds) ||
        header.freshUntil !== header.observedAt + maxSnapshotAgeSeconds)) throw Error('time');
    const rawHistory = fields.history;
    if (!Array.isArray(rawHistory) || Object.getPrototypeOf(rawHistory) !== Array.prototype ||
        rawHistory.length > maxTrackedKeys || Reflect.ownKeys(rawHistory).length !== rawHistory.length + 1 ||
        (header.observedAt === null && rawHistory.length !== 0)) throw Error('history');
    const history = new Map(), materials = new Set(), copiedEntries = [];
    let bytes = Buffer.byteLength(JSON.stringify({...header,history:[]}),'utf8'), acceptedCount = 0;
    for (let i = 0; i < rawHistory.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(rawHistory,String(i));
      if (!descriptor || !Object.hasOwn(descriptor,'value') || !descriptor.enumerable) throw Error('entry');
      const entry = copyData(dataFields(descriptor.value,['jwk','fingerprint','state','retireAt'],
        ['jwk','fingerprint','state']));
      bytes += Buffer.byteLength(JSON.stringify(entry),'utf8') + (i ? 1 : 0);
      if (bytes > checkpointLimit) throw Error('size');
      createTrustedIngress({...base,publicJwks:[entry.jwk],clock:()=>0});
      const hash = fingerprint(entry.jwk), hasDeadline = Object.hasOwn(entry,'retireAt');
      if (entry.fingerprint !== hash || history.has(entry.jwk.kid) || materials.has(hash) ||
          !['active','retiring','revoked'].includes(entry.state) ||
          (entry.state === 'active' && hasDeadline) || (entry.state === 'retiring' && !hasDeadline) ||
          (hasDeadline && (!integer(entry.retireAt) || entry.retireAt > header.freshUntil ||
            entry.retireAt - header.lastClock > maxOverlapSeconds))) throw Error('entry');
      if (entry.state === 'active' || (entry.state === 'retiring' && header.lastClock < entry.retireAt)) acceptedCount++;
      history.set(entry.jwk.kid,Object.freeze({...entry,jwk:canonicalJwk(entry.jwk)}));
      materials.add(hash);
      copiedEntries.push(entry);
    }
    if (acceptedCount > 4) throw Error('key limit');
    restored = {...header,history,recoveryHold:true};
    const exported = checkpointOf(policySha256,restored);
    // Require the canonical export representation as well as its pinned hash.
    // Only copied data reaches JSON.stringify: no caller toJSON/accessor runs.
    const copied = Object.fromEntries(Object.keys(fields).map(name => [name,
      name === 'history' ? copiedEntries : header[name]]));
    if (exported.sha256 !== anchor.sha256 || JSON.stringify(copied) !== JSON.stringify(exported.checkpoint))
      throw Error('digest');
  } catch { throw Error('INVALID_LIFECYCLE_CHECKPOINT'); }
  return lifecycle(settings,restored);
}

function lifecycle(settings, initial) {
  const {base,clock,maxSnapshotAgeSeconds,maxOverlapSeconds,maxTrackedKeys,generationFloor,policySha256} = settings;

  let generation = initial?.generation ?? generationFloor, observedAt = initial?.observedAt ?? null,
    freshUntil = initial?.freshUntil ?? null, lastClock = initial?.lastClock ?? null,
    recoveryHold = initial?.recoveryHold ?? false;
  // Retired and revoked entries stay in history so neither kid reuse nor a new
  // label for old key material can silently revive trust in this instance.
  let history = new Map(initial?.history);
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
    if (recoveryHold) return 'RESTORED_AWAITING_PUBLICATION';
    if (freshUntil === null) return 'KEYSET_MISSING';
    if (now >= freshUntil) return 'KEYSET_STALE';
    if (selectedKeys(now).length === 0) return 'KEYSET_EMPTY';
    return null;
  }

  return Object.freeze({
    exportCheckpoint() {
      return checkpointOf(policySha256,{generation,observedAt,freshUntil,lastClock,history});
    },
    fork() {
      // No JSON import or clock read. Immutable key data may be shared, while
      // the map and all mutable scalar state belong exclusively to the fork.
      return lifecycle(settings,{generation,observedAt,freshUntil,lastClock,history,recoveryHold});
    },
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
        recoveryHold = false;
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
