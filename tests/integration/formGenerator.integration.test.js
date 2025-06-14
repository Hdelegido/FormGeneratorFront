import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FormGenerator from '../../frontend-form/js/formGenerator.js';
import { createTestContainer, cleanupTestContainer } from '../setup.js';

describe('FormGenerator - Integration Tests', () => {
  let container;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  it('should handle API communication', async () => {
    const schema = {
      properties: {
        nombre: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Object created successfully' })
    });

    const onSubmitSuccess = vi.fn();
    const formGenerator = new FormGenerator({
      schema,
      model: 'integration_test',
      container,
      onSubmitSuccess,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    const formData = { nombre: 'Test User', email: 'test@example.com' };

    const result = await formGenerator.apiRequest('createObject', {
      url: 'http://test.com/api/create/test/',
      method: 'POST',
      data: formData
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test.com/api/create/test/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
    );

    expect(result.message).toBe('Object created successfully');
  });

  it('should handle form submission workflow', async () => {
    const schema = {
      properties: {
        nombre: { type: 'string', title: 'Nombre' },
        email: { type: 'string', format: 'email' }
      },
      required: ['nombre']
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Cliente creado correctamente' })
    });

    const onSubmitSuccess = vi.fn();
    const formGenerator = new FormGenerator({
      schema,
      model: 'cliente',
      container,
      onSubmitSuccess,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    formGenerator.renderForm();

    // Fill form
    const nameInput = container.querySelector('#nombre');
    const emailInput = container.querySelector('#email');
    nameInput.value = 'Juan Pérez';
    emailInput.value = 'juan@example.com';

    // Validate form
    const isValid = formGenerator.validateAllFields();
    expect(isValid).toBe(true);

    // Get form data
    const formData = formGenerator.getFormData();
    expect(formData.nombre).toBe('Juan Pérez');
    expect(formData.email).toBe('juan@example.com');
  });
});