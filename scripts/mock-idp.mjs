#!/usr/bin/env node
/**
 * Mock SAML Identity Provider (dev tool).
 *
 * Lets you exercise the real "Sign in with SSO" flow locally:
 *   login page → /api/auth/saml/login → AuthnRequest → this IdP →
 *   signed SAMLResponse → /api/auth/saml/acs → JIT-provisioned session → dashboard
 *
 * Usage:
 *   1. Generate a cert once (or reuse scripts/dev-idp/):
 *        openssl req -x509 -newkey rsa:2048 -keyout scripts/dev-idp/key.pem \
 *          -out scripts/dev-idp/cert.pem -days 365 -nodes \
 *          -config scripts/dev-idp/openssl.cnf
 *   2. Run:        node scripts/mock-idp.mjs          (listens on :3012)
 *   3. Configure an SSO connection (SSO settings page) with:
 *        IdP SSO URL : http://localhost:3012/sso
 *        IdP cert    : the contents of scripts/dev-idp/cert.pem
 *        Email domain: any domain you'll type at login (e.g. sso.test)
 *   4. Log out, then at /en/login type <anything>@sso.test and click
 *      "Sign in with SSO". The IdP asserts MOCK_IDP_EMAIL (default
 *      sso@dashboard.com) and the ACS JIT-provisions that user.
 *
 * Env overrides: PORT (3012), MOCK_IDP_EMAIL (sso@dashboard.com),
 * CERT_FILE / KEY_FILE (default scripts/dev-idp/cert.pem / key.pem).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { SignedXml } from "xml-crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3012);
const IDP_ENTITY_ID = process.env.IDP_ENTITY_ID || "http://localhost:3012";
const EMAIL = process.env.MOCK_IDP_EMAIL || "sso@dashboard.com";
const NAME = process.env.MOCK_IDP_NAME || "Sso User";
const CERT_FILE = process.env.CERT_FILE || path.join(__dirname, "dev-idp", "cert.pem");
const KEY_FILE = process.env.KEY_FILE || path.join(__dirname, "dev-idp", "key.pem");

const idpCertPem = fs.readFileSync(CERT_FILE, "utf8").replace(/\r/g, "");
const idpKeyPem = fs.readFileSync(KEY_FILE, "utf8").replace(/\r/g, "");

const iso = (d) => d.toISOString();
const nowMinus = (ms) => iso(new Date(Date.now() - ms));
const nowPlus = (ms) => iso(new Date(Date.now() + ms));

/** base64(deflate()) — the SAMLRequest redirect-binding encoding. */
function decodeSamlRequest(encoded) {
  const b64 = encoded.replace(/ /g, "+");
  const deflated = Buffer.from(b64, "base64");
  return zlib.inflateRawSync(deflated).toString("utf8");
}

/** Pull the ACS URL + SP issuer + request ID out of the AuthnRequest. */
function parseAuthnRequest(xml) {
  const acs = /AssertionConsumerServiceURL="([^"]+)"/.exec(xml)?.[1] || "";
  const issuer = /<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/.exec(xml)?.[1] || "";
  const reqId = /<samlp:AuthnRequest[^>]*\bID="([^"]+)"/.exec(xml)?.[1] || "";
  return { acs, issuer, reqId };
}

