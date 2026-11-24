// API1 P2-A: sole composed review entry point; no operational authorization.
import {createPublicKey} from 'node:crypto';
import {verifyAccessAssertion} from './access-assertion-verifier.mjs';
import {assessAuthorizedMcpRequest} from './access-managed-oauth-policy.mjs';
import {parseSyntheticRequest, validateIngressConfig, copyData} from './access-trusted-ingress.mjs';

const result = (decision, reason) => Object.freeze({decision, reason,
  admissionAuthorized:false, executionAuthorized:false, trustedIngressVerified:false,
  requiresExternalOwnershipFence:true});

export function createTrustedIngress(config) {
  // Factory invocation itself is a trusted in-process composition operation.
  // Proxies and arbitrary same-process code are outside this synthetic contract.
  const c = copyData(config, ['issuer','audience','allowedSubjects','publicJwks','clock',
    'maxLifetimeSeconds','expectedHost','maxHeaderBytes','maxBodyBytes'], true);
  const {clock,issuer,audience,allowedSubjects,publicJwks,maxLifetimeSeconds=3600}=c;
  if(typeof clock!=='function' || typeof issuer!=='string' ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)) throw Error('INVALID_TRUST_CONFIG');
  const limits=validateIngressConfig(c);
  const snapshot=Object.freeze({issuer,audience,allowedSubjects,publicJwks,maxLifetimeSeconds});
  if(verifyAccessAssertion({...snapshot,nowSeconds:0}).reason!=='MISSING_ASSERTION') throw Error('INVALID_TRUST_CONFIG');
  for(const k of publicJwks) {
    if(typeof k.kid!=='string' || !/^[A-Za-z0-9._-]{1,128}$/.test(k.kid) ||
      !/^[A-Za-z0-9_-]+$/.test(k.n) || Buffer.from(k.n,'base64url').toString('base64url')!==k.n ||
      Buffer.from(k.n,'base64url')[0]===0) throw Error('INVALID_TRUST_CONFIG');
    const modulus=BigInt('0x'+Buffer.from(k.n,'base64url').toString('hex'));
    if((modulus & 1n)===0n || [3n,5n,7n,11n,13n,17n,19n,65537n].some(p=>modulus%p===0n))
      throw Error('INVALID_TRUST_CONFIG');
    const key=createPublicKey({key:{kty:'RSA',n:k.n,e:k.e},format:'jwk'});
    const bits=key.asymmetricKeyDetails?.modulusLength;
    if(key.asymmetricKeyType!=='rsa' || !Number.isInteger(bits) || bits<2048 || bits>4096 ||
      key.asymmetricKeyDetails?.publicExponent!==65537n) throw Error('INVALID_TRUST_CONFIG');
  }
  return Object.freeze({assess(request) {
    try {
      const normalized=parseSyntheticRequest(request,limits);
      const nowSeconds=clock();
      const r=assessAuthorizedMcpRequest({...normalized,verifierConfig:{...snapshot,nowSeconds}});
      if(r.decision!=='STRUCTURE_REVIEWABLE') return result('DENY','REQUEST_DENIED');
      return result('STRUCTURE_REVIEWABLE','OFFLINE_BOUNDARY_ONLY');
    } catch { return result('DENY','REQUEST_DENIED'); }
  }});
}
