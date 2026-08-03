# TLS

## Current status

**BLOCKED for public launch.** The staging certificate is **self-signed** (`subject == issuer`, CN `staging.voltx.ai`, valid to 2027-07-25). Browsers will not trust it.

Replacement cannot be done from a developer machine: issuance requires DNS for the staging hostname pointing at a publicly reachable ingress so the CA can complete its challenge.

## Issuance (owner action)

1. Confirm the staging hostname (`WEB_HOST` / `API_HOST` in `deploy/.env`).
2. Point DNS at the staging ingress and confirm public reachability on :80 and :443.
3. Obtain a certificate from Let's Encrypt or the approved CA.
4. Install the **full chain** at `deploy/nginx/ssl/fullchain.pem`; private key at `privkey.pem`, mode **600**, owned by the nginx user.
5. Configure renewal with an nginx reload hook.
6. Run the CA's dry-run renewal before relying on it.

## Verification

```bash
openssl s_client -connect staging.voltx.ai:443 -servername staging.voltx.ai
curl -I https://staging.voltx.ai
```

Confirm: not self-signed · subject matches hostname · issuer trusted · full chain validates · TLS 1.2 and 1.3 both negotiate · HTTP redirects to HTTPS · expiry monitored.

nginx already pins `ssl_protocols TLSv1.2 TLSv1.3` and an ECDHE-only cipher list.

## HSTS — review before launch

nginx currently sends:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`preload` is a **two-year, hard-to-reverse commitment covering every subdomain of the parent domain**. Do not submit `voltx.ai` to the preload list until every current and future subdomain can serve valid HTTPS. Until that decision is made deliberately, drop `preload` and keep `max-age` + `includeSubDomains`.

## Monitoring

`CertificateExpiringSoon` and `CertificateExpiringCritical` alert from blackbox probe data. Both depend on public DNS resolving, so neither can be validated on a developer machine.