/** Build a signed SAML 2.0 Response for `email` with xml-crypto. */
function buildSamlResponse({ acs, issuer, reqId }) {
  const id = crypto.randomBytes(8).toString("hex");
  const now = new Date();
  const notBefore = new Date(now.getTime() - 5 * 60_000);
  const notOnOrAfter = new Date(now.getTime() + 30 * 60_000);

  // Assertion without the signature; xml-crypto injects a Signature after its Issuer.
  const assertionXml = `<?xml version="1.0" encoding="UTF-8"?>
<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_${id}" Version="2.0" IssueInstant="${iso(now)}">
  <saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer>
  <saml:Subject>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${EMAIL}</saml:NameID>
    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
      <saml:SubjectConfirmationData NotOnOrAfter="${iso(notOnOrAfter)}" NotBefore="${iso(notBefore)}" Recipient="${acs}"${reqId ? ` InResponseTo="${reqId}"` : ""}/>
    </saml:SubjectConfirmation>
  </saml:Subject>
  <saml:Conditions NotBefore="${iso(notBefore)}" NotOnOrAfter="${iso(notOnOrAfter)}">
    <saml:AudienceRestriction><saml:Audience>${issuer}</saml:Audience></saml:AudienceRestriction>
  </saml:Conditions>
  <saml:AuthnStatement AuthnInstant="${iso(now)}" SessionIndex="_${id}">
    <saml:AuthnContext><saml:AuthnContextClassRef>urn:federation:authentication:windows</saml:AuthnContextClassRef></saml:AuthnContext>
  </saml:AuthnStatement>
  <saml:AttributeStatement>
    <saml:Attribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue>${EMAIL}</saml:AttributeValue></saml:Attribute>
    <saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue>${EMAIL}</saml:AttributeValue></saml:Attribute>
    <saml:Attribute Name="displayName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue>${NAME}</saml:AttributeValue></saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>`;

  const sig = new SignedXml();
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.addReference(
    "//*[local-name(.)='Assertion']",
    [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    "http://www.w3.org/2001/04/xmlenc#sha256",
  );
  sig.signingKey = idpKeyPem;
  sig.computeSignature(assertionXml, {
    location: { reference: "//*[local-name(.)='Issuer']", action: "after" },
  });
  const signedAssertion = sig.getSignedXml();

  const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp_${id}" Version="2.0" IssueInstant="${iso(now)}" Destination="${acs}"${reqId ? ` InResponseTo="${reqId}"` : ""}>
  <saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  ${signedAssertion}
</samlp:Response>`;

  return Buffer.from(responseXml, "utf8").toString("base64");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, email: EMAIL }));
  }

  if (url.pathname !== "/sso") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found. GET /sso (SAMLRequest) or /health");
  }

  const samlRequest = url.searchParams.get("SAMLRequest") || "";
  const relayState = url.searchParams.get("RelayState") || "";
  let acs = "";
  let issuer = "next-dashboard";
  let reqId = "";
  try {
    const authn = parseAuthnRequest(decodeSamlRequest(samlRequest));
    acs = authn.acs;
    issuer = authn.issuer || "next-dashboard";
    reqId = authn.reqId;
  } catch (err) {
    console.error("Mock IdP: failed to decode SAMLRequest:", err.message);
  }

  // Real IdPs authenticate the user themselves; this mock asserts MOCK_IDP_EMAIL.
  const samlResponse = buildSamlResponse({ acs, issuer, reqId });
  const target = acs || "http://localhost:3010/api/auth/saml/acs";

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>Mock SAML IdP</title></head>
<body style="font-family:system-ui;max-width:520px;margin:80px auto;text-align:center">
  <h2>Mock SAML IdP</h2>
  <p>Signing in <strong>${EMAIL}</strong> via SP-initiated SSO…</p>
  <p style="font-size:12px;color:#666">Issuer: ${issuer} · ACS: ${target}</p>
  <form method="post" action="${target}" id="sso-form">
    <input type="hidden" name="SAMLResponse" value="${samlResponse}"/>
    <input type="hidden" name="RelayState" value="${relayState}"/>
    <button type="submit" id="continue">Continue to dashboard</button>
  </form>
  <script>setTimeout(function(){document.getElementById('sso-form').submit();}, 600);</script>
</body></html>`);
});

server.listen(PORT, () => {
  console.log(`Mock SAML IdP listening on http://localhost:${PORT}`);
  console.log(`  asserts email: ${EMAIL}`);
  console.log(`  cert: ${CERT_FILE}`);
});
