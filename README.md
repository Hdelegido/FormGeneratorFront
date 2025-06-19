# FormGenerator - Dynamic Form Generation Library

[![npm version](https://badge.fury.io/js/hdelegido-form-generator.svg)](https://badge.fury.io/js/hdelegido-form-generator)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![JSON Schema](https://img.shields.io/badge/JSON%20Schema-Draft%207-4A90E2?style=flat-square)](https://json-schema.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> A powerful JavaScript library for generating dynamic and interactive forms from JSON schemas, with seamless Django backend integration.

## 🎯 Key Features

FormGenerator automatically transforms your Django models into beautiful, interactive forms without manual configuration. It handles complex relationships, provides real-time validation, and includes specialized support for geospatial data with interactive maps.

- **🚀 Zero Configuration**: Automatically generates forms from Django models
- **🎨 Beautiful Themes**: Light/dark themes with full customization support  
- **🗺️ Geospatial Support**: Built-in interactive maps for location data
- **🔗 Smart Relationships**: Handles ForeignKey, ManyToMany, and polymorphic fields
- **✅ Live Validation**: Real-time validation with contextual error messages
- **📱 Mobile Ready**: Responsive design that works on all devices
- **♿ Accessible**: WCAG 2.1 AA compliant out of the box

## 📋 Prerequisites

**Important**: FormGenerator requires a Django backend with REST API endpoints. The library connects to your Django server to automatically fetch model schemas and handle form submissions.

**Required Backend Setup:**
- Django 3.2+ with Django REST Framework
- CORS enabled for cross-origin requests
- Schema generation endpoints (see Backend Setup section)

**Browser Support:** Chrome 60+, Firefox 55+, Safari 12+, Edge 79+

## 🚀 Installation

```bash
npm install hdelegido-form-generator
```

## 💻 Quick Start

### Basic Usage
FormGenerator works by connecting to your Django backend to automatically generate forms. Here's the simplest setup:

```javascript
import FormGenerator from 'hdelegido-form-generator';

const formGenerator = new FormGenerator({
    model: 'client',                              // Your Django model name
    container: document.getElementById('form-container'),
    apiConfig: {
        baseUrl: 'http://localhost:8000'          // Your Django server URL
    },
    onSubmitSuccess: (response) => {
        alert('Form submitted successfully!');
    }
});

formGenerator.renderForm(); // That's it! Form is ready
```

### Edit Existing Records
To edit existing data, simply enable edit mode and provide the record ID:

```javascript
const editForm = new FormGenerator({
    model: 'client',
    container: document.getElementById('edit-container'),
    editMode: true,
    editId: 123,                                  // ID of record to edit
    initialData: { name: 'John', email: 'john@example.com' },
    apiConfig: { baseUrl: 'http://localhost:8000' }
});
```

## 🎨 Customization

### Theme Options
FormGenerator includes beautiful predefined themes that automatically adapt to your brand:

```javascript
const formGenerator = new FormGenerator({
    model: 'product',
    container: document.getElementById('container'),
    theme: 'dark',                                // 'light' or 'dark'
    options: {
        showThemeToggle: true                     // Let users switch themes
    }
});
```

### Custom Styling
You can override any visual aspect using the `customStyles` parameter:

```javascript
const customStyles = {
    '.form-group': {
        'border-radius': '12px',
        'box-shadow': '0 4px 6px rgba(0,0,0,0.1)'
    }
};

const formGenerator = new FormGenerator({
    model: 'client',
    container: document.getElementById('container'),
    customStyles: customStyles
});
```

## 🔧 Configuration Options

FormGenerator's constructor accepts many options to customize behavior:

### Core Parameters
- **`model`** (string): Name of your Django model (e.g., 'client', 'product')
- **`container`** (HTMLElement): DOM element where the form will be rendered
- **`apiConfig.baseUrl`** (string): URL of your Django backend server

### Data Management
- **`editMode`** (boolean): Set to `true` for editing existing records
- **`editId`** (number): ID of the record to edit (when `editMode` is true)
- **`initialData`** (object): Pre-fill form fields with this data

### Event Handling
- **`onSubmitSuccess`** (function): Called when form submission succeeds
- **`onSubmitError`** (function): Called when form submission fails
- **`onCancel`** (function): Called when user clicks cancel button

### Visual Customization
- **`theme`** (string): Choose 'light' or 'dark' theme
- **`customStyles`** (object): Override CSS styles with custom values
- **`customTheme`** (object): Define custom color palette

### Advanced Options
- **`options.debug`** (boolean): Enable detailed console logging
- **`options.showThemeToggle`** (boolean): Show theme switcher button
- **`options.i18n`** (string): Language code ('en', 'es', 'ca')

## 🗺️ Geospatial Fields

FormGenerator automatically detects geospatial fields in your Django models and renders them as interactive maps with drawing tools. No additional configuration needed!

```python
# Your Django model
class Location(models.Model):
    name = models.CharField(max_length=100)
    area = models.MultiPolygonField()  # Automatically becomes an interactive map
```

The generated form will include a full-featured map interface with polygon drawing tools, powered by Leaflet.js.

## 🔄 Backend Setup

Your Django backend needs these endpoints for FormGenerator to work:

```python
# urls.py
urlpatterns = [
    path('api/schema/<str:model>/', SchemaView.as_view()),
    path('api/create/<str:model>/', CreateView.as_view()),
    path('api/update/<str:model>/<int:pk>/', UpdateView.as_view()),
]
```

**CORS Configuration** (required):
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Your frontend URL
]
```

## 🔄 Custom Callbacks

Instead of using API endpoints, you can provide custom functions to handle form operations:

```javascript
const formGenerator = new FormGenerator({
    model: 'client',
    container: document.getElementById('container'),
    callbacks: {
        createObject: async (formData) => {
            // Your custom save logic here
            return await myCustomSaveFunction(formData);
        },
        updateObject: async (formData, recordId) => {
            // Your custom update logic here
            return await myCustomUpdateFunction(formData, recordId);
        }
    }
});
```

## 🐛 Troubleshooting

### "Cannot load schema" Error
- Verify your Django server is running at the specified `baseUrl`
- Check that CORS is properly configured in Django settings
- Ensure your model name matches exactly (case-sensitive)

### Form Not Rendering
- Make sure the container element exists in the DOM
- Check browser console for JavaScript errors
- Try enabling debug mode: `options: { debug: true }`

### Styling Issues
- Ensure you're not overriding FormGenerator's CSS classes
- Use `customStyles` parameter instead of external CSS when possible
- Check that your custom theme colors are valid CSS values

## 📚 Examples

The library includes several complete examples in the repository:
- Basic form creation and submission
- Edit mode with pre-filled data
- Custom theme implementation
- Geospatial field handling
- Callback-based operation (no API)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with modern JavaScript ES6+ modules
- Powered by JSON Schema Draft 7 standard
- Geospatial features thanks to Leaflet.js
- Validation system inspired by Django Forms

---

**FormGenerator** - Making dynamic forms simple and beautiful.