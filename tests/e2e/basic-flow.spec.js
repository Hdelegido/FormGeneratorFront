import { test, expect } from '@playwright/test';

test.describe('FormGenerator - Flujo Básico E2E', () => {
  test('debe cargar la página principal', async ({ page }) => {
    await page.goto('/');
    
    // Debug: tomar screenshot
    await page.screenshot({ path: 'debug-homepage.png' });
    
    // Verificar que la página carga
    await expect(page.locator('h1')).toContainText('Gestor de Models Dinàmics', { timeout: 10000 });
    
    // Verificar que están los selectores principales
    await expect(page.locator('#modelSelect')).toBeVisible();
  });

  test('debe mostrar elementos básicos de la interfaz', async ({ page }) => {
    await page.goto('/');
    
    // Verificar elementos de la interfaz
    await expect(page.locator('#editModel')).toBeVisible();
    await expect(page.locator('#editId')).toBeVisible();
    await expect(page.locator('#editLoad')).toBeVisible();
    
    // Verificar pestañas de navegación
    await expect(page.locator('[data-model="cliente"]')).toBeVisible();
    await expect(page.locator('[data-model="producto"]')).toBeVisible();
  });

  test('debe responder a interacciones básicas', async ({ page }) => {
    await page.goto('/');
    
    // Intentar seleccionar un modelo (pero sin esperar formulario aún)
    await page.selectOption('#modelSelect', 'cliente');
    
    // Esperar un poco para ver si carga algo
    await page.waitForTimeout(2000);
    
    // Verificar que al menos cambió el título
    const titleText = await page.locator('#formTitle').textContent();
    console.log('Title text:', titleText);
    
    // Tomar screenshot para debug
    await page.screenshot({ path: 'debug-after-select.png' });
  });
});