// Muestra el código MFA actual de una cuenta (respaldo). Uso: npm run mfa:code [-- correo]
import fs from 'node:fs';
import { totp } from '../lib/totp.js';
const email = process.argv[2] || 'admin@aprueba.cl';
let c;
try { c = JSON.parse(fs.readFileSync(new URL('../../.admin-credentials.json', import.meta.url), 'utf8')); }
catch { console.error('Primero ejecuta preparar_cuentas.bat'); process.exit(1); }
if (!c[email]?.mfaSecret) { console.error('Esa cuenta no usa MFA.'); process.exit(1); }
console.log(`${email}  código: ${totp(c[email].mfaSecret)}  (cambia cada 30 s)`);
