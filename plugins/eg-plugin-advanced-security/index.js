'use strict';

const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const get = require('lodash.get');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const crypto = require('crypto');
const micromatch = require('micromatch');
const fs = require('fs');
const path = require('path');

function parseOrigins(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function methodAllowed(method, methods) {
  if (!methods || !methods.length) return true;
  return methods.includes(method.toUpperCase());
}

module.exports = {
  version: '1.0.0',
  policies: [
    {
      name: 'headers-security',
      policy: (actionParams) => {
        const {
          hsts = true,
          hstsMaxAge = 31536000,
          noSniff = true,
          frameOptions = 'DENY',
          referrerPolicy = 'no-referrer'
        } = actionParams || {};
        return (req, res, next) => {
          if (hsts && req.secure) {
            res.setHeader('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains`);
          }
          if (noSniff) res.setHeader('X-Content-Type-Options', 'nosniff');
          if (frameOptions) res.setHeader('X-Frame-Options', frameOptions);
          if (referrerPolicy) res.setHeader('Referrer-Policy', referrerPolicy);
          res.setHeader('X-DNS-Prefetch-Control', 'off');
          return next();
        };
      }
    },
    {
      name: 'request-size-limit',
      policy: (actionParams) => {
        const maxBytes = Number(actionParams && actionParams.maxBytes) || 1048576;
        return (req, res, next) => {
          const cl = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null;
          if (cl && cl > maxBytes) {
            res.statusCode = 413;
            return res.end('Payload Too Large');
          }
          let total = 0;
          req.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
              res.statusCode = 413;
              res.end('Payload Too Large');
              req.destroy();
            }
          });
          return next();
        };
      }
    },
    {
      name: 'origin-guard',
      policy: (actionParams) => {
        const allowed = parseOrigins(actionParams && actionParams.allowedOrigins);
        const enforceOn = (actionParams && actionParams.enforceOnMethods || ['POST','PUT','PATCH','DELETE']).map(m => m.toUpperCase());
        const allowNoOrigin = actionParams && typeof actionParams.allowNoOrigin === 'boolean' ? actionParams.allowNoOrigin : true;
        return (req, res, next) => {
          if (!enforceOn.includes(req.method.toUpperCase())) return next();
          const origin = req.headers.origin || '';
          const referer = req.headers.referer || '';
          // If no Origin/Referer and allowed to skip (native apps), pass through
          if (!origin && !referer && allowNoOrigin) return next();
          const ok = !allowed.length || allowed.includes(origin) || allowed.some(a => referer.startsWith(a));
          if (!ok) {
            res.statusCode = 403;
            return res.end('Forbidden: Invalid origin');
          }
          return next();
        };
      }
    },
    {
      name: 'verify-jwt',
      policy: (actionParams) => {
        const {
          jwksUri,
          issuer,
          audience,
          algorithms = ['RS256'],
          required = true,
          clockToleranceSec = 60,
          secretOrPublicKey,
          attachUser = true
        } = actionParams || {};

        let getKey = null;

        if (jwksUri) {
          const client = jwksRsa({
            jwksUri,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 10 * 60 * 1000,
            jwksRequestsPerMinute: 10,
            requestHeaders: {}
          });
          getKey = (header, callback) => {
            if (!header.kid) return callback(new Error('JWT missing kid header'));
            client.getSigningKey(header.kid).then(key => {
              const signingKey = key.getPublicKey();
              callback(null, signingKey);
            }).catch(err => callback(err));
          };
        }

        const verifyOptions = {
          algorithms,
          issuer,
          audience,
          clockTolerance: clockToleranceSec
        };

        return (req, res, next) => {
          const auth = req.headers.authorization || '';
          const token = auth.startsWith('Bearer ') ? auth.substring(7) : null;
          if (!token) {
            if (required) {
              res.statusCode = 401;
              return res.end('Unauthorized: Missing Bearer token');
            }
            return next();
          }

          const done = (err, decoded) => {
            if (err) {
              res.statusCode = 401;
              return res.end('Unauthorized: Invalid token');
            }
            req.user = decoded;
            req.egContext = req.egContext || {};
            req.egContext.jwt = decoded;
            if (attachUser) {
              req.egContext.rateKey = decoded.sub || decoded.client_id || req.ip;
            }
            return next();
          };

          if (getKey) {
            jwt.verify(token, getKey, verifyOptions, done);
          } else if (secretOrPublicKey) {
            jwt.verify(token, secretOrPublicKey, verifyOptions, done);
          } else {
            res.statusCode = 500;
            res.end('Server misconfiguration: No JWKS or public key configured');
          }
        };
      }
    },
    {
      name: 'enforce-scope',
      policy: (actionParams) => {
        const { rules = {}, scopeClaim = 'scope' } = actionParams || {};
        return (req, res, next) => {
          const method = req.method.toUpperCase();
          const requiredScopes = rules[method] || [];
          if (!requiredScopes.length) return next();

          const jwtPayload = (req.egContext && req.egContext.jwt) || req.user || {};
          let scopes = get(jwtPayload, scopeClaim);
          if (typeof scopes === 'string') scopes = scopes.split(' ').filter(Boolean);
          if (!Array.isArray(scopes)) scopes = [];

          const missing = requiredScopes.filter(s => !scopes.includes(s));
          if (missing.length) {
            res.statusCode = 403;
            return res.end('Forbidden: Insufficient scope');
          }
          return next();
        };
      }
    },
    {
      name: 'enforce-claims',
      policy: (actionParams) => {
        const { allOf = [], anyOf = [], onMethods = [] } = actionParams || {};
        return (req, res, next) => {
          if (onMethods.length && !onMethods.map(m => m.toUpperCase()).includes(req.method.toUpperCase())) {
            return next();
          }
          const jwtPayload = (req.egContext && req.egContext.jwt) || req.user || {};

          const checkRule = (rule) => {
            const val = get(jwtPayload, rule.path);
            if (Array.isArray(val)) {
              if (rule.includes) return val.includes(rule.includes);
              if (rule.matches) return micromatch(val, rule.matches).length > 0;
            } else if (typeof val === 'string') {
              if (rule.includes) return val === rule.includes;
              if (rule.matches) return micromatch.isMatch(val, rule.matches);
            } else if (typeof val === 'boolean') {
              if (typeof rule.equals === 'boolean') return val === rule.equals;
            }
            return false;
          };

          const allOk = allOf.every(checkRule);
          const anyOk = anyOf.length ? anyOf.some(checkRule) : true;

          if (!(allOk && anyOk)) {
            res.statusCode = 403;
            return res.end('Forbidden: Claim requirements not met');
          }
          return next();
        };
      }
    },
    {
      name: 'schema-validate',
      policy: (actionParams) => {
        const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: 'failing' });
        addFormats(ajv);
        const selector = (actionParams && actionParams.selector) || 'body';
        const methods = (actionParams && actionParams.when && actionParams.when.methods) || [];
        let validate = null;

        if (actionParams && actionParams.schema) {
          validate = ajv.compile(actionParams.schema);
        } else if (actionParams && actionParams.schemaPath) {
          const abs = path.resolve(process.cwd(), actionParams.schemaPath);
          const schema = JSON.parse(fs.readFileSync(abs, 'utf8'));
          validate = ajv.compile(schema);
        }

        return (req, res, next) => {
          if (methods.length && !methods.includes(req.method.toUpperCase())) return next();

          const data =
            selector === 'body' ? req.body :
            selector === 'query' ? req.query :
            selector === 'params' ? req.params :
            get(req, selector);

          if (!validate) return next();

          const ok = validate(data);
          if (!ok) {
            res.statusCode = 422;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Unprocessable Entity', details: validate.errors }));
          }
          return next();
        };
      }
    },
    {
      name: 'verify-hmac',
      policy: (actionParams) => {
        const headerName = (actionParams && actionParams.header) || 'x-signature';
        const algo = (actionParams && actionParams.algo) || 'sha256';
        const secretEnv = actionParams && actionParams.secretEnv;
        return (req, res, next) => {
          try {
            const sig = req.headers[headerName];
            if (!sig) {
              res.statusCode = 401;
              return res.end('Unauthorized: Missing signature');
            }
            const secret = process.env[secretEnv];
            if (!secret) {
              res.statusCode = 500;
              return res.end('Server misconfiguration: HMAC secret not set');
            }
            const chunks = [];
            req.on('data', (c) => chunks.push(Buffer.from(c)));
            req.on('end', () => {
              const body = Buffer.concat(chunks);
              const computed = crypto.createHmac(algo, secret).update(body).digest('hex');
              const presented = sig.replace(/^sha256=/i, '').trim();
              if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(presented))) {
                res.statusCode = 401;
                return res.end('Unauthorized: Invalid signature');
              }
              req.body = req.body || JSON.parse(body.toString() || '{}');
              next();
            });
          } catch (e) {
            res.statusCode = 400;
            return res.end('Bad Request: HMAC verification failed');
          }
        };
      }
    }
  ]
};