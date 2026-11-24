// Pure header projection for the isolated mock OAuth gateway. Input is Node's
// lowercased incoming-header map. Only MCP routing bindings cross this boundary;
// the trusted in-process caller supplies the upstream's separate bearer token.
// Missing bindings remain missing for the existing upstream verifier to reject.
// No network, identity verification, credential lookup or tool authorization.
const routing = Object.freeze({
  'mcp-protocol-version':/^\d{4}-\d{2}-\d{2}$/,
  'mcp-method':/^[A-Za-z][A-Za-z0-9_/-]{0,63}$/,
  'mcp-name':/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
});

export function buildMockMcpUpstreamHeaders(incomingHeaders, upstreamToken) {
  if (!incomingHeaders || typeof incomingHeaders !== 'object' || Array.isArray(incomingHeaders) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(incomingHeaders)) ||
      typeof upstreamToken !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(upstreamToken))
    throw Error('INVALID_MCP_UPSTREAM_HEADERS');
  const headers = {'content-type':'application/json',authorization:'Bearer '+upstreamToken};
  for (const [name, pattern] of Object.entries(routing)) {
    const field = Object.getOwnPropertyDescriptor(incomingHeaders,name);
    if (!field) continue;
    if (!Object.hasOwn(field,'value') || !field.enumerable ||
        typeof field.value !== 'string' || !pattern.test(field.value))
      throw Error('INVALID_MCP_UPSTREAM_HEADERS');
    headers[name] = field.value;
  }
  return Object.freeze(headers);
}
