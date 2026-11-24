// API1 P1 — pure, deny-by-default MCP request-shape and assertion policy.
// Deliberately NEVER authorizes dispatch: trusted ingress and Phase3 runtime
// fencing are future, separately approved integration work.
import {verifyAccessAssertion} from './access-assertion-verifier.mjs';

const TOOL = 'browser_automate_wikipedia_demo';
const MODERN = '2026-07-28', LEGACY = '2025-06-18';
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const exact = (obj, allowed) => Object.keys(obj).every(k => allowed.includes(k));
const validId = x => (typeof x === 'string' && x.length >= 1 && x.length <= 64) ||
  (Number.isSafeInteger(x) && x >= 0);
const decision = (kind, reason, method = null) => Object.freeze({
  decision: kind, reason, method, tool: method === 'tools/call' ? TOOL : null,
  admissionAuthorized: false, executionAuthorized: false,
  requiresTrustedIngress: true, requiresExternalOwnershipFence: true
});
const deny = reason => decision('DENY', reason);

export function assessAuthorizedMcpRequest(input = {}) {
  try {
    if (!record(input)) return deny('INVALID_REQUEST');
    const {assertion, verifierConfig, method, path, headers, rpc} = input;
    // Never accept a caller-supplied "identity" instead of a verified JWT.
    if (Object.hasOwn(input, 'identity') || !record(verifierConfig)) return deny('IDENTITY_PROOF_REQUIRED');
    const verified = verifyAccessAssertion({...verifierConfig, assertion});
    if (verified.decision !== 'ALLOW') return deny('ACCESS_ASSERTION_DENIED');
    if (method !== 'POST' || path !== '/mcp' || !record(headers) || !record(rpc))
      return deny('INVALID_REQUEST');
    if (!Object.keys(headers).every(k => k === k.toLowerCase() &&
      typeof headers[k] === 'string' && headers[k].length <= 2048)) return deny('INVALID_HEADERS');
    if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers['content-type'] ?? ''))
      return deny('INVALID_CONTENT_TYPE');
    // The only allowed RPC is the exact bounded local MCP surface, not arbitrary JSON-RPC.
    if (Buffer.byteLength(JSON.stringify(rpc), 'utf8') > 4096 ||
      rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string' ||
      !exact(rpc, ['jsonrpc','id','method','params'])) return deny('INVALID_RPC');
    const notify = rpc.method === 'notifications/initialized';
    if (notify ? Object.hasOwn(rpc, 'id') : !validId(rpc.id)) return deny('INVALID_ID');
    const p = rpc.params;
    if (p !== undefined && !record(p)) return deny('INVALID_PARAMS');
    const meta = p?._meta;
    if (meta !== undefined && !record(meta)) return deny('INVALID_METADATA');
    const version = meta?.['io.modelcontextprotocol/protocolVersion'];
    if (version !== undefined && version !== MODERN && version !== LEGACY)
      return deny('UNSUPPORTED_PROTOCOL');
    const modern = rpc.method === 'server/discover' || version === MODERN;
    if (modern) {
      if (!record(meta) || version !== MODERN ||
        !record(meta['io.modelcontextprotocol/clientCapabilities']) ||
        headers['mcp-protocol-version'] !== MODERN || headers['mcp-method'] !== rpc.method ||
        (rpc.method === 'tools/call' ? headers['mcp-name'] !== TOOL : Object.hasOwn(headers, 'mcp-name')))
        return deny('INVALID_MODERN_BINDING');
    } else if (['mcp-protocol-version','mcp-method','mcp-name'].some(k => Object.hasOwn(headers,k))) {
      return deny('UNEXPECTED_PROTOCOL_HEADERS');
    }
    if (notify || rpc.method === 'ping' || rpc.method === 'tools/list' ||
      rpc.method === 'server/discover') {
      if (p !== undefined && !exact(p, ['_meta'])) return deny('UNEXPECTED_PARAMS');
    } else if (rpc.method === 'initialize') {
      if (modern || (p !== undefined && !exact(p, ['protocolVersion','capabilities','clientInfo'])))
        return deny('INVALID_INITIALIZE');
      if (p?.protocolVersion !== undefined && p.protocolVersion !== LEGACY)
        return deny('UNSUPPORTED_PROTOCOL');
    } else if (rpc.method === 'tools/call') {
      if (!record(p) || !exact(p, ['name','arguments',...(modern ? ['_meta'] : [])]) ||
        p.name !== TOOL || !record(p.arguments) ||
        Object.keys(p.arguments).length !== 1 ||
        !Object.hasOwn(p.arguments, 'query') ||
        typeof p.arguments.query !== 'string' ||
        p.arguments.query.length < 3 || p.arguments.query.length > 80 ||
        !/^[A-Za-z0-9 ,.'-]+$/.test(p.arguments.query)) return deny('TOOL_REFUSED');
    } else return deny('UNKNOWN_METHOD');
    // No pure P1 result is an operational allow signal, including initialize/list.
    return decision('STRUCTURE_REVIEWABLE', 'PENDING_TRUSTED_INGRESS_AND_RUNTIME_FENCE', rpc.method);
  } catch { return deny('INVALID_REQUEST'); }
}
