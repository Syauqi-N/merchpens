# Duitku Integration Reference (verified Jul 2026)

> Source of truth for this project's payment integration. Facts verified against official docs
> `https://docs.duitku.com/api/en/` and `https://docs.duitku.com/pop/en/` (both updated Jun 2026).

## Decision for this project
- **Flow: POP (Duitku-hosted checkout)** — call `createInvoice`, get `paymentUrl`, redirect customer.
  Avoids building our own VA/QRIS UI and reduces PCI scope.
- **Signature: HMAC-SHA256** (lowercase hex). MD5 / plain-SHA256 are OBSOLETE since Apr 2026.
- **No official Node SDK use** — the npm `duitku` package is stale (2023) and predates HMAC-SHA256.
  We hand-roll the HTTP client + signer with Node `crypto`.

## Credentials (env)
- `DUITKU_MERCHANT_CODE` — project code from dashboard
- `DUITKU_API_KEY` — merchant/api key (paired 1:1 with merchant code)
- `DUITKU_ENV` — `sandbox` | `production`

## Base URLs (POP flow)
| Purpose | Sandbox | Production |
|---|---|---|
| Create Invoice | `https://api-sandbox.duitku.com/api/merchant/createInvoice` | `https://api-prod.duitku.com/api/merchant/createInvoice` |
| Hosted redirect page | `https://app-sandbox.duitku.com/redirect_checkout?reference=...` | `https://app-prod.duitku.com/redirect_checkout?reference=...` |
| Check Transaction Status | `https://sandbox.duitku.com/webapi/api/merchant/transactionStatus` | `https://passport.duitku.com/webapi/api/merchant/transactionStatus` |

## Create Invoice (POP)
`POST {base}/createInvoice` — `Content-Type: application/json`
Auth via HEADERS (not body):
- `x-duitku-timestamp`: UNIX ms timestamp (Jakarta TZ)
- `x-duitku-merchantcode`: merchantCode
- `x-duitku-signature`: `HMAC_SHA256(merchantCode + timestamp, apiKey)`

Body (key fields): `paymentAmount` (int), `merchantOrderId` (unique, ≤50), `productDetails`,
`email`, `customerVaName` (optional in POP), `callbackUrl`, `returnUrl`, `expiryPeriod` (minutes),
`itemDetails[]`, `customerDetail{}`.
Response: `merchantCode`, `reference`, `paymentUrl` (→ redirect_checkout), `statusCode`, `statusMessage`.
Note: `vaNumber`/`qrString` are NOT returned by POP — they appear on Duitku's hosted page.

## Signature formulas (HMAC-SHA256, key = apiKey, hex lowercase)
| Operation | stringToSign | Placement |
|---|---|---|
| Create Invoice (POP) | `merchantCode + timestamp` | header `x-duitku-signature` |
| Check Transaction Status | `merchantCode + merchantOrderId` | body `signature` |
| Get Payment Method | `merchantCode + paymentAmount + datetime` (`yyyy-MM-dd HH:mm:ss`) | body `signature` |
| **Callback verify (inbound)** | `merchantCode + amount + merchantOrderId` | compare to POST `signature` |

## Callback / Webhook (server-to-server — the ONLY source of truth)
- Duitku POSTs `application/x-www-form-urlencoded` to our `callbackUrl`.
- Must be public (port 80/443) and **return HTTP 200**, else Duitku retries up to 5x.
- Verify: `HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)` == `signature`.
- Success when `resultCode == "00"`. Failure code disagrees between docs (01 vs 02) —
  treat anything != "00" as not-paid, and reconcile via Check Transaction Status.
- Whitelist IPs (optional hardening):
  - Prod: `182.23.85.8-10,13,14`, `103.177.101.184-186,189,190`
  - Sandbox: `182.23.85.11,12`, `103.177.101.187,188`
- Key POST fields: `merchantCode`, `amount`, `merchantOrderId`, `resultCode`, `reference`,
  `signature`, `paymentCode`, `publisherOrderId`, `settlementDate`, `issuerCode`.

## Return URL (browser redirect — display ONLY, never update DB from it)
`GET {returnUrl}?merchantOrderId=..&reference=..&resultCode=..`
`00`=Success, `01`=Pending/Process, `02`=Canceled/Failed. User-alterable → not trusted.

## Payment method codes (reference)
VA: `BC` BCA, `M2` Mandiri, `I1` BNI, `BR` BRIVA, `B1` CIMB, `BT` Permata, `BV` BSI · CC: `VC`
· E-wallet: `OV` OVO, `DA` DANA, `SA` ShopeePay, `LA/LF` LinkAja · QRIS: `SP`/`NQ`/`SQ`
· Retail: `IR` Indomaret, `FT` Alfamart/Pegadaian/POS · Paylater: `DN` Indodana, `AT` Atome
(With POP hosted checkout we can let the customer pick the method on Duitku's page, or pass a
specific `paymentMethod`.)

## Fees (2026, VAT-incl, successful txn only)
QRIS 0.7% · VA BCA Rp5.000 / Mandiri Rp4.000 / others Rp3.000 · CC 2.9%+Rp2.500 ·
OVO/DANA/LinkAja 1.67% · ShopeePay 2% · Indomaret MDR+Rp1.000. No monthly/registration fee.

## Implementation notes
- Build one shared `signHmac(stringToSign)` util in the payment module; used for outgoing
  requests AND inbound callback verification.
- Store `merchantOrderId` (= our internal order code) and Duitku `reference` on the Payment row.
- Idempotent callback handler: a duplicate `resultCode=00` for an already-paid order is a no-op.
