import { test, expect } from '@playwright/test';

test.describe('Accesibilidad Básica', () => {
  test('formulario debe tener navegación por teclado', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#modelSelect', 'cliente');
    await page.waitForSelector('#nombre', { timeout: 10000 });

    await page.focus('#nombre');
    await page.keyboard.press('Tab');
    
    const focusedElement = await page.evaluate(() => document.activeElement.id);
    expect(['email', 'tipo', 'edat']).toContain(focusedElement);
  });

  test('campos deben tener labels apropiados', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#modelSelect', 'cliente');
    await page.waitForSelector('#nombre');

    await expect(page.locator('label[for="nombre"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="tipo"]')).toBeVisible();
  });
});
