import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import FormGenerator from '../../frontend-form/js/formGenerator.js';
import { createTestContainer, cleanupTestContainer } from '../setup.js';

describe('FormGenerator - Performance Tests', () => {
  let container;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  it('should render a simple form in less than 100ms', () => {
    const schema = {
      properties: {
        nombre: { type: 'string' },
        email: { type: 'string', format: 'email' },
        edad: { type: 'integer' }
      }
    };

    const formGenerator = new FormGenerator({
      schema,
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    const startTime = performance.now();
    formGenerator.renderForm();
    const endTime = performance.now();

    const renderTime = endTime - startTime;
    console.log(`Render time: ${renderTime.toFixed(2)}ms`);

    expect(renderTime).toBeLessThan(100);
    expect(container.querySelector('.generated-form')).toBeTruthy();
  });

  it('should validate multiple fields quickly', () => {
    const schema = {
      properties: {
        field1: { type: 'string', minLength: 5 },
        field2: { type: 'string', format: 'email' },
        field3: { type: 'number', minimum: 0 },
        field4: { type: 'string', maxLength: 100 },
        field5: { type: 'integer', maximum: 1000 }
      }
    };

    const formGenerator = new FormGenerator({
      schema,
      model: 'performance_test',
      container,
      apiConfig: { baseUrl: 'http://test.com' }
    });

    formGenerator.setupValidation();

    const startTime = performance.now();
    const isValid = formGenerator.validateAllFields();
    const endTime = performance.now();

    const validationTime = endTime - startTime;
    console.log(`Validation time: ${validationTime.toFixed(2)}ms`);

    expect(validationTime).toBeLessThan(50);
    expect(typeof isValid).toBe('boolean');
  });
});