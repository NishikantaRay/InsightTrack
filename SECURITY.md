# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue, and do
not include working exploit details in a public discussion.

Use GitHub's [private vulnerability reporting][pvr] on this repository
(Security → Report a vulnerability). If that is unavailable, open a minimal
public issue that says only that you have a security report and asks for a
contact address — with no technical detail.

[pvr]: https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability

A useful report includes:

- what an attacker can do, and what access they need to start
- the affected component (SQL Editor, tracking endpoint, sync, auth, …)
- steps to reproduce, ideally against a local `docker compose` stack
- the commit or version you tested

This is a small self-hosted project maintained in spare time. I will
acknowledge reports as soon as I can, but I cannot promise a fixed response
window. Please allow reasonable time for a fix before publishing.

## Supported versions

The project has not yet reached a tagged stable release. Only the current
`main` branch receives fixes; there are no backports.

## Scope

In scope — the code in this repository:

- authentication and session handling
- the SQL Editor's query validation and tenant scoping
- the tracking ingest endpoints
- the PostgreSQL → DuckDB sync path
- privilege boundaries between accounts and sites

Out of scope:

- vulnerabilities in third-party dependencies without a demonstrated impact on
  InsightTrack (report those upstream)
- findings that require an already-compromised host or database
- a deployment's own misconfiguration — for example running with the example
  `.env` values, exposing PostgreSQL to the internet, or serving the API over
  plain HTTP. See "Deploying safely" below.
- missing hardening headers with no demonstrated exploit

## Known limitations

These are current, deliberate statements of what this project does **not**
claim. They are not accepted vulnerability reports, but they are honest gaps.

- **No formal audit.** The code has not been reviewed by an external security
  auditor. The SQL Editor's boundary is documented and regression-tested in
  [`docs/SQL_EDITOR_SECURITY.md`](docs/SQL_EDITOR_SECURITY.md), but it is not
  certified, and it is not claimed to be exhaustively secure.
- **No compliance claim.** InsightTrack is not claimed to be GDPR-, CCPA- or
  HIPAA-compliant. It includes privacy-supporting features (Do Not Track and
  Global Privacy Control are honoured, and configurable retention deletes from
  both PostgreSQL and DuckDB), but compliance is a property of how *you* deploy
  and operate it, not of the software alone.
- **No Content-Security-Policy** is set on the dashboard yet.
- **PostgreSQL connections do not require TLS** by default.

## Deploying safely

The defaults are tuned for a local `docker compose` evaluation, not for the
public internet. Before exposing a deployment:

- Replace every value in `.env` — the shipped ones are placeholders, not
  secrets. Generate real ones with `openssl rand -base64 48`.
- Set `ENCRYPTION_KEY` explicitly if you store any integration credentials.
  It otherwise derives from `JWT_SECRET`, so rotating `JWT_SECRET` would make
  stored secrets undecryptable.
- Set `CORS_ORIGINS` to your real dashboard origin.
- Terminate TLS in front of the API; it speaks plain HTTP itself.
- Keep PostgreSQL and pgAdmin off public interfaces. The bundled compose file
  binds both to `127.0.0.1` — do not widen that without a reason.
- Consider not deploying the optional `pgadmin` service at all in production.
