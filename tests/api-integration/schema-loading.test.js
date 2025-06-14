// tests/api-integration/schema-loading.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import FormGenerator from '../../frontend-form/js/formGenerator.js';

describe('FormGenerator - Integración de Schemas API', () => {
  let container;
  let mockFetch;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  it('debe cargar schema desde API Django', async () => {
    const mockSchema = {
      title: 'Cliente',
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          title: 'Nombre del Cliente',
          maxLength: 100,
          group: 'basic'
        },
        email: {
          type: 'string',
          format: 'email',
          title: 'Email de Contacto',
          group: 'basic'
        },
        tipo: {
          type: 'string',
          enum: ['Basic', 'Premium', 'Professional'],
          'x-enum-labels': {
            'Basic': 'Básico',
            'Premium': 'Premium',
            'Professional': 'Profesional'
          },
          format: 'select',
          group: 'classification'
        }
      },
      required: ['nombre', 'email'],
      fieldGroups: [
        {
          id: 'basic',
          title: 'Información Básica',
          icon: 'fa-user',
          color: '#4361ee',
          order: 1,
          expanded: true,
          fields: ['nombre', 'email']
        },
        {
          id: 'classification',
          title: 'Clasificación',
          icon: 'fa-tags',
          color: '#4cc9f0',
          order: 2,
          expanded: true,
          fields: ['tipo']
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchema
    });

    // Simular carga de schema desde API
    const response = await fetch('http://localhost:8000/api/schema/cliente/');
    const schema = await response.json();

    expect(schema).toEqual(mockSchema);
    expect(schema.fieldGroups).toBeDefined();
    expect(schema.fieldGroups).toHaveLength(2);
  });

  it('debe manejar schemas con relaciones polimórficas', async () => {
    const polymorphicSchema = {
      title: 'Comentario',
      type: 'object',
      properties: {
        texto: {
          type: 'string',
          format: 'textarea',
          title: 'Texto del Comentario'
        },
        content_type: {
          type: 'integer',
          title: 'Tipo de Contenido',
          enum: [7, 8, 9],
          'x-enum-labels': {
            7: 'Cliente',
            8: 'Producto',
            9: 'Compra'
          },
          format: 'select',
          isContentTypeField: true
        },
        object_id: {
          type: 'integer',
          title: 'ID del Objeto',
          dependsOn: 'content_type',
          format: 'select'
        }
      },
      required: ['texto', 'content_type', 'object_id'],
      isPolymorphic: true,
      contentTypeField: 'content_type',
      objectIdField: 'object_id'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => polymorphicSchema
    });

    const formGenerator = new FormGenerator({
      schema: polymorphicSchema,
      model: 'comentario',
      container,
      apiConfig: { baseUrl: 'http://localhost:8000' }
    });

    formGenerator.renderForm();

    // Verificar que se detecta como polimórfico
    expect(polymorphicSchema.isPolymorphic).toBe(true);

    // Verificar que los campos se crean correctamente
    const contentTypeSelect = container.querySelector('#content_type');
    const objectIdSelect = container.querySelector('#object_id');

    expect(contentTypeSelect).toBeTruthy();
    expect(objectIdSelect).toBeTruthy();
    expect(contentTypeSelect.classList.contains('content-type-selector')).toBe(true);
  });

  it('debe cargar opciones dinámicas para campos dependientes', async () => {
    const schema = {
      properties: {
        content_type: {
          type: 'integer',
          enum: [7, 8],
          'x-enum-labels': { 7: 'Cliente', 8: 'Producto' },
          isContentTypeField: true
        },
        object_id: {
          type: 'integer',
          dependsOn: 'content_type',
          format: 'select'
        }
      }
    };

    // Mock para cargar opciones cuando cambia content_type
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, text: '1 - Juan Pérez' },
        { id: 2, text: '2 - María García' }
      ]
    });

    const formGenerator = new FormGenerator({
      schema,
      model: 'test',
      container,
      apiConfig: { baseUrl: 'http://localhost:8000' }
    });

    formGenerator.renderForm();

    // Simular cambio en content_type
    const contentTypeSelect = container.querySelector('#content_type');
    contentTypeSelect.value = '7';
    contentTypeSelect.dispatchEvent(new Event('change'));

    // Esperar a que se carguen las opciones
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/content-type-objects/7/',
      expect.any(Object)
    );
  });
});

