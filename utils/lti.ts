import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';
import crypto from 'crypto';

// LTI Message Types
export const LTI_MESSAGE_TYPES = {
  RESOURCE_LINK: 'LtiResourceLinkRequest',
  DEEP_LINKING: 'LtiDeepLinkingRequest',
  SUBMISSION_REVIEW: 'LtiSubmissionReviewRequest',
};

// LTI Roles
export const LTI_ROLES = {
  STUDENT: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
  INSTRUCTOR: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
  TEACHING_ASSISTANT: 'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant',
  ADMIN: 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
};

// Platform presets for common LMS systems
export const LTI_PLATFORM_PRESETS = {
  canvas: {
    name: 'Canvas',
    auth_endpoint_suffix: '/api/lti/authorize_redirect',
    token_endpoint_suffix: '/login/oauth2/token',
    jwks_endpoint_suffix: '/api/lti/security/jwks',
  },
  moodle: {
    name: 'Moodle',
    auth_endpoint_suffix: '/mod/lti/auth.php',
    token_endpoint_suffix: '/mod/lti/token.php',
    jwks_endpoint_suffix: '/mod/lti/certs.php',
  },
  d2l: {
    name: 'D2L Brightspace',
    auth_endpoint_suffix: '/d2l/lti/authenticate',
    token_endpoint_suffix: '/d2l/lti/token',
    jwks_endpoint_suffix: '/d2l/.well-known/jwks',
  },
  blackboard: {
    name: 'Blackboard Learn',
    auth_endpoint_suffix: '/learn/api/public/v1/lti/authorize',
    token_endpoint_suffix: '/learn/api/public/v1/oauth2/token',
    jwks_endpoint_suffix: '/.well-known/jwks.json',
  },
};

export interface LTIPlatform {
  id: string;
  name: string;
  platform_type: string;
  issuer: string;
  client_id: string;
  auth_endpoint: string;
  token_endpoint: string;
  jwks_endpoint: string;
  deployment_id?: string;
  nrps_endpoint?: string;
  ags_endpoint?: string;
  deep_linking_endpoint?: string;
}

export interface LTILaunchPayload {
  iss: string; // Issuer
  aud: string; // Audience (client_id)
  sub: string; // Subject (user_id)
  exp: number; // Expiration
  iat: number; // Issued at
  nonce: string;
  'https://purl.imsglobal.org/spec/lti/claim/message_type': string;
  'https://purl.imsglobal.org/spec/lti/claim/version': string;
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': string;
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': string;
  'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
    id: string;
    title?: string;
    description?: string;
  };
  'https://purl.imsglobal.org/spec/lti/claim/roles': string[];
  'https://purl.imsglobal.org/spec/lti/claim/context'?: {
    id: string;
    label?: string;
    title?: string;
    type?: string[];
  };
  'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'?: {
    context_memberships_url: string;
    service_versions: string[];
  };
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'?: {
    scope: string[];
    lineitems?: string;
    lineitem?: string;
  };
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}

/**
 * Generate RSA key pair for LTI
 */
export async function generateLTIKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
  keyId: string;
}> {
  // Use Node.js crypto module instead of jose for key generation
  // This ensures keys are extractable and works in all environments
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const keyId = crypto.randomBytes(16).toString('hex');

  return {
    publicKey,
    privateKey,
    keyId,
  };
}

/**
 * Verify LTI JWT token
 */
export async function verifyLTIToken(
  token: string,
  platform: LTIPlatform,
  clientId?: string
): Promise<LTILaunchPayload> {
  try {
    // Fetch JWKS from platform
    const JWKS = jose.createRemoteJWKSet(new URL(platform.jwks_endpoint));

    // Verify the token
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: platform.issuer,
      audience: clientId || platform.client_id,
    });

    return payload as unknown as LTILaunchPayload;
  } catch (error) {
    console.error('LTI token verification failed:', error);
    throw new Error('Invalid LTI token');
  }
}

/**
 * Create JWT for LTI service requests (NRPS, AGS)
 */
export async function createLTIServiceToken(
  platform: LTIPlatform,
  privateKey: string,
  scopes: string[]
): Promise<string> {
  const key = await jose.importPKCS8(privateKey, 'RS256');

  const jwt = await new jose.SignJWT({
    scope: scopes.join(' '),
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(platform.client_id)
    .setSubject(platform.client_id)
    .setAudience(platform.token_endpoint)
    .setExpirationTime('1h')
    .setIssuedAt()
    .setJti(crypto.randomBytes(16).toString('hex'))
    .sign(key);

  return jwt;
}

/**
 * Get access token for LTI Advantage services
 */
export async function getLTIAccessToken(
  platform: LTIPlatform,
  privateKey: string,
  scopes: string[]
): Promise<string> {
  const assertion = await createLTIServiceToken(platform, privateKey, scopes);

  const response = await fetch(platform.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
      scope: scopes.join(' '),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Map LTI roles to NOVA roles
 */
export function mapLTIRoleToNovaRole(ltiRoles: string[]): string {
  // Check for instructor/admin roles first
  if (
    ltiRoles.some(
      (role) =>
        role.includes('Instructor') ||
        role.includes('Administrator') ||
        role.includes('ContentDeveloper')
    )
  ) {
    return 'instructor';
  }

  // Check for teaching assistant
  if (ltiRoles.some((role) => role.includes('TeachingAssistant'))) {
    return 'instructor'; // TAs get instructor privileges
  }

  // Default to student
  return 'student';
}

/**
 * Fetch course members using Names and Role Provisioning Service (NRPS)
 */
export async function fetchCourseMembers(
  nrpsUrl: string,
  accessToken: string
): Promise<any[]> {
  const response = await fetch(nrpsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json',
    },
  });

  if (!response.ok) {
    throw new Error(`NRPS request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.members || [];
}

/**
 * Fetch course lineitems using Assignment and Grade Services (AGS)
 */
export async function fetchCourseLineItems(
  agsUrl: string,
  accessToken: string
): Promise<any[]> {
  const response = await fetch(agsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
    },
  });

  if (!response.ok) {
    throw new Error(`AGS request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data || [];
}

/**
 * Post grade to LMS using AGS
 */
export async function postGrade(
  lineItemUrl: string,
  accessToken: string,
  userId: string,
  scoreGiven: number,
  scoreMaximum: number,
  comment?: string
): Promise<void> {
  const response = await fetch(`${lineItemUrl}/scores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.ims.lis.v1.score+json',
    },
    body: JSON.stringify({
      userId,
      scoreGiven,
      scoreMaximum,
      comment,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to post grade: ${response.statusText}`);
  }
}

/**
 * Generate state parameter for OIDC flow
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate nonce for OIDC flow
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Build OIDC authorization URL
 */
export function buildOIDCAuthUrl(
  platform: LTIPlatform,
  state: string,
  nonce: string,
  redirectUri: string,
  loginHint: string,
  clientId?: string
): string {
  const params = new URLSearchParams({
    response_type: 'id_token',
    response_mode: 'form_post',
    client_id: clientId || platform.client_id,
    redirect_uri: redirectUri,
    scope: 'openid',
    state,
    nonce,
    login_hint: loginHint,
    prompt: 'none',
  });

  return `${platform.auth_endpoint}?${params.toString()}`;
}

/**
 * Validate LTI deployment ID
 */
export function validateDeploymentId(
  payload: LTILaunchPayload,
  platform: LTIPlatform
): boolean {
  if (!platform.deployment_id) {
    return true; // No deployment ID configured, skip validation
  }

  const deploymentId = payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
  return deploymentId === platform.deployment_id;
}

/**
 * Extract context (course) information from LTI payload
 */
export function extractContextInfo(payload: LTILaunchPayload) {
  const context = payload['https://purl.imsglobal.org/spec/lti/claim/context'];

  return {
    contextId: context?.id || '',
    contextLabel: context?.label || '',
    contextTitle: context?.title || '',
    contextType: context?.type || [],
  };
}

/**
 * Extract user information from LTI payload
 */
export function extractUserInfo(payload: LTILaunchPayload) {
  return {
    userId: payload.sub,
    email: payload.email || '',
    givenName: payload.given_name || '',
    familyName: payload.family_name || '',
    fullName: payload.name || '',
    roles: payload['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],
  };
}

/**
 * Extract NRPS information from LTI payload
 */
export function extractNRPSInfo(payload: LTILaunchPayload) {
  const nrps = payload['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'];

  if (!nrps) {
    return null;
  }

  return {
    contextMembershipsUrl: nrps.context_memberships_url,
    serviceVersions: nrps.service_versions || [],
  };
}

/**
 * Extract AGS information from LTI payload
 */
export function extractAGSInfo(payload: LTILaunchPayload) {
  const ags = payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];

  if (!ags) {
    return null;
  }

  return {
    scope: ags.scope || [],
    lineitems: ags.lineitems || '',
    lineitem: ags.lineitem || '',
  };
}

/**
 * Determine if user is an instructor based on LTI roles
 */
export function isInstructor(roles: string[]): boolean {
  return roles.some(
    (role) =>
      role.includes('Instructor') ||
      role.includes('ContentDeveloper') ||
      role.includes('Administrator')
  );
}

/**
 * Determine if user is a teaching assistant based on LTI roles
 */
export function isTeachingAssistant(roles: string[]): boolean {
  return roles.some((role) => role.includes('TeachingAssistant'));
}

/**
 * Determine if user is a student based on LTI roles
 */
export function isStudent(roles: string[]): boolean {
  return roles.some((role) => role.includes('Learner') || role.includes('Student'));
}
