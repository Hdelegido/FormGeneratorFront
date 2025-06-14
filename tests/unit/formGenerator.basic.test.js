import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import FormGenerator from '../../frontend-form/js/formGenerator.js';
import { createTestContainer, cleanupTestContainer, createTestSchema } from '../setup.js';

describe('FormGenerator - Tests Básicos', () => {
  let container;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  it('debería crear una instancia de FormGenerator', () => {
    const schema = createTestSchema();

    const formGenerator = new FormGenerator({
      schema,
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    expect(formGenerator).toBeDefined();
    expect(formGenerator.schema).toEqual(schema);
    expect(formGenerator.model).toBe('test');
    expect(formGenerator.container).toBe(container);
  });

  it('debería renderizar un formulario básico', () => {
    const schema = {
      title: 'Formulario Test',
      properties: {
        nombre: { type: 'string', title: 'Nombre' },
        email: { type: 'string', format: 'email' }
      }
    };

    const formGenerator = new FormGenerator({
      schema,
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    formGenerator.renderForm();

    // Verificar que se creó el formulario
    const form = container.querySelector('.generated-form');
    expect(form).toBeTruthy();

    // Verificar título
    const title = container.querySelector('.form-schema-title');
    expect(title?.textContent).toBe('Formulario Test');

    // Verificar campos
    const nombreInput = container.querySelector('#nombre');
    const emailInput = container.querySelector('#email');
    
    expect(nombreInput).toBeTruthy();
    expect(emailInput).toBeTruthy();
    expect(emailInput.type).toBe('email');
  });

  it('debería detectar tipos de campo correctamente', () => {
    const formGenerator = new FormGenerator({
      schema: { properties: {} },
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    // Test detección de email
    expect(formGenerator.detectFieldType('email', { type: 'string', format: 'email' }))
      .toBe('email');

    // Test detección de número
    expect(formGenerator.detectFieldType('edad', { type: 'integer' }))
      .toBe('integer');

    // Test detección de mapa
    expect(formGenerator.detectFieldType('zona_distribucion', { type: 'object' }))
      .toBe('map');

    // Test detección de texto
    expect(formGenerator.detectFieldType('nombre', { type: 'string' }))
      .toBe('text');
  });

  it('debería manejar validación básica', () => {
    const schema = {
      properties: {
        nombre: { type: 'string', minLength: 3 },
        email: { type: 'string', format: 'email' }
      },
      required: ['nombre']
    };

    const formGenerator = new FormGenerator({
      schema,
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    formGenerator.renderForm();
    formGenerator.setupValidation();

    // Verificar que se crearon los validadores
    expect(formGenerator.validators).toBeDefined();
    expect(formGenerator.validators.nombre).toBeDefined();
    expect(formGenerator.validators.email).toBeDefined();

    // Test validación email válido
    expect(formGenerator.validateField('email', 'test@example.com')).toBe(true);
    // Test validación email inválido
    expect(formGenerator.validateField('email', 'invalido')).toBe(false);

    // Test validación nombre válido (más de 3 caracteres)
    expect(formGenerator.validateField('nombre', 'Juan')).toBe(true);
    // Test validación nombre inválido (menos de 3 caracteres)
    expect(formGenerator.validateField('nombre', 'Ab')).toBe(false);
  });

  it('debería crear campos con atributos correctos', () => {
    const schema = {
      properties: {
        nombre: { 
          type: 'string', 
          title: 'Nombre Completo',
          placeholder: 'Introduce tu nombre',
          maxLength: 100
        },
        edad: {
          type: 'integer',
          minimum: 18,
          maximum: 120
        }
      },
      required: ['nombre']
    };

    const formGenerator = new FormGenerator({
      schema,
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    formGenerator.renderForm();

    // Verificar campo nombre
    const nombreInput = container.querySelector('#nombre');
    expect(nombreInput.placeholder).toBe('Introduce tu nombre');
    expect(nombreInput.maxLength).toBe(100);
    expect(nombreInput.required).toBe(true);

    // Verificar campo edad
    const edadInput = container.querySelector('#edad');
    expect(edadInput.type).toBe('number');
    expect(edadInput.min).toBe('18');
    expect(edadInput.max).toBe('120');
  });
});
