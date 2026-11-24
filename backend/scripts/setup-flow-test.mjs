// End-to-end check of first-run setup, system settings and key rotation against a running API.
//   node scripts/setup-flow-test.mjs <apiBase> <setupCode>
const [base, code] = process.argv.slice(2);
const A = `${base}/api/admin`;
const j = async (method, path, body, token) => {
  const r = await fetch(A + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const check = (label, ok, extra = '') => console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`);

let r = await j('GET', '/setup/status');
check('setup required on a fresh install', r.body?.required === true);

const site = { nameLine1: 'SARGODHAN SPIRIT TRUST', nameLine2: 'PUBLIC SCHOOL', nameLine3: 'RASHIDABAD', publicUrl: 'https://www.example-school.pk/', theme: 'purple' };
const admin = { name: 'Test Admin', email: 'Admin@Example.org', password: 'Str0ngPassword!' };
r = await j('POST', '/setup', { code: 'WRONG-CODE1', admin, site });
check('wrong setup code rejected', r.status === 403, r.body?.error?.code);
r = await j('POST', '/setup', { code, admin: { ...admin, password: 'weak' }, site });
check('weak password rejected', r.status === 422);
r = await j('POST', '/setup', { code, admin, site });
check('setup completes with the correct code', r.status === 201 && !!r.body?.accessToken, `status ${r.status}`);
const token = r.body?.accessToken;
check('first user is a Super Administrator', r.body?.user?.roles?.[0]?.key === 'super_admin');

r = await j('GET', '/setup/status');
check('setup no longer required', r.body?.required === false);
r = await j('POST', '/setup', { code, admin: { ...admin, email: 'x@example.org' }, site });
check('setup cannot be repeated', r.status === 409);

r = await j('GET', '/system', null, token);
check('system settings readable', r.status === 200 && r.body?.settings?.publicUrl === 'https://www.example-school.pk', r.body?.settings?.publicUrl);
r = await j('PUT', '/system', { publicUrl: 'not a url', maxUploadMb: 15, secureCookies: 'auto' }, token);
check('invalid public address rejected', r.status === 422);
r = await j('PUT', '/system', { publicUrl: 'https://sst.example.pk', maxUploadMb: 25, secureCookies: 'on' }, token);
check('system settings saved', r.status === 200 && r.body?.effective?.maxUploadMb === 25);

const pub = await (await fetch(`${base}/api/public/site`)).json();
check('website receives only the public address', pub.settings.system?.publicUrl === 'https://sst.example.pk' && pub.settings.system?.maxUploadMb === undefined);
check('theme from setup applied', pub.settings.theme?.preset === 'purple');
check('school name from setup applied', pub.settings.identity?.nameLine1 === 'SARGODHAN SPIRIT TRUST');

r = await j('POST', '/system/rotate-key', { key: 'preview' }, token);
check('preview key rotated', r.status === 200 && r.body?.signedOut === false);
r = await j('GET', '/auth/me', null, token);
check('still signed in after preview-key rotation', r.status === 200);
r = await j('POST', '/system/rotate-key', { key: 'jwtAccess' }, token);
check('sign-in key rotated', r.status === 200 && r.body?.signedOut === true);
r = await j('GET', '/auth/me', null, token);
check('old session token no longer accepted', r.status === 401);
