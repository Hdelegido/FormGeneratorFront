import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FormGenerator from '../../frontend-form/js/formGenerator.js';
import { createTestContainer, cleanupTestContainer } from '../setup.js';

describe('FormGenerator - Flujo Completo', () => {
  let container;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  it('debe completar workflow: renderizar -> validar -> enviar', async () => {
    const schema = {
      properties: {
        nombre: { type: 'string', minLength: 3 },
        email: { type: 'string', format: 'email' },
        tipo: { enum: ['Basic', 'Premium'], format: 'select' }
      },
      required: ['nombre', 'email']
    };

    // Mock API exitoso
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

    // 1. Renderizar
    formGenerator.renderForm();
    expect(container.querySelector('.generated-form')).toBeTruthy();

    // 2. Llenar datos
    const nombreInput = container.querySelector('#nombre');
    const emailInput = container.querySelector('#email');
    const tipoSelect = container.querySelector('#tipo');

    nombreInput.value = 'Juan Pérez';
    emailInput.value = 'juan@example.com';
    tipoSelect.value = 'Premium';

    // 3. Validar
    expect(formGenerator.validateField('nombre', 'Juan Pérez')).toBe(true);
    expect(formGenerator.validateField('email', 'juan@example.com')).toBe(true);
    expect(formGenerator.validateAllFields()).toBe(true);

    // 4. Obtener datos
    const formData = formGenerator.getFormData();
    expect(formData.nombre).toBe('Juan Pérez');
    expect(formData.email).toBe('juan@example.com');
    expect(formData.tipo).toBe('Premium');

    // 5. Simular envío
    const result = await formGenerator.apiRequest('createObject', {
      url: 'http://test.com/api/create/cliente/',
      method: 'POST',
      data: formData
    });

    expect(result.message).toBe('Cliente creado correctamente');
  });
});