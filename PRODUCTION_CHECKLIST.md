# NOVA AI Tutor - Production Readiness Checklist

## 1. Environment & Secrets
- [ ] All secrets stored in a secrets manager (e.g., AWS Secrets Manager, Vault, GitHub Secrets) — never in `.env` committed to git
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is rotated and restricted to server-side API routes only
- [ ] `LTI_PRIVATE_KEY` is a strong 2048-bit+ RSA key generated specifically for production
- [ ] `TOGETHER_API_KEY` and `OPENAI_API_KEY` have spending limits configured in their dashboards
- [ ] `NEXT_PUBLIC_*` variables (exposed to browser) contain NO secrets — verified
- [ ] `NODE_ENV=production` is set
- [ ] `NEXT_TELEMETRY_DISABLED=1` is set to prevent Next.js phoning home

## 2. Next.js Build Configuration
- [ ] `output: 'standalone'` is enabled in `next.config.mjs` for minimal Docker image size
- [ ] `images.domains` or `images.remotePatterns` is locked to only required external image hosts
- [ ] `Content-Security-Policy` headers are configured in `next.config.mjs` or middleware
- [ ] `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` security headers are set
- [ ] `HSTS` header is configured (enforce via nginx or `next.config.mjs`)
- [ ] Source maps are disabled in production or stored securely (not publicly accessible)

## 3. Supabase
- [ ] Row Level Security (RLS) is enabled on ALL tables — verify with `check_rag_data.sql`
- [ ] RLS policies reviewed: students can only access their own chat history, sessions, and materials
- [ ] Instructors role policies are correctly scoped (see `INSTRUCTOR_ROLE.md`)
- [ ] Admin role policies verified for `/admin` routes
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NEVER used on the client side
- [ ] Supabase Auth email confirmation is enabled for production
- [ ] Supabase Auth redirect URLs are locked to your production domain only
- [ ] Storage bucket policies are configured (course materials upload is authenticated-only)
- [ ] Database backups are enabled (Supabase Pro or pg_dump scheduled)
- [ ] Connection pooling is enabled (PgBouncer via Supabase if high traffic)
- [ ] pgvector extension is installed for RAG embeddings (see `RAG_SETUP_COMPLETE.md`)

## 4. API Security
- [ ] Upstash Redis rate limiting is active on all public API routes (`/api/getChat`, `/api/getSources`, etc.)
- [ ] `/api/admin/*` routes are protected with admin role check via Supabase auth
- [ ] `/api/lti/*` endpoints validate LTI 1.3 JWT signatures properly
- [ ] `/api/calendar/*` OAuth tokens are stored securely (encrypted in Supabase, not localStorage)
- [ ] `/api/storage/download` validates user ownership before serving files
- [ ] Input validation with Zod is applied to all API routes accepting user input
- [ ] File upload route (`/api/course-materials/upload`) restricts file types and sizes
- [ ] CORS is configured restrictively — only allow your production domain

## 5. LTI 1.3 Integration
- [ ] LTI platform registrations are stored securely (ltijs database)
- [ ] LTI JWKS endpoint (`/api/lti/jwks`) is publicly accessible
- [ ] LTI launch URL (`/api/lti/launch`) is tested with target LMS (Canvas, Moodle, Blackboard)
- [ ] LTI NRPS sync (`/api/lti/sync/nrps`) is rate-limited and authenticated
- [ ] RSA key pair is rotated periodically — update JWKS endpoint when rotating
- [ ] LTI state/nonce validation is implemented to prevent replay attacks

## 6. Google Calendar Integration
- [ ] Google OAuth app is verified (not in test mode) for production use
- [ ] Redirect URI in Google Cloud Console matches `GOOGLE_REDIRECT_URI` exactly
- [ ] OAuth tokens (access + refresh) are stored encrypted in Supabase, not plain text
- [ ] Token refresh logic handles expiry gracefully without user disruption
- [ ] Google Calendar API rate limits are handled with exponential backoff

## 7. AI / RAG Pipeline
- [ ] Together AI API rate limits are understood and handled (retry logic in place)
- [ ] OpenAI embeddings API errors are handled gracefully
- [ ] RAG chunk size and overlap are tuned for your course material types (PDF, PPTX, DOCX)
- [ ] `pdf-parse` and `mammoth` file processing is sandboxed (untrusted PDFs can contain malicious content)
- [ ] Vector similarity search index exists on `document_chunks` table in Supabase
- [ ] Maximum token limits for Llama 3.1 70B context are enforced (llama3-tokenizer-js)
- [ ] Helicone is logging all LLM calls for cost monitoring and debugging

## 8. Docker & Infrastructure
- [ ] Docker image uses non-root user (`nextjs:nodejs`)
- [ ] `dumb-init` is used as PID 1 for proper signal handling
- [ ] Docker healthcheck is configured and passing
- [ ] Nginx reverse proxy handles SSL termination (Let's Encrypt / ACM)
- [ ] HTTP → HTTPS redirect is enforced at nginx level
- [ ] Gzip/Brotli compression is enabled in nginx for JS/CSS/HTML
- [ ] Next.js static assets (`/_next/static/`) are cached with long TTL at nginx
- [ ] Container resource limits (CPU/memory) are set in docker-compose or Kubernetes
- [ ] Log rotation is configured for all containers

## 9. Performance
- [ ] Next.js Image Optimization is configured with `sharp` (already in dependencies)
- [ ] `@next/bundle-analyzer` run to check bundle size — eliminate unused dependencies
- [ ] API routes that call LLMs use streaming responses where implemented
- [ ] Supabase queries use indexes on frequently queried columns (user_id, course_id, created_at)
- [ ] CDN is configured for `/_next/static/` and `/public/` assets
- [ ] React Server Components are used where possible to reduce client bundle

## 10. Monitoring & Observability
- [ ] Helicone dashboard is set up with cost alerts for LLM API spend
- [ ] Application error tracking is configured (Sentry recommended for Next.js)
- [ ] Uptime monitoring is set up (e.g., Uptime Robot, Better Uptime)
- [ ] Supabase dashboard alerts are configured for DB CPU/storage thresholds
- [ ] Docker container logs are forwarded to a log aggregation service (Datadog, Logtail, etc.)
- [ ] `/api/validateRequest` endpoint is used as health check target

## 11. CI/CD
- [ ] GitHub Actions workflow runs lint + type check on every PR
- [ ] Production deploys only trigger on `main` branch
- [ ] GitHub environment protection rules require approval for production deploys
- [ ] All required secrets are configured in GitHub repository secrets
- [ ] Docker image is scanned for vulnerabilities (Trivy or Docker Scout) in CI
- [ ] Rollback procedure is documented and tested

## 12. Compliance & Privacy
- [ ] Privacy policy covers AI data usage (student queries sent to Together AI / OpenAI)
- [ ] FERPA compliance reviewed if handling US student education records
- [ ] Data retention policy defined for chat history and course materials
- [ ] Users can delete their account and associated data (GDPR right to erasure)
- [ ] Cookie consent banner implemented if using analytics (Plausible is privacy-friendly)
- [ ] `next-plausible` is configured with your production domain
