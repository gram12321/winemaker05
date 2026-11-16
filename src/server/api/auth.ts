import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** A verified account subject, never a value supplied in an API body. */
export type Authenticate = (authorization: string | undefined) => Promise<string | null>;

const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

/** Verify a Supabase access token with the supplied issuer and signing keys. */
export function createJwtAuthenticator(issuer: string, keys: JWTVerifyGetKey): Authenticate {
  const getKey: JWTVerifyGetKey = async (...args) => {
    try {
      return await keys(...args);
    } catch (error) {
      // An unknown key is an invalid credential. All other provider failures
      // (including network errors and a malformed JWKS) are service outages.
      if (error instanceof errors.JWKSNoMatchingKey) throw error;
      throw new Error('Authentication key service is unavailable.');
    }
  };
  return async (authorization) => {
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization ?? '');
    if (!match) return null;
    try {
      const { payload } = await jwtVerify(match[1], getKey, {
        issuer,
        audience: 'authenticated',
        algorithms: ALLOWED_ALGORITHMS,
        requiredClaims: ['sub', 'exp'],
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 512) return null;
      return payload.sub;
    } catch (error) {
      if (
        error instanceof errors.JOSEAlgNotAllowed ||
        error instanceof errors.JOSENotSupported ||
        error instanceof errors.JWSInvalid ||
        error instanceof errors.JWTInvalid ||
        error instanceof errors.JWSSignatureVerificationFailed ||
        error instanceof errors.JWTClaimValidationFailed ||
        error instanceof errors.JWTExpired ||
        error instanceof errors.JWKSNoMatchingKey
      ) return null;
      // Do not expose provider or verification errors to callers.
      throw new Error('Authentication service is unavailable.');
    }
  };
}

/** Configure the real remote JWKS; no local authentication bypass is provided. */
export function createSupabaseAuthenticator(supabaseUrl: string): Authenticate {
  const url = new URL(supabaseUrl);
  if (
    url.protocol !== 'https:' || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash
  ) throw new Error('SUPABASE_URL must be an HTTPS project origin.');
  const issuer = `${url.origin}/auth/v1`;
  return createJwtAuthenticator(issuer, createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)));
}
