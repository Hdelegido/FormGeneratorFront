import { vi } from 'vitest';

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: localStorageMock });

// Mock de fetch
global.fetch = vi.fn();

// Mock de performance
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn()
  }
});

// Mock de matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock básico de Leaflet
global.L = {
  map: vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn()
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  FeatureGroup: vi.fn().mockImplementation(() => ({
    addTo: vi.fn(),
    addLayer: vi.fn(),
    clearLayers: vi.fn(),
    toGeoJSON: vi.fn(() => ({ features: [] }))
  })),
  geoJSON: vi.fn(() => ({
    addTo: vi.fn(),
    getBounds: vi.fn(() => ({ isValid: () => true }))
  })),
  Draw: {
    Polygon: vi.fn().mockImplementation(() => ({ enable: vi.fn() })),
    Event: { CREATED: 'draw:created' }
  }
};

// Helpers para tests
export function createTestContainer() {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
}

export function cleanupTestContainer(container) {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

export function createTestSchema(fields = {}) {
  return {
    title: 'Test Form',
    type: 'object',
    properties: {
      nombre: { type: 'string', title: 'Nombre' },
      email: { type: 'string', format: 'email', title: 'Email' },
      ...fields
    },
    required: ['nombre']
  };
}

// Cleanup después de cada test
afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  localStorageMock.clear();
  
  // Limpiar estilos dinámicos
  const dynamicStyles = document.head.querySelectorAll('style[id^="form-generator-styles"]');
  dynamicStyles.forEach(style => style.remove());
  
  // Limpiar mapas
  if (window.mapInstances) {
    Object.values(window.mapInstances).forEach(mapInstance => {
      if (mapInstance && mapInstance.remove) {
        mapInstance.remove();
      }
    });
    window.mapInstances = {};
  }
});