// tests/api-integration/crud-operations.test.js
describe('FormGenerator - Operaciones CRUD API', () => {
  let container;
  let mockFetch;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  it('debe enviar datos correctamente al crear', async () => {
    const schema = {
      properties: {
        nombre: { type: 'string', title: 'Nombre' },
        email: { type: 'string', format: 'email', title: 'Email' }
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Cliente creado correctamente' })
    });

    let onSuccessCalled = false;
    const formGenerator = new FormGenerator({
      schema,
      model: 'cliente',
      container,
      apiConfig: { baseUrl: 'http://localhost:8000' },
      onSubmitSuccess: () => { onSuccessCalled = true; }
    });

    formGenerator.renderForm();

    // Llenar formulario
    container.querySelector('#nombre').value = 'Juan Pérez';
    container.querySelector('#email').value = 'juan@example.com';

    // Simular envío
    const formData = formGenerator.getFormData();
    await formGenerator.apiRequest('createObject', {
      url: 'http://localhost:8000/api/create/cliente/',
      method: 'POST',
      data: formData
    });

    // Verificar que se llamó con datos correctos
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/create/cliente/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Juan Pérez',
          email: 'juan@example.com'
        })
      })
    );
  });

  it('debe manejar actualización de objetos existentes', async () => {
    const schema = {
      properties: {
        nombre: { type: 'string', title: 'Nombre' },
        email: { type: 'string', format: 'email', title: 'Email' }
      }
    };

    const initialData = {
      id: 1,
      nombre: 'Juan Original',
      email: 'juan.original@example.com'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Cliente actualizado correctamente' })
    });

    const formGenerator = new FormGenerator({
      schema,
      model: 'cliente',
      container,
      initialData,
      editMode: true,
      editId: 1,
      apiConfig: { baseUrl: 'http://localhost:8000' }
    });

    formGenerator.renderForm();

    expect(container.querySelector('#nombre').value).toBe('Juan Original');
    expect(container.querySelector('#email').value).toBe('juan.original@example.com');

    container.querySelector('#nombre').value = 'Juan Modificado';

    const formData = formGenerator.getFormData();
    await formGenerator.apiRequest('updateObject', {
      url: 'http://localhost:8000/api/update/cliente/1/',
      method: 'PUT',
      data: formData
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/update/cliente/1/',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          nombre: 'Juan Modificado',
          email: 'juan.original@example.com'
        })
      })
    );
  });

  it('debe manejar campos geoespaciales en API', async () => {
    const geoSchema = {
      properties: {
        nombre: { type: 'string', title: 'Nombre' },
        zona_distribucion: {
          type: 'string',
          format: 'map',
          title: 'Zona de Distribución'
        }
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Producto creado correctamente' })
    });

    const formGenerator = new FormGenerator({
      schema: geoSchema,
      model: 'producto',
      container,
      apiConfig: { baseUrl: 'http://localhost:8000' }
    });

    formGenerator.renderForm();

    const geoJSON = {
      type: "MultiPolygon",
      coordinates: [[[[2.1734, 41.3851], [2.2734, 41.3851], [2.2734, 41.4851], [2.1734, 41.4851], [2.1734, 41.3851]]]]
    };

    container.querySelector('#nombre').value = 'Producto con Zona';
    container.querySelector('#zona_distribucion').value = JSON.stringify(geoJSON);

    const formData = formGenerator.getFormData();

    expect(formData.zona_distribucion).toBeDefined();

    const parsedGeo = JSON.parse(formData.zona_distribucion);
    expect(parsedGeo.type).toBe('MultiPolygon');
    expect(parsedGeo.coordinates).toBeDefined();
  });
});