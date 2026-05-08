const fs = require('fs');
const path = require('path');

function loadPolicy(policyPath = process.env.RODEO_POLICY_PATH || path.join(__dirname, 'policy.json')) {
  const resolved = path.resolve(process.cwd(), policyPath);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function assertAllowed(action, endpoint, policy = loadPolicy()) {
  if (!policy.allowedActions.includes(action)) {
    throw new Error(`Action denied by policy: ${action}`);
  }

  if (policy.deniedActions.includes(action)) {
    throw new Error(`Action explicitly denied by policy: ${action}`);
  }

  const match = policy.endpoints.allow.find((entry) => (
    entry.action === action
    && entry.method === endpoint.method
    && entry.path === endpoint.path
  ));

  if (!match) {
    throw new Error(`Endpoint denied by policy: ${endpoint.method} ${endpoint.path}`);
  }

  return true;
}

function redactSecrets(value) {
  if (typeof value === 'string') {
    return value
      .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]')
      .replace(/(password["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]')
      .replace(/(token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]');
  }

  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/api[_-]?key|password|token|secret/i.test(key)) {
      return '[REDACTED]';
    }
    return item;
  }));
}

function logAction(action, payload, result = 'pending') {
  const logPath = process.env.RODEO_INTEGRATION_LOG || path.join(__dirname, 'logs', 'rodeo-ia.log');
  const resolved = path.resolve(process.cwd(), logPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const line = JSON.stringify({
    at: new Date().toISOString(),
    action,
    result,
    payload: redactSecrets(payload),
  });
  fs.appendFileSync(resolved, `${line}\n`, 'utf8');
}

module.exports = {
  assertAllowed,
  loadPolicy,
  logAction,
  redactSecrets,
};
