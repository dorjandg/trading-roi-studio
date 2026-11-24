// API1 P1 — offline, deterministic Cloudflare Access assertion verification.
// No JWKS fetch, clock reads, network, credentials, file access, or runtime use.
// Caller supplies a pinned, public-key snapshot and an explicit clock.
// Not a deployed authentication implementation; key lifecycle remains unverified.
import {constants, createPublicKey, verify as verifySignature} from 'node:crypto';

const utf8 = new TextDecoder('utf-8', {fatal: true});
const tokenPart = /^[A-Za-z0-9_-]+$/;
const kidPattern = /^[A-Za-z0-9._-]{1,128}$/;
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const string = (x, max = 512) => typeof x === 'string' && x.length > 0 && x.length <= max;
const deny = reason => Object.freeze({decision: 'DENY', reason, verified: false, executionAuthorized: false});

function parsePart(part) {
  if (!string(part, 11000) || !tokenPart.test(part) || part.length % 4 === 1) throw Error('bad segment');
  const bytes = Buffer.from(part, 'base64url');
  if (!bytes.length || bytes.toString('base64url') !== part || bytes.length > 8192) throw Error('bad encoding');
  return bytes;
}
function parseObject(part) {
  const parsed = JSON.parse(utf8.decode(parsePart(part)));
  if (!record(parsed)) throw Error('not object');
  return parsed;
}
function issuerUrl(value) {
  if (!string(value, 256)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      !u.search && !u.hash && u.pathname === '/' && value === u.origin;
  } catch { return false; }
}
function validPublicKey(jwk) {
  return record(jwk) && kidPattern.test(jwk.kid ?? '') && jwk.kty === 'RSA' &&
    string(jwk.n, 2048) && jwk.e === 'AQAB' &&
    (jwk.alg === undefined || jwk.alg === 'RS256') &&
    (jwk.use === undefined || jwk.use === 'sig') &&
    (jwk.key_ops === undefined || (Array.isArray(jwk.key_ops) &&
      jwk.key_ops.length === 1 && jwk.key_ops[0] === 'verify')) &&
    Object.keys(jwk).every(k => ['kid','kty','n','e','alg','use','key_ops'].includes(k));
}

export function verifyAccessAssertion(input = {}) {
  try {
    if (!record(input)) return deny('INVALID_CONFIG');
    const {assertion, issuer, audience, publicJwks, allowedSubjects,
      nowSeconds, maxLifetimeSeconds = 3600} = input;
    if (!issuerUrl(issuer) || !string(audience, 256) ||
      !Array.isArray(publicJwks) || publicJwks.length < 1 || publicJwks.length > 4 ||
      publicJwks.some(k => !validPublicKey(k)) ||
      new Set(publicJwks.map(k => k.kid)).size !== publicJwks.length ||
      !Array.isArray(allowedSubjects) || allowedSubjects.length !== 1 ||
      !string(allowedSubjects[0], 256) ||
      !Number.isSafeInteger(nowSeconds) || nowSeconds < 0 ||
      !Number.isSafeInteger(maxLifetimeSeconds) ||
      maxLifetimeSeconds < 60 || maxLifetimeSeconds > 3600) return deny('INVALID_CONFIG');
    if (!string(assertion, 12000)) return deny('MISSING_ASSERTION');
    const segments = assertion.split('.');
    if (segments.length !== 3) return deny('MALFORMED_ASSERTION');
    const [h, p, s] = segments;
    const header = parseObject(h), claims = parseObject(p), signature = parsePart(s);
    if (Object.keys(header).sort().join(',') !== 'alg,kid,typ' ||
      header.alg !== 'RS256' || header.typ !== 'JWT' ||
      !kidPattern.test(header.kid ?? '')) return deny('MALFORMED_ASSERTION');
    const matching = publicJwks.find(jwk => jwk.kid === header.kid);
    if (!matching) return deny('UNTRUSTED_SIGNING_KEY');
    const key = createPublicKey({key: {kty: 'RSA', n: matching.n, e: matching.e}, format: 'jwk'});
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
      return deny('UNTRUSTED_SIGNING_KEY');
    if (!verifySignature('RSA-SHA256', Buffer.from(h + '.' + p, 'ascii'),
      {key, padding: constants.RSA_PKCS1_PADDING}, signature)) return deny('SIGNATURE_REJECTED');
    // Require exactly this one application audience; refuse broader multi-app assertions.
    if (claims.iss !== issuer || !Array.isArray(claims.aud) ||
      claims.aud.length !== 1 || claims.aud[0] !== audience ||
      claims.type !== 'app' || !string(claims.sub, 256) ||
      Object.hasOwn(claims, 'common_name') || Object.hasOwn(claims, 'service_token_id') ||
      Object.hasOwn(claims, 'service_token_status') ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.nbf) ||
      !Number.isSafeInteger(claims.exp) || claims.iat > nowSeconds + 30 ||
      claims.nbf > nowSeconds || claims.nbf < claims.iat - 30 ||
      claims.exp <= nowSeconds || claims.exp <= claims.iat ||
      claims.exp - claims.iat > maxLifetimeSeconds)
      return deny('INVALID_CLAIMS');
    if (claims.sub !== allowedSubjects[0]) return deny('UNAUTHORIZED_SUBJECT');
    const identity = Object.freeze({subject: claims.sub, issuer, audience, expiresAt: claims.exp});
    return Object.freeze({decision: 'ALLOW', reason: 'ACCESS_ASSERTION_VERIFIED',
      verified: true, identity, executionAuthorized: false});
  } catch { return deny('MALFORMED_ASSERTION'); }
}
