import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers.js';

const axe = (page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

test.describe('Login', () => {
  test('contraseña incorrecta muestra un error accesible', async ({ page }) => {
    await login(page, 'ops@aprueba.cl', { password: 'incorrecta-123' });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.sidebar')).toHaveCount(0);
  });

  test('el login no tiene violaciones de accesibilidad', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-email')).toBeVisible();
    expect((await axe(page).analyze()).violations).toEqual([]);
  });

  test('admin entra con contraseña + código MFA (TOTP)', async ({ page }) => {
    await login(page, 'admin@aprueba.cl');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('admin con un código MFA incorrecto NO entra', async ({ page }) => {
    await login(page, 'admin@aprueba.cl', { otp: '000000' });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.sidebar')).toHaveCount(0);
  });
});

test.describe('Roles', () => {
  test('ops solo ve las vistas de su rol', async ({ page }) => {
    await login(page, 'ops@aprueba.cl');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('a[href="/operativa"]')).toBeVisible();
    await expect(page.locator('a[href="/usuarios"]')).toHaveCount(0);
    await expect(page.locator('a[href="/planes"]')).toHaveCount(0);
  });

  test('support ve Usuarios pero no Sponsors', async ({ page }) => {
    await login(page, 'support@aprueba.cl');
    await expect(page.locator('a[href="/usuarios"]')).toBeVisible();
    await expect(page.locator('a[href="/sponsors"]')).toHaveCount(0);
  });

  test('cerrar sesión devuelve al login', async ({ page }) => {
    await login(page, 'ops@aprueba.cl');
    await page.locator('.side-logout').first().click();
    await expect(page.locator('#login-email')).toBeVisible();
  });
});

test.describe('Accesibilidad de cada vista (admin)', () => {
  // Sin animaciones: axe mide el contraste a mitad de un fundido y da falsos positivos.
  test.use({ reducedMotion: 'reduce' });
  const vistas = ['/', '/comercial', '/sponsors', '/operativa', '/usuarios', '/tutores', '/contenido', '/planes', '/auditoria'];
  test('sin violaciones WCAG A/AA en ninguna vista', async ({ page }) => {
    await login(page, 'admin@aprueba.cl');
    await expect(page.locator('.sidebar')).toBeVisible();
    const problemas = [];
    for (const v of vistas) {
      await page.locator(`a[href="${v}"]`).click();
      await page.waitForLoadState('networkidle');
      const res = await axe(page).analyze();
      for (const x of res.violations) for (const n of x.nodes) problemas.push(`${v}: ${x.id} → ${n.target.join(' ')} | ${(n.any[0]?.message || '').slice(0, 110)}`);
    }
    // Se revisan TODAS las vistas y se informa el conjunto completo de problemas de una vez.
    expect(problemas).toEqual([]);
  });

  test('se puede llegar al contenido con el teclado (enlace "saltar")', async ({ page }) => {
    await login(page, 'admin@aprueba.cl');
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
  });
});

test.describe('Canje de beneficios (finance)', () => {
  test('busca un alumno, canjea y muestra el comprobante', async ({ page }) => {
    await login(page, 'finance@aprueba.cl');
    await page.locator('a[href="/sponsors"]').click();
    await page.getByRole('button', { name: /^Beneficios/ }).click(); // pestaña Beneficios
    await page.locator('.sponsors-layout-16').first().click(); // expande el sponsor (clic en la fila)
    await page.locator('button[title="Canjear 1"]:not([disabled])').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').first().fill('Cam');
    await dialog.locator('.rd-user').first().click();
    await dialog.getByRole('button', { name: /Confirmar canje/ }).click();
    await expect(dialog.getByText('Canje completado.')).toBeVisible();
    await expect(dialog.getByText('Comprobante')).toBeVisible();
    await page.waitForTimeout(400);
    expect((await axe(page).analyze()).violations).toEqual([]);
  });
});
