import fs from 'node:fs';
import { totp } from '../../backend/src/lib/totp.js';

// Credenciales sembradas por `npm run seed:emu` (archivo local, ignorado por git).
const FILE = new URL('../../backend/.seed-credentials.json', import.meta.url);
export const creds = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));

export async function login(page, email, { password, otp } = {}) {
  const c = creds()[email];
  await page.goto('/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-pass').fill(password ?? c.password);
  if (c.mfaSecret) await page.locator('#login-otp').fill(otp ?? totp(c.mfaSecret));
  await page.locator('form button.btn').click();
}
