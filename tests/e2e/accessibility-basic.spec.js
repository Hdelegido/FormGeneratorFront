import { test, expect } from '@playwright/test';

test.describe('Accesibilidad Básica', () => {
  test('formulario debe tener navegación por teclado', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#modelSelect', 'cliente');
    await page.waitForSelector('#nombre', { timeout: 10000 });

    // Navegar con Tab
    await page.focus('#nombre');
    
    // Debug: ver qué elemento está enfocado inicialmente
    let focusedElement = await page.evaluate(() => document.activeElement.id);
    console.log('Elemento inicial enfocado:', focusedElement);
    
    await page.keyboard.press('Tab');
    
    // Debug: ver qué elemento está enfocado después del Tab
    focusedElement = await page.evaluate(() => document.activeElement.id);
    console.log('Elemento enfocado después de Tab:', focusedElement);
    
    // Verificar que al menos cambió el foco (no está vacío)
    expect(focusedElement).not.toBe('');
    
    // Verificar que se puede navegar a través de varios campos
    const visitedElements = [focusedElement];
    
    // Hacer varios Tabs y recoger los IDs
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = await page.evaluate(() => document.activeElement.id);
      if (currentFocus && !visitedElements.includes(currentFocus)) {
        visitedElements.push(currentFocus);
      }
    }
    
    console.log('Elementos visitados:', visitedElements);
    
    // Verificar que visitamos al menos 2 elementos diferentes
    expect(visitedElements.length).toBeGreaterThan(1);
  });

  test('campos deben tener labels apropiados', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#modelSelect', 'cliente');
    await page.waitForSelector('#nombre', { timeout: 10000 });

    // Verificar que los campos tienen labels
    await expect(page.locator('label[for="nombre"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="tipo"]')).toBeVisible();
  });

  test('campos requeridos deben tener indicación visual', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#modelSelect', 'cliente');
    await page.waitForSelector('#nombre', { timeout: 10000 });

    // Verificar que campos requeridos tienen asterisco o indicación
    const nombreInput = page.locator('#nombre');
    const nombreLabel = page.locator('label[for="nombre"]');
    
    await expect(nombreInput).toBeVisible();
    await expect(nombreLabel).toBeVisible();
    
    // Verificar que el input tiene el atributo required
    await expect(nombreInput).toHaveAttribute('required');
    
    // Verificar que hay alguna indicación visual de requerido
    await expect(page.locator('.required-asterisk, [aria-required="true"]')).toBeVisible();
  });

  test('formulario debe ser usable solo con teclado', async ({ page }) => {
    await page.goto('/');
    
    // Navegar solo con teclado
    await page.keyboard.press('Tab'); // Ir al primer elemento
    
    // Buscar el selector de modelo y seleccionar cliente
    const modelSelect = page.locator('#modelSelect');
    await modelSelect.focus();
    await page.keyboard.press('ArrowDown'); // Abrir dropdown
    await page.keyboard.press('ArrowDown'); // Navegar a cliente
    await page.keyboard.press('Enter'); // Seleccionar
    
    // Esperar a que aparezca el formulario
    await page.waitForSelector('#nombre', { timeout: 10000 });
    
    // Navegar al campo nombre
    await page.locator('#nombre').focus();
    await page.keyboard.type('Juan Pérez García');
    
    // Navegar al siguiente campo
    await page.keyboard.press('Tab');
    await page.keyboard.type('juan@example.com');
    
    // Verificar que los valores se introdujeron correctamente
    await expect(page.locator('#nombre')).toHaveValue('Juan Pérez García');
    await expect(page.locator('#email')).toHaveValue('juan@example.com');
  });
});