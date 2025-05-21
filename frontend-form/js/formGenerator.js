/**
 * FormGenerator - Biblioteca per a la generació dinàmica de formularis
 * @author Hector del Egido Gonzalez
 */
export default class FormGenerator {
    constructor({
                    schema,
                    model,
                    container,
                    initialData = {},
                    editMode = false,
                    editId = null,
                    onSubmitSuccess,
                    onSubmitError,
                    onCancel,
                    theme = 'light',
                    customStyles = null,
                    customTheme = null,
                    options = {},
                    apiConfig = {},
                    callbacks = {},
                }) {
        this.schema = schema;
        this.model = model;
        this.container = container;
        this.initialData = initialData || {};
        this.editMode = editMode;
        this.editId = editId;
        this.onSubmitSuccess = onSubmitSuccess;
        this.onSubmitError = onSubmitError;
        this.onCancel = onCancel;
        this.form = null;
        this.validators = {};
        this.dependentFields = {};

        // Opciones de personalización de tema y estilo
        this.theme = theme; // 'light' o 'dark'
        this.customStyles = customStyles; // CSS personalizado
        this.customTheme = customTheme; // Colores personalizados

        // Opciones adicionales
        this.options = {
            debug: options.debug || false,
            showThemeToggle: options.showThemeToggle || false,
            showPreview: options.showPreview || false,
            i18n: options.i18n || 'es'
        };

        this.apiConfig = {
            baseUrl: '',
            endpoints: {
                create: model => `${apiConfig.baseUrl || ''}/api/create/${model}/`,
                update: (model, id) => `${apiConfig.baseUrl || ''}/api/update/${model}/${id}/`,
                getContentTypeObjects: ctId => `${apiConfig.baseUrl || ''}/api/content-type-objects/${ctId}/`,
            },
            headers: {
                'Content-Type': 'application/json',
            },
            ...apiConfig
        };

        this.callbacks = {
            createObject: null,
            updateObject: null,
            loadContentTypeObjects: null,
            ...callbacks
        };

        if (window.localStorage && !theme) {
            const savedTheme = localStorage.getItem('formGeneratorTheme');
            if (savedTheme) {
                this.theme = savedTheme;
            }
        }
    }

    /**
     * Realiza peticiones API o usa callbacks según configuración
     */
    async apiRequest(action, options = {}) {
        // Si hay callback definido para esta acción, usarlo
        if (this.callbacks[action] && typeof this.callbacks[action] === 'function') {
            if (this.options.debug) {
                console.log(`FormGenerator: Usando callback para ${action}`);
            }
            return await this.callbacks[action](options.data, options.params);
        }

        // Si no hay callback, usar fetch con la API configurada
        try {
            if (this.options.debug) {
                console.log(`FormGenerator: Petición API ${action} a ${options.url}`);
            }

            const response = await fetch(options.url, {
                method: options.method || 'GET',
                headers: this.apiConfig.headers,
                body: options.data ? JSON.stringify(options.data) : undefined
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en la petición');
            }

            return await response.json();
        } catch (error) {
            console.error(`Error en apiRequest (${action}):`, error);
            throw error;
        }
    }

    /**
     * Renderiza el formulario completo
     */
    renderForm() {
        this.container.innerHTML = ''; //Netejo qualsevol contingut previ
        this.form = document.createElement('form'); //Creo l'element form
        this.form.classList.add('generated-form'); // Afegeixo les classes CSS

        // Añadir clase específica para este formulario (para ámbito de estilos)
        this.form.classList.add(`form-${this.model}`);

        // Aplicar tema si está configurado
        if (this.theme) {
            this.form.classList.add(`theme-${this.theme}`);
        }

        //Afegeixo, si hi ha, títol i descripció
        if (this.schema.title) {
            const formTitle = document.createElement('h3');
            formTitle.textContent = this.schema.title;
            formTitle.className = 'form-schema-title';
            this.form.appendChild(formTitle);
        }

        if (this.schema.description) {
            const formDescription = document.createElement('p');
            formDescription.textContent = this.schema.description;
            formDescription.className = 'form-schema-description';
            this.form.appendChild(formDescription);
        }

        //Creo els contenidors per als camps del formulari
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'form-fields-container';
        this.form.appendChild(fieldsContainer);

        // También necesitas inicializar propiedades para los grupos
        this.fieldGroups = this.schema.fieldGroups || [];
        this.expandedGroups = new Set(); // Para rastrear qué grupos están expandidos

        // Inicializar grupos expandidos
        if (this.fieldGroups.length > 0) {
            this.fieldGroups.forEach(group => {
                if (group.expanded) {
                    this.expandedGroups.add(group.id);
                }
            });
        }

        // Decidir si usar grupos o no según el esquema
        if (this.fieldGroups.length > 0) {
            this.buildFieldGroups(fieldsContainer);
        } else {
            //Construeixo els camps de forma tradicional si no hay grupos
            this.buildFields(this.schema, fieldsContainer);
        }

        // Añadir botón para cambiar tema si la opción está habilitada
        if (this.theme && this.options && this.options.showThemeToggle) {
            this.addThemeToggleButton();
        }

        this.addSubmitButtons();
        this.container.appendChild(this.form);
        this.setupValidation();
        this.initDependentFields();

        // Aplicar estilos personalizados si existen
        if (this.customStyles) {
            this.applyCustomStyles(this.customStyles);
        }

        // Aplicar tema personalizado si existe
        if (this.customTheme) {
            this.applyCustomTheme(this.customTheme);
        }
    }

    /**
     * Inicializa los campos que dependen de otros
     */
    initDependentFields() {
        const properties = this.schema.properties || {};

        // Buscar campos que dependen de otros
        for (const key in properties) {
            const field = properties[key];

            if (field.dependsOn) {
                this.dependentFields[key] = field.dependsOn;
                const dependentOnField = document.getElementById(field.dependsOn);

                if (dependentOnField) {
                    // Cuando cambie el valor del campo principal, actualizar el dependiente
                    dependentOnField.addEventListener('change', async () => {
                        await this.updateDependentField(key, field.dependsOn, dependentOnField.value);
                    });

                    // Si hay valor inicial, actualizar el dependiente
                    if (dependentOnField.value) {
                        // Ejecutar de forma asíncrona para asegurar que el DOM está listo
                        setTimeout(async () => {
                            await this.updateDependentField(key, field.dependsOn, dependentOnField.value);

                            // Si hay valor inicial para el campo dependiente, seleccionarlo
                            if (this.initialData && this.initialData[key]) {
                                const dependentField = document.getElementById(key);
                                if (dependentField) {
                                    dependentField.value = this.initialData[key];
                                }
                            }
                        }, 100);
                    }
                }
            }

            // Caso especial: ContentType para modelos polimórficos
            if (field.isContentTypeField) {
                const contentTypeField = document.getElementById(key);

                if (contentTypeField) {
                    contentTypeField.addEventListener('change', async () => {
                        // Buscar el campo object_id relacionado
                        const objectIdField = document.getElementById('object_id');
                        if (objectIdField) {
                            await this.loadObjectOptionsForContentType(contentTypeField.value, objectIdField);
                        }
                    });

                    // Si hay valor inicial, cargar opciones
                    if (contentTypeField.value && this.initialData.object_id) {
                        setTimeout(async () => {
                            const objectIdField = document.getElementById('object_id');
                            if (objectIdField) {
                                await this.loadObjectOptionsForContentType(contentTypeField.value, objectIdField);
                                objectIdField.value = this.initialData.object_id;
                            }
                        }, 100);
                    }
                }
            }
        }

        // Verificar si este es un modelo polimórfico
        if (this.schema.isPolymorphic) {
            console.log('Modelo polimórfico detectado:', this.schema.polymorphicField);
        }
    }

    /**
     * Carga opciones para un campo object_id según el content_type seleccionado
     */
    async loadObjectOptionsForContentType(contentTypeId, selectField) {
        if (!contentTypeId || !selectField) return;

        try {
            selectField.disabled = true;
            selectField.innerHTML = '<option value="">Cargando...</option>';

            if (this.options.debug) {
                console.log(`FormGenerator: Cargando objetos para content_type ${contentTypeId}`);
            }

            // NUEVO: Usar el método apiRequest en vez de fetch directo
            const url = this.apiConfig.endpoints.getContentTypeObjects(contentTypeId);
            const objects = await this.apiRequest('loadContentTypeObjects', {
                url,
                method: 'GET',
                params: {contentTypeId}
            });

            // Resto igual que antes
            selectField.innerHTML = '<option value="">-- Seleccionar --</option>';

            objects.forEach(obj => {
                const option = document.createElement('option');
                option.value = obj.id;
                option.textContent = obj.text;
                selectField.appendChild(option);
            });

            selectField.value = '';

        } catch (error) {
            console.error('Error cargando objetos:', error);

            const errorDiv = document.getElementById(`error-object_id`);
            if (errorDiv) {
                errorDiv.textContent = 'Error al cargar opciones: ' + error.message;
                errorDiv.classList.remove('hidden');
            }
        } finally {
            selectField.disabled = false;
            const loadingIndicator = selectField.parentNode.querySelector('.loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
    }

    /**
     * Actualiza un campo dependiente
     */
    async updateDependentField(fieldKey, dependsOnKey, dependsOnValue) {
        if (dependsOnKey === 'content_type' && fieldKey === 'object_id') {
            const objectIdField = document.getElementById('object_id');
            if (objectIdField) {
                await this.loadObjectOptionsForContentType(dependsOnValue, objectIdField);
            }
        }
    }

    isSelectField(field) {
        // Para campos anyOf que son solo para permitir null
        if (Array.isArray(field.anyOf) && field.anyOf.length === 2) {
            const hasNullType = field.anyOf.some(item => item.type === 'null');
            const hasBasicType = field.anyOf.some(item =>
                ['string', 'number', 'integer'].includes(item.type)
            );

            if (hasNullType && hasBasicType) {
                // No es un select, es un campo básico que permite null
                return false;
            }
        }

        // Verificar si es referencia a enum o definición
        if (field.anyOf && field.anyOf.some(item => item.$ref)) {
            // Verificar si la referencia es a un enum o a un objeto
            const hasEnumRef = field.anyOf.some(item =>
                item.$ref && (item.$ref.includes('ValidationLevel') || item.$ref.includes('CropClass'))
            );

            if (hasEnumRef) {
                return true; // Es un select (referencia a enum)
            }
        }

        // Casos tradicionales
        return (
            Array.isArray(field.enum) ||
            field.format === 'select' ||
            (Array.isArray(field.anyOf) && field.anyOf.some(item => 'const' in item)) ||
            field.isContentTypeField ||
            (field.type === 'string' && field['x-enum-labels'])
        );
    }

    /**
     * Extrae opciones de un campo de tipo select
     */
    getSelectOptions(field) {
        const options = [];
        const labels = {};

        // Caso 1: Tiene enum tradicional
        if (Array.isArray(field.enum)) {
            field.enum.forEach(value => {
                options.push(value);
                // Usar etiquetas personalizadas si existen
                if (field['x-enum-labels'] && field['x-enum-labels'][value]) {
                    labels[value] = field['x-enum-labels'][value];
                } else {
                    labels[value] = value;
                }
            });
        }
        // Caso 2: Tiene estructura anyOf
        else if (Array.isArray(field.anyOf)) {
            field.anyOf.forEach(option => {
                if ('const' in option) {
                    const value = option.const;
                    options.push(value);
                    labels[value] = option.title || value;
                }
            });
        }

        return {options, labels};
    }


    buildFields(schema, wrapper) {
        const properties = schema.properties || {};
        const required = schema.required || [];

        // Creamos un grid para mejor organización de campos
        const grid = document.createElement('div');
        grid.className = 'form-fields-grid';
        wrapper.appendChild(grid);

        // Verificar si es un modelo polimórfico
        let isPolymorphic = schema.isPolymorphic || false;
        let contentTypeField = schema.contentTypeField || null;
        let objectIdField = schema.objectIdField || null;

        // Si es polimórfico, añadir una clase al grid
        if (isPolymorphic) {
            grid.classList.add('polymorphic-form');
            console.log(`Formulario polimórfico detectado: ${contentTypeField} -> ${objectIdField}`);
        }

        for (const key in properties) {
            const field = properties[key];
            // Garantizar valor inicial seguro
            const value = this.initialData && this.initialData[key] !== undefined ? this.initialData[key] : '';
            const isRequired = required.includes(key);

            const group = document.createElement('div');
            group.classList.add('form-group');

            // Añadir clases según tipo de campo para estilizado flexible
            if (field.type) {
                group.classList.add(`field-type-${field.type}`);
            }

            // Clases especiales para campos polimórficos
            if (isPolymorphic && (key === contentTypeField || key === objectIdField)) {
                group.classList.add('polymorphic-field');

                if (key === contentTypeField) {
                    group.classList.add('content-type-field');
                }

                if (key === objectIdField) {
                    group.classList.add('object-id-field');

                    // Si aún no hay content_type seleccionado, ocultar este campo
                    if (!this.initialData[contentTypeField]) {
                        group.classList.add('initially-hidden');
                    }
                }
            }

            if (isRequired) {
                group.classList.add('field-required');
            }

            // Label con icono según tipo de campo
            const label = document.createElement('label');
            label.htmlFor = key;

            // Icono según tipo de dato
            let iconClass = '';

            // Determinar el icono según el tipo o formato
            if (this.isSelectField(field)) {
                iconClass = 'fa-list';
            } else if (field.format === 'email') {
                iconClass = 'fa-envelope';
            } else if (field.format === 'date' || field.format === 'date-time') {
                iconClass = 'fa-calendar';
            } else if (field.format === 'textarea') {
                iconClass = 'fa-paragraph';
            } else if (field.format === 'switch' || field.type === 'boolean') {
                iconClass = 'fa-toggle-on';
            } else if (field.format === 'multiselect' || field.isManyToMany) {
                iconClass = 'fa-th-list';
            } else {
                switch (field.type) {
                    case 'string':
                        iconClass = 'fa-font';
                        break;
                    case 'number':
                    case 'integer':
                        iconClass = 'fa-hashtag';
                        break;
                    case 'object':
                        iconClass = 'fa-cube';
                        break;
                    case 'array':
                        iconClass = 'fa-list-ul';
                        break;
                    default:
                        iconClass = 'fa-keyboard';
                }
            }

            // Crear etiqueta con icono y texto
            label.innerHTML = `
        <i class="fas ${iconClass} field-icon"></i>
        <span>${field.title || this.humanizeFieldName(key)}</span>
        ${isRequired ? '<span class="required-asterisk">*</span>' : ''}
      `;

            group.appendChild(label);

            // Crear el input según el tipo
            let input;

            // Determinar el tipo de campo según schema
            if (field.format === 'multiselect' || field.isManyToMany) {
                input = this.createMultiselectField(key, field, value);
            } else if (this.isSelectField(field)) {
                input = this.createSelectField(key, field, value);

                // Si es un campo content_type, añadimos clase especial
                if (field.isContentTypeField) {
                    input.classList.add('content-type-selector');
                }

                // Si es un campo que depende de otro, añadimos clase especial
                if (field.dependsOn) {
                    input.classList.add('dependent-field');
                    input.dataset.dependsOn = field.dependsOn;
                }
            } else if (field.format === 'switch' || field.type === 'boolean') {
                input = this.createBooleanField(key, field, value);
            } else if (field.format === 'date-time' || field.format === 'date') {
                input = this.createDateField(key, field, value);
            } else if (field.type === 'integer' || field.type === 'number') {
                input = this.createNumberField(key, field, value);
            } else if (field.format === 'email') {
                input = this.createEmailField(key, field, value);
            } else if (field.format === 'textarea' ||
                (field.type === 'string' && field.maxLength && field.maxLength > 255)) {
                input = this.createTextareaField(key, field, value);
            } else {
                input = this.createTextField(key, field, value);
            }

            // Atributos comunes para todos los campos
            if (input) {
                input.id = key;
                input.name = key;
                input.dataset.field = key;

                if (isRequired && input.tagName !== 'DIV') { // No aplicar required a contenedores
                    input.required = true;
                }

                if (field.description) {
                    input.title = field.description;
                }

                // Aplicar eventos de validación (excepto en switches y multiselect)
                if (input.tagName !== 'DIV' && !input.multiple) {
                    input.addEventListener('input', () => this.validateField(key, input.value));
                    input.addEventListener('blur', () => this.validateField(key, input.value, true));
                }
            }

            // Contenedor para input y posibles elementos auxiliares
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-container';

            // Si es un campo dependiente, añadimos indicador
            if (field.dependsOn) {
                inputContainer.classList.add('dependent-container');

                const dependencyIndicator = document.createElement('div');
                dependencyIndicator.className = 'dependency-indicator';
                dependencyIndicator.innerHTML = `<i class="fas fa-link"></i>`;
                dependencyIndicator.title = `Este campo depende de ${this.humanizeFieldName(field.dependsOn)}`;

                inputContainer.appendChild(dependencyIndicator);
            }

            inputContainer.appendChild(input);

            // Añadir botón de limpiar para campos simples (no para multiselect o switch)
            if (input.tagName === 'INPUT' && ['text', 'email', 'number'].includes(input.type)) {
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'clear-input-btn';
                clearBtn.innerHTML = '<i class="fas fa-times"></i>';
                clearBtn.title = 'Limpiar';
                clearBtn.addEventListener('click', () => {
                    input.value = '';
                    input.focus();
                    this.validateField(key, '');
                });
                inputContainer.appendChild(clearBtn);
            }

            group.appendChild(inputContainer);

            // Mensaje de error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error hidden';
            errorDiv.id = `error-${key}`;
            group.appendChild(errorDiv);

            // Texto de ayuda para el campo
            if (field.description) {
                const helpText = document.createElement('div');
                helpText.className = 'field-help-text';
                helpText.innerHTML = `<i class="fas fa-info-circle"></i> ${field.description}`;
                group.appendChild(helpText);
            }

            // Para multiselect, añadimos una ayuda adicional
            if (field.format === 'multiselect' || field.isManyToMany) {
                const multiSelectHelp = document.createElement('div');
                multiSelectHelp.className = 'field-help-text';
                multiSelectHelp.innerHTML = `<i class="fas fa-info-circle"></i> Presiona Ctrl (o Cmd en Mac) para seleccionar múltiples opciones`;
                group.appendChild(multiSelectHelp);
            }

            grid.appendChild(group);
        }
    }

    buildFieldGroups(wrapper) {
        // Crear un elemento para campos que no pertenecen a ningún grupo
        const ungroupedFields = new Set(Object.keys(this.schema.properties || {}));

        // Recorrer todos los grupos definidos
        this.fieldGroups.forEach(group => {
            // Crear contenedor para el grupo
            const groupContainer = document.createElement('div');
            groupContainer.className = 'field-group';
            groupContainer.dataset.groupId = group.id;

            // Aplicar color personalizado si está definido
            if (group.color) {
                groupContainer.style.setProperty('--group-accent-color', group.color);
            }

            // Título con toggle e icono
            const header = document.createElement('div');
            header.className = 'group-header';

            // Icono según estado (expandido/colapsado)
            const isExpanded = this.expandedGroups.has(group.id);
            const iconClass = isExpanded ? 'fa-chevron-up' : 'fa-chevron-down';

            // Crear título con icono personalizado
            header.innerHTML = `
            <h4>
                ${group.icon ? `<i class="fas ${group.icon} group-icon"></i>` : ''}
                ${group.title}
            </h4>
            <button type="button" class="group-toggle">
                <i class="fas ${iconClass}"></i>
            </button>
        `;

            // Contenedor para los campos
            const fieldsContainer = document.createElement('div');
            fieldsContainer.className = 'group-fields';

            // Aplicar visibilidad inicial
            if (!isExpanded) {
                fieldsContainer.style.display = 'none';
            }

            // Recorrer campos de este grupo y construirlos
            const validFields = (group.fields || []).filter(fieldName =>
                this.schema.properties && this.schema.properties[fieldName]);

            // Grid para organizar campos dentro del grupo
            const groupGrid = document.createElement('div');
            groupGrid.className = 'form-fields-grid';
            fieldsContainer.appendChild(groupGrid);

            // Construir cada campo del grupo
            validFields.forEach(fieldName => {
                this.buildField(
                    fieldName,
                    this.schema.properties[fieldName],
                    this.initialData[fieldName],
                    groupGrid,
                    this.schema.required || []
                );

                // Eliminar de campos sin grupo
                ungroupedFields.delete(fieldName);
            });

            // Añadir elementos al DOM
            groupContainer.appendChild(header);
            groupContainer.appendChild(fieldsContainer);
            wrapper.appendChild(groupContainer);

            // Configurar toggle
            header.querySelector('.group-toggle').addEventListener('click', (e) => {
                const button = e.currentTarget;
                const icon = button.querySelector('i');
                const fields = groupContainer.querySelector('.group-fields');

                if (fields.style.display === 'none') {
                    fields.style.display = 'block';
                    icon.className = 'fas fa-chevron-up';
                    this.expandedGroups.add(group.id);
                } else {
                    fields.style.display = 'none';
                    icon.className = 'fas fa-chevron-down';
                    this.expandedGroups.delete(group.id);
                }
            });
        });

        // Si quedan campos sin agrupar, mostrarlos en un grupo "Otros campos"
        if (ungroupedFields.size > 0) {
            const otherGroup = document.createElement('div');
            otherGroup.className = 'field-group other-fields-group';

            const otherHeader = document.createElement('div');
            otherHeader.className = 'group-header';
            otherHeader.innerHTML = `
            <h4><i class="fas fa-ellipsis-h"></i> Otros campos</h4>
            <button type="button" class="group-toggle">
                <i class="fas fa-chevron-down"></i>
            </button>
        `;

            const otherFields = document.createElement('div');
            otherFields.className = 'group-fields';
            otherFields.style.display = 'none';

            const otherGrid = document.createElement('div');
            otherGrid.className = 'form-fields-grid';
            otherFields.appendChild(otherGrid);

            // Construir campos sin grupo
            ungroupedFields.forEach(fieldName => {
                this.buildField(
                    fieldName,
                    this.schema.properties[fieldName],
                    this.initialData[fieldName],
                    otherGrid,
                    this.schema.required || []
                );
            });

            otherGroup.appendChild(otherHeader);
            otherGroup.appendChild(otherFields);
            wrapper.appendChild(otherGroup);

            // Configurar toggle para "Otros"
            otherHeader.querySelector('.group-toggle').addEventListener('click', (e) => {
                const button = e.currentTarget;
                const icon = button.querySelector('i');
                const fields = otherGroup.querySelector('.group-fields');

                if (fields.style.display === 'none') {
                    fields.style.display = 'block';
                    icon.className = 'fas fa-chevron-up';
                } else {
                    fields.style.display = 'none';
                    icon.className = 'fas fa-chevron-down';
                }
            });
        }
    }

    /**
     * Construye un campo de formulario individual
     * @param {string} fieldName - Nombre del campo
     * @param {Object} fieldSchema - Esquema/definición del campo
     * @param {any} value - Valor inicial del campo
     * @param {HTMLElement} container - Contenedor donde se añadirá el campo
     * @param {Array<string>} requiredFields - Lista de campos requeridos
     */
    buildField(fieldName, fieldSchema, value, container, requiredFields = []) {
        const isRequired = requiredFields.includes(fieldName);

        // Crear contenedor para el grupo de formulario
        const group = document.createElement('div');
        group.classList.add('form-group');
        group.dataset.field = fieldName; // Para facilitar la selección por campo

        // Detectar el tipo específico del campo
        const fieldType = this.detectFieldType(fieldName, fieldSchema);

        // Añadir clases según tipo de campo para estilizado flexible
        group.classList.add(`field-type-${fieldType}`);

        if (fieldSchema.type) {
            group.classList.add(`field-datatype-${fieldSchema.type}`);
        }

        if (isRequired) {
            group.classList.add('field-required');
        }

        // Si el campo tiene dependencias, marcarlo
        if (fieldSchema.dependsOn) {
            group.classList.add('field-dependent');
            group.dataset.dependsOn = fieldSchema.dependsOn;
        }

        // Crear label con icono apropiado
        const label = this.createFieldLabel(fieldName, fieldSchema, isRequired);
        group.appendChild(label);

        // Crear el input según el tipo específico detectado
        let input;

        switch (fieldType) {
            case 'map':
                input = this.createMapField(fieldName, fieldSchema, value);
                break;
            case 'file':
            case 'image':
                input = this.createFileField(fieldName, fieldSchema, value);
                break;
            case 'multiselect':
                input = this.createMultiselectField(fieldName, fieldSchema, value);
                break;
            case 'select':
                input = this.createSelectField(fieldName, fieldSchema, value);
                break;
            case 'boolean':
                input = this.createBooleanField(fieldName, fieldSchema, value);
                break;
            case 'date':
            case 'datetime':
                input = this.createDateField(fieldName, fieldSchema, value);
                break;
            case 'number':
            case 'integer':
                input = this.createNumberField(fieldName, fieldSchema, value);
                break;
            case 'email':
                input = this.createEmailField(fieldName, fieldSchema, value);
                break;
            case 'textarea':
                input = this.createTextareaField(fieldName, fieldSchema, value);
                break;
            case 'color':
                input = this.createColorField(fieldName, fieldSchema, value);
                break;
            case 'range':
                input = this.createRangeField(fieldName, fieldSchema, value);
                break;
            case 'password':
                input = this.createPasswordField(fieldName, fieldSchema, value);
                break;
            default:
                // Intentar usar un widget personalizado si está registrado
                if (this.customWidgets && this.customWidgets[fieldType]) {
                    input = this.customWidgets[fieldType](fieldName, fieldSchema, value, this);
                } else {
                    // Por defecto, crear un campo de texto
                    input = this.createTextField(fieldName, fieldSchema, value);
                }
        }

        // Configurar atributos comunes para el input
        if (input) {
            // ID y nombre para el campo (excepto en contenedores complejos)
            if (input.tagName !== 'DIV' || !input.querySelector('input, select, textarea')) {
                input.id = fieldName;
                input.name = fieldName;
            }

            input.dataset.field = fieldName;

            // Marcar como requerido si aplica (excepto en contenedores)
            if (isRequired && input.tagName !== 'DIV') {
                input.required = true;
            }

            // Añadir título/tooltip con la descripción
            if (fieldSchema.description) {
                input.title = fieldSchema.description;
            }

            // Añadir placeholder si está especificado
            if (fieldSchema.placeholder &&
                'placeholder' in input &&
                input.tagName !== 'DIV') {
                input.placeholder = fieldSchema.placeholder;
            }

            // Configurar clases especiales
            if (fieldSchema.isContentTypeField) {
                input.classList.add('content-type-selector');
            }

            if (fieldSchema.dependsOn) {
                input.classList.add('dependent-field');
                input.dataset.dependsOn = fieldSchema.dependsOn;
            }

            // Aplicar eventos de validación cuando sea apropiado
            // (excepto en contenedores, switches, multiselects)
            if (input.tagName !== 'DIV' && !input.multiple &&
                fieldType !== 'boolean' && fieldType !== 'multiselect') {
                input.addEventListener('input', () => this.validateField(fieldName, input.value));
                input.addEventListener('blur', () => this.validateField(fieldName, input.value, true));

                // Validación asíncrona si está configurada
                if (fieldSchema['x-validate-url']) {
                    input.addEventListener('blur', async () => {
                        await this.validateFieldAsync(fieldName, input.value);
                    });
                }
            }
        }

        // Contenedor para input y elementos auxiliares
        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';

        // Agregar indicador de dependencia si es necesario
        if (fieldSchema.dependsOn) {
            inputContainer.classList.add('dependent-container');

            const dependencyIndicator = document.createElement('div');
            dependencyIndicator.className = 'dependency-indicator';
            dependencyIndicator.innerHTML = `<i class="fas fa-link"></i>`;
            dependencyIndicator.title = `Este campo depende de ${this.humanizeFieldName(fieldSchema.dependsOn)}`;

            inputContainer.appendChild(dependencyIndicator);
        }

        // Añadir el campo al contenedor
        inputContainer.appendChild(input);

        // Añadir botón de limpiar para campos simples
        if (input.tagName === 'INPUT' &&
            ['text', 'email', 'number', 'color', 'password'].includes(input.type)) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'clear-input-btn';
            clearBtn.innerHTML = '<i class="fas fa-times"></i>';
            clearBtn.title = 'Limpiar';
            clearBtn.addEventListener('click', () => {
                input.value = '';
                input.focus();
                this.validateField(fieldName, '');
            });
            inputContainer.appendChild(clearBtn);
        }

        // Añadir el contenedor de input al grupo
        group.appendChild(inputContainer);

        // Contenedor para mensajes de error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error hidden';
        errorDiv.id = `error-${fieldName}`;
        group.appendChild(errorDiv);

        // Texto de ayuda para el campo
        if (fieldSchema.description) {
            const helpText = document.createElement('div');
            helpText.className = 'field-help-text';
            helpText.innerHTML = `<i class="fas fa-info-circle"></i> ${fieldSchema.description}`;
            group.appendChild(helpText);
        }

        // Ayuda adicional específica según el tipo de campo
        if (fieldType === 'multiselect') {
            const multiSelectHelp = document.createElement('div');
            multiSelectHelp.className = 'field-help-text field-type-help';
            multiSelectHelp.innerHTML = `<i class="fas fa-info-circle"></i> Presiona Ctrl (o Cmd en Mac) para seleccionar múltiples opciones`;
            group.appendChild(multiSelectHelp);
        } else if (fieldType === 'map') {
            const mapHelp = document.createElement('div');
            mapHelp.className = 'field-help-text field-type-help';
            mapHelp.innerHTML = `<i class="fas fa-info-circle"></i> Usa las herramientas de dibujo para definir el área`;
            group.appendChild(mapHelp);
        } else if (fieldType === 'file' || fieldType === 'image') {
            const fileHelp = document.createElement('div');
            fileHelp.className = 'field-help-text field-type-help';
            fileHelp.innerHTML = `<i class="fas fa-info-circle"></i> Arrastra archivos o haz clic para seleccionar`;
            group.appendChild(fileHelp);
        }

        // Añadir el grupo completo al contenedor principal
        container.appendChild(group);

        // Configurar validación inicial
        if (value) {
            this.validateField(fieldName, value);
        }

        // Para campos de mapa, inicializar después de que esté en el DOM
        if (fieldType === 'map' && typeof L !== 'undefined') {
            setTimeout(() => {
                this.initializeMapField(fieldName, input, value);
            }, 100);
        }
    }

    /**
     * Detecta el tipo específico de campo basado en el nombre y esquema
     * @param {string} fieldName - Nombre del campo
     * @param {Object} fieldSchema - Esquema del campo
     * @returns {string} - Tipo de campo detectado
     */
    detectFieldType(fieldName, fieldSchema) {
        // 1. Verificar campos especiales por nombre
        if (fieldName === 'polygon' ||
            fieldName.includes('geojson') ||
            fieldName.includes('geometry') ||
            fieldName.includes('map')) {
            return 'map';
        }

        if (fieldName.includes('color') ||
            fieldName.includes('colour') ||
            fieldSchema.format === 'color') {
            return 'color';
        }

        if (fieldName.includes('file') ||
            fieldName.includes('attachment') ||
            fieldSchema.format === 'binary' ||
            fieldSchema.format === 'file') {
            return 'file';
        }

        if (fieldName.includes('image') ||
            fieldName.includes('photo') ||
            fieldName.includes('picture') ||
            fieldSchema.format === 'image') {
            return 'image';
        }

        if (fieldName.includes('password') ||
            fieldSchema.format === 'password') {
            return 'password';
        }

        // 2. Verificar format explícito
        if (fieldSchema.format) {
            switch (fieldSchema.format) {
                case 'multiselect':
                    return 'multiselect';
                case 'select':
                    return 'select';
                case 'switch':
                    return 'boolean';
                case 'date-time':
                    return 'datetime';
                case 'date':
                    return 'date';
                case 'email':
                    return 'email';
                case 'textarea':
                    return 'textarea';
                case 'range':
                    return 'range';
                default:
                    // Si hay un formato pero no coincide con los casos anteriores
                    return fieldSchema.format;
            }
        }

        // 3. Verificar propiedades especiales
        if (fieldSchema.isManyToMany) {
            return 'multiselect';
        }

        if (this.isSelectField(fieldSchema)) {
            return 'select';
        }

        if (fieldSchema.type === 'boolean') {
            return 'boolean';
        }

        // 4. Verificar tipo básico con características especiales
        if (fieldSchema.type === 'string') {
            if (fieldSchema.maxLength && fieldSchema.maxLength > 255) {
                return 'textarea';
            }
            return 'text';
        }

        if (fieldSchema.type === 'integer') {
            return 'integer';
        }

        if (fieldSchema.type === 'number') {
            return 'number';
        }

        // 5. Por defecto, asumir texto
        return 'text';
    }

    /**
     * Crea una etiqueta con icono para un campo
     * @param {string} fieldName - Nombre del campo
     * @param {Object} fieldSchema - Esquema del campo
     * @param {boolean} isRequired - Si el campo es requerido
     * @returns {HTMLElement} - Elemento label
     */
    createFieldLabel(fieldName, fieldSchema, isRequired) {
        const label = document.createElement('label');
        label.htmlFor = fieldName;

        // Determinar el tipo para elegir icono
        const fieldType = this.detectFieldType(fieldName, fieldSchema);

        // Mapeo de tipos a clases de iconos
        const iconMap = {
            'text': 'fa-font',
            'textarea': 'fa-paragraph',
            'number': 'fa-hashtag',
            'integer': 'fa-hashtag',
            'boolean': 'fa-toggle-on',
            'select': 'fa-list',
            'multiselect': 'fa-th-list',
            'email': 'fa-envelope',
            'date': 'fa-calendar',
            'datetime': 'fa-calendar-alt',
            'color': 'fa-palette',
            'file': 'fa-file',
            'image': 'fa-image',
            'map': 'fa-map-marker-alt',
            'password': 'fa-lock',
            'range': 'fa-sliders-h'
        };

        // Obtener icono del mapa o usar uno genérico
        const iconClass = iconMap[fieldType] || 'fa-keyboard';

        // Crear etiqueta con icono y texto
        label.innerHTML = `
        <i class="fas ${iconClass} field-icon"></i>
        <span>${fieldSchema.title || this.humanizeFieldName(fieldName)}</span>
        ${isRequired ? '<span class="required-asterisk">*</span>' : ''}
    `;

        return label;
    }

    /**
     * Añade los botones de enviar y cancelar al formulario
     */
    addSubmitButtons() {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'form-buttons-container';

        // Botón Cancelar
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'cancel-btn btn';
        cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        cancelButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.onCancel && typeof this.onCancel === 'function') {
                this.onCancel();
            }
        });
        buttonsContainer.appendChild(cancelButton);

        // Botón Enviar
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'submit-btn btn';
        submitButton.innerHTML = this.editMode ?
            '<i class="fas fa-save"></i> Actualizar' :
            '<i class="fas fa-plus"></i> Crear';

        buttonsContainer.appendChild(submitButton);

        this.form.appendChild(buttonsContainer);

        // Configurar evento submit del formulario
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validar todos los campos antes de enviar
            const isValid = this.validateAllFields();

            if (!isValid) {
                console.log('Formulario inválido, no se envía');
                return;
            }

            try {
                const formData = this.getFormData();
                console.log('Datos del formulario a enviar:', formData);

                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

                let result;

                // NUEVO: Usar apiRequest con callbacks o API configurada
                if (this.editMode) {
                    const url = this.apiConfig.endpoints.update(this.model, this.editId);
                    result = await this.apiRequest('updateObject', {
                        url,
                        method: 'PUT',
                        data: formData,
                        params: {id: this.editId, model: this.model}
                    });
                } else {
                    const url = this.apiConfig.endpoints.create(this.model);
                    result = await this.apiRequest('createObject', {
                        url,
                        method: 'POST',
                        data: formData,
                        params: {model: this.model}
                    });
                }

                console.log('Respuesta del servidor:', result);

                if (this.onSubmitSuccess && typeof this.onSubmitSuccess === 'function') {
                    this.onSubmitSuccess(result);
                }
            } catch (error) {
                console.error('Error enviando formulario:', error);

                if (error.response && error.response.data) {
                    this.handleAPIErrors(error.response.data);
                }

                if (this.onSubmitError && typeof this.onSubmitError === 'function') {
                    this.onSubmitError(error);
                }
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = this.editMode ?
                    '<i class="fas fa-save"></i> Actualizar' :
                    '<i class="fas fa-plus"></i> Crear';
            }
        });
    }

    /**
     * Configura la validación del formulario
     */
    setupValidation() {
        const properties = this.schema.properties || {};

        // Configurar validadores para cada campo
        for (const key in properties) {
            const field = properties[key];
            this.validators[key] = this.createValidator(field);
        }
    }

    /**
     * Crea un validador para un campo específico
     */
    createValidator(field) {
        return (value) => {
            // Verificación básica para campos requeridos
            if (!value && field.required) {
                return 'Este campo es obligatorio';
            }

            if (!value) {
                return null; // Campo vacío pero no obligatorio
            }

            // Validación específica según el formato del campo
            if (field.format === 'map' || field.format === 'geojson') {
                try {
                    // Validar GeoJSON básico
                    const geoJson = typeof value === 'string' ? JSON.parse(value) : value;
                    if (!geoJson.type || !geoJson.geometry) {
                        return 'Formato GeoJSON inválido';
                    }
                } catch (e) {
                    return 'Error en formato de datos geográficos';
                }
                return null;
            }

            if (field.format === 'file' || field.format === 'image') {
                const input = document.getElementById(field.name || field.id);
                if (!input) return null;

                // Validar tipo MIME si es necesario
                if (input.files && input.files.length > 0 && field.accept) {
                    const file = input.files[0];
                    const acceptTypes = field.accept.split(',').map(t => t.trim());
                    const isValid = acceptTypes.some(type => {
                        if (type.startsWith('.')) {
                            return file.name.endsWith(type);
                        } else if (type.endsWith('/*')) {
                            const mainType = type.split('/')[0];
                            return file.type.startsWith(mainType + '/');
                        }
                        return file.type === type;
                    });

                    if (!isValid) {
                        return 'Tipo de archivo no permitido';
                    }
                }
                return null;
            }

            // Validación según el tipo de datos
            switch (field.type) {
                case 'string':
                    return this.validateString(value, field);
                case 'number':
                case 'integer':
                    return this.validateNumber(value, field);
                case 'boolean':
                    return null;
                default:
                    return null;
            }
        };
    }

    /**
     * Valida una cadena de texto
     */
    validateString(value, field) {
        if (field.minLength && value.length < field.minLength) {
            return `Debe tener al menos ${field.minLength} caracteres`;
        }

        if (field.maxLength && value.length > field.maxLength) {
            return `Debe tener máximo ${field.maxLength} caracteres`;
        }

        if (field.pattern) {
            const regex = new RegExp(field.pattern);
            if (!regex.test(value)) {
                return field.patternMessage || 'Formato inválido';
            }
        }

        if (field.format === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return 'Email inválido';
            }
        }

        return null;
    }

    /**
     * Valida un número
     */
    validateNumber(value, field) {
        const num = Number(value);

        if (isNaN(num)) {
            return 'Debe ser un número válido';
        }

        if (field.type === 'integer' && !Number.isInteger(num)) {
            return 'Debe ser un número entero';
        }

        if (field.minimum !== undefined && num < field.minimum) {
            return `Debe ser mayor o igual a ${field.minimum}`;
        }

        if (field.maximum !== undefined && num > field.maximum) {
            return `Debe ser menor o igual a ${field.maximum}`;
        }

        return null;
    }

    /**
     * Valida un campo específico
     */
    validateField(key, value, showError = false) {
        const validator = this.validators[key];

        if (!validator) {
            return true;
        }

        const error = validator(value);
        const errorDiv = document.getElementById(`error-${key}`);
        const inputElement = document.getElementById(key);

        if (errorDiv) {
            if (error && showError) {
                errorDiv.textContent = error;
                errorDiv.classList.remove('hidden');

                if (inputElement) {
                    inputElement.classList.add('invalid-input');
                }
            } else {
                errorDiv.textContent = '';
                errorDiv.classList.add('hidden');

                if (inputElement) {
                    inputElement.classList.remove('invalid-input');
                }
            }
        }

        return !error;
    }

    /**
     * Valida todos los campos del formulario
     */
    validateAllFields() {
        const properties = this.schema.properties || {};
        let isValid = true;

        for (const key in properties) {
            const input = document.getElementById(key);
            const value = input ? input.value : '';

            if (!this.validateField(key, value, true)) {
                isValid = false;
            }
        }

        return isValid;
    }

    /**
     * Obtiene los datos del formulario
     */
    getFormData() {
        const formData = {};
        const properties = this.schema.properties || {};

        for (const key in properties) {
            const field = properties[key];
            const input = document.getElementById(key);

            if (!input) continue;

            let value;

            if (field.type === 'boolean') {
                // Para campos booleanos, verificar si está marcado
                if (input.tagName === 'DIV') {
                    // Si es un switch personalizado
                    const checkbox = input.querySelector('input[type="checkbox"]');
                    value = checkbox ? checkbox.checked : false;
                } else {
                    // Si es un checkbox normal
                    value = input.checked;
                }
            } else if (field.format === 'multiselect' || field.isManyToMany) {
                // Para campos de selección múltiple
                const selectedOptions = Array.from(input.selectedOptions);
                value = selectedOptions.map(option => option.value);
            } else if (field.type === 'number' || field.type === 'integer') {
                // Convertir a número si el campo no está vacío
                value = input.value !== '' ? Number(input.value) : null;
            } else {
                // Valor normal para otros tipos
                value = input.value;
            }
            if (value !== undefined && value !== '' && value !== null) {
                formData[key] = value;
            } else if (field.required) {
                formData[key] = field.type === 'string' ? '' : null;
            } else if (field.format === 'file' || field.format === 'image') {
                const fileInput = document.getElementById(key);
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    if (this.options.useFormData) {
                        formData[key] = fileInput.files;
                    } else {
                        formData[key] = value;
                    }
                }
            }
        }

        return formData;
    }

    /**
     * Maneja errores devueltos por la API
     */
    handleAPIErrors(errorData) {
        if (!errorData) return;

        // Para errores genéricos del formulario
        if (errorData.non_field_errors) {
            const message = Array.isArray(errorData.non_field_errors)
                ? errorData.non_field_errors.join('. ')
                : errorData.non_field_errors;

            // Crear o mostrar un mensaje de error general
            let formError = document.querySelector('.form-general-error');

            if (!formError) {
                formError = document.createElement('div');
                formError.className = 'form-general-error';
                this.form.prepend(formError);
            }

            formError.textContent = message;
            formError.style.display = 'block';
        }

        // Para errores específicos de cada campo
        for (const key in errorData) {
            if (key === 'non_field_errors') continue;

            const errorDiv = document.getElementById(`error-${key}`);
            const inputElement = document.getElementById(key);

            if (errorDiv) {
                const message = Array.isArray(errorData[key])
                    ? errorData[key].join('. ')
                    : errorData[key];

                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');

                if (inputElement) {
                    inputElement.classList.add('invalid-input');
                }
            }
        }
    }

    /**
     * Convierte un nombre de campo a formato legible
     */
    humanizeFieldName(fieldName) {
        if (!fieldName) return '';

        // Separar camelCase
        let humanized = fieldName.replace(/([A-Z])/g, ' $1');

        // Reemplazar underscore por espacio
        humanized = humanized.replace(/_/g, ' ');

        // Capitalizar primera letra
        return humanized.charAt(0).toUpperCase() + humanized.slice(1).toLowerCase();
    }

    /**
     * Crea un campo de texto
     */
    createTextField(key, field, value) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.className = 'form-text-input';

        if (field.placeholder) {
            input.placeholder = field.placeholder;
        }

        if (field.maxLength) {
            input.maxLength = field.maxLength;
        }

        return input;
    }

    /**
     * Crea un campo de email
     */
    createEmailField(key, field, value) {
        const input = document.createElement('input');
        input.type = 'email';
        input.value = value || '';
        input.className = 'form-email-input';

        if (field.placeholder) {
            input.placeholder = field.placeholder;
        }

        return input;
    }

    /**
     * Crea un campo de número
     */
    createNumberField(key, field, value) {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value !== null && value !== undefined ? value : '';
        input.className = 'form-number-input';

        if (field.placeholder) {
            input.placeholder = field.placeholder;
        }

        if (field.minimum !== undefined) {
            input.min = field.minimum;
        }

        if (field.maximum !== undefined) {
            input.max = field.maximum;
        }

        if (field.step) {
            input.step = field.step;
        } else if (field.type === 'integer') {
            input.step = '1';
        }

        return input;
    }

    /**
     * Crea un campo de área de texto
     */
    createTextareaField(key, field, value) {
        const textarea = document.createElement('textarea');
        textarea.value = value || '';
        textarea.className = 'form-textarea-input';

        if (field.placeholder) {
            textarea.placeholder = field.placeholder;
        }

        if (field.maxLength) {
            textarea.maxLength = field.maxLength;
        }

        if (field.rows) {
            textarea.rows = field.rows;
        } else {
            textarea.rows = 4; // Valor predeterminado
        }

        return textarea;
    }

    /**
     * Crea un campo de fecha
     */
    createDateField(key, field, value) {
        const input = document.createElement('input');
        input.type = field.format === 'date-time' ? 'datetime-local' : 'date';
        input.value = value || '';
        input.className = 'form-date-input';

        if (field.minimum) {
            input.min = field.minimum;
        }

        if (field.maximum) {
            input.max = field.maximum;
        }

        return input;
    }

    /**
     * Crea un campo de selección
     */
    createSelectField(key, field, value) {
        const select = document.createElement('select');
        select.className = 'form-select-input';

        // Opción predeterminada
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Seleccionar --';
        defaultOption.disabled = true;
        select.appendChild(defaultOption);

        // Obtener opciones
        const {options, labels} = this.getSelectOptions(field);

        // Añadir opciones
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = labels[opt] || opt;
            select.appendChild(option);
        });

        // Establecer valor inicial
        select.value = value !== undefined && value !== null ? value : '';

        return select;
    }

    /**
     * Crea un campo booleano (switch o checkbox)
     */
    createBooleanField(key, field, value) {
        // Si se especifica formato switch, crear un switch personalizado
        if (field.format === 'switch') {
            const switchContainer = document.createElement('div');
            switchContainer.className = 'switch-container';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `switch-${key}`;
            checkbox.className = 'switch-checkbox';
            checkbox.checked = value === true;

            const label = document.createElement('label');
            label.htmlFor = `switch-${key}`;
            label.className = 'switch-label';

            switchContainer.appendChild(checkbox);
            switchContainer.appendChild(label);

            // Evento para propagar cambios
            checkbox.addEventListener('change', () => {
                const event = new Event('change');
                switchContainer.dispatchEvent(event);
            });

            return switchContainer;
        } else {
            // Checkbox regular
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = value === true;
            checkbox.className = 'form-checkbox-input';
            return checkbox;
        }

    }

    /**
     * Crea un campo de selección múltiple
     */
    createMultiselectField(key, field, value) {
        const select = document.createElement('select');
        select.className = 'form-select-input multiselect';
        select.multiple = true;

        // Obtener opciones
        const {options, labels} = this.getSelectOptions(field);

        // Añadir opciones
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = labels[opt] || opt;
            select.appendChild(option);
        });

        // Convertir value a array si no lo es
        let selectedValues = [];
        if (value) {
            selectedValues = Array.isArray(value) ? value : [value];
        }

        // Establecer valores seleccionados
        selectedValues.forEach(val => {
            const option = select.querySelector(`option[value="${val}"]`);
            if (option) {
                option.selected = true;
            }
        });

        return select;
    }

    /**
     * Crea un campo de tipo mapa para datos geoespaciales
     * @param {string} key - Nombre del campo
     * @param {Object} field - Esquema del campo
     * @param {Object} value - Valor inicial (GeoJSON)
     * @returns {HTMLElement} - Contenedor con el mapa
     */
    createMapField(key, field, value) {
        // Crear un contenedor para el mapa
        const mapContainer = document.createElement('div');
        mapContainer.className = 'form-map-container';
        mapContainer.style.height = '300px';
        mapContainer.style.width = '100%';

        // Input oculto para almacenar los datos GeoJSON
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = key;
        input.name = key;
        input.className = 'form-map-input';
        input.value = value ? (typeof value === 'string' ? value : JSON.stringify(value)) : '';

        mapContainer.appendChild(input);

        // Mensaje si Leaflet no está disponible
        if (typeof L === 'undefined') {
            const mapError = document.createElement('div');
            mapError.className = 'map-error';
            mapError.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <i class="fas fa-map-marker-alt" style="font-size: 2rem; color: #ccc;"></i>
                <p>Para utilizar mapas, incluye Leaflet en tu proyecto:</p>
                <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; text-align: left; font-size: 0.8rem;">
&lt;link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" /&gt;
&lt;link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" /&gt;
&lt;script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"&gt;&lt;/script&gt;
&lt;script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"&gt;&lt;/script&gt;
                </pre>
            </div>
        `;
            mapContainer.appendChild(mapError);
        }

        return mapContainer;
    }

    /**
     * Inicializa un campo de mapa una vez que está en el DOM
     * @param {string} fieldName - Nombre del campo
     * @param {HTMLElement} container - Contenedor del mapa
     * @param {Object} value - Valor inicial (GeoJSON)
     */
    initializeMapField(fieldName, container, value) {
        if (typeof L === 'undefined' || !container) return;

        // Limpiar contenedor
        container.innerHTML = '';

        // Input oculto para almacenar los datos GeoJSON
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = fieldName;
        input.name = fieldName;
        input.className = 'form-map-input';
        input.value = value ? (typeof value === 'string' ? value : JSON.stringify(value)) : '';

        container.appendChild(input);

        // Inicializar mapa en las coordenadas predeterminadas o basadas en el valor
        let initialView = [41.6, 2.0]; // Coordenadas para Cataluña por defecto
        let initialZoom = 10;

        // Si hay valor, intentar obtener centro del polígono
        if (value) {
            try {
                const geoJson = typeof value === 'string' ? JSON.parse(value) : value;
                // Intentar extraer coordenadas para centrar el mapa
                if (geoJson.geometry && geoJson.geometry.coordinates) {
                    const coords = geoJson.geometry.coordinates;
                    if (coords.length > 0) {
                        // Extraer primer punto para centrar (simplificado)
                        if (Array.isArray(coords[0]) && coords[0].length >= 2) {
                            initialView = [coords[0][1], coords[0][0]]; // [lat, lng]
                        }
                    }
                }
            } catch (e) {
                console.error('Error al procesar GeoJSON:', e);
            }
        }

        // Crear el mapa
        const map = L.map(container).setView(initialView, initialZoom);

        // Añadir capa base de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Grupo para almacenar elementos dibujados
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        // Configurar controles de dibujo si Leaflet.Draw está disponible
        if (L.Control.Draw) {
            const drawControl = new L.Control.Draw({
                edit: {
                    featureGroup: drawnItems
                },
                draw: {
                    polygon: true,
                    polyline: false,
                    rectangle: true,
                    circle: false,
                    marker: false,
                    circlemarker: false
                }
            });
            map.addControl(drawControl);

            // Eventos para capturar cambios en el dibujo
            map.on(L.Draw.Event.CREATED, (event) => {
                const layer = event.layer;
                drawnItems.addLayer(layer);
                updateGeoJsonValue();
            });

            map.on(L.Draw.Event.EDITED, () => {
                updateGeoJsonValue();
            });

            map.on(L.Draw.Event.DELETED, () => {
                updateGeoJsonValue();
            });
        }

        // Cargar polígono existente si hay valor
        if (value) {
            try {
                const geoJson = typeof value === 'string' ? JSON.parse(value) : value;
                L.geoJSON(geoJson).eachLayer(layer => {
                    drawnItems.addLayer(layer);
                });

                // Ajustar vista al polígono existente
                if (drawnItems.getBounds().isValid()) {
                    map.fitBounds(drawnItems.getBounds());
                }
            } catch (e) {
                console.error('Error al cargar el polígono:', e);
            }
        }

        // Función para actualizar el valor GeoJSON
        function updateGeoJsonValue() {
            const geoJson = drawnItems.toGeoJSON();
            input.value = JSON.stringify(geoJson);

            // Disparar evento change para la validación
            const event = new Event('change');
            input.dispatchEvent(event);
        }

        // Guardar referencia al mapa para acceso posterior
        this.maps = this.maps || {};
        this.maps[fieldName] = map;

        // Actualizar mapa cuando se cambia el tamaño de la ventana
        window.addEventListener('resize', () => {
            if (this.maps && this.maps[fieldName]) {
                this.maps[fieldName].invalidateSize();
            }
        });
    }

    /**
     * Crea un campo de color
     * @param {string} key - Nombre del campo
     * @param {Object} field - Esquema del campo
     * @param {string} value - Valor inicial (código de color)
     * @returns {HTMLElement} - Input de tipo color
     */
    createColorField(key, field, value) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = value || '#000000';
        input.className = 'form-color-input';

        // Si el campo tiene un valor por defecto
        if (field.default && !value) {
            input.value = field.default;
        }

        return input;
    }

    /**
     * Crea un campo para carga de archivos
     * @param {string} key - Nombre del campo
     * @param {Object} field - Esquema del campo
     * @param {string|File} value - Valor inicial (URL o File)
     * @returns {HTMLElement} - Contenedor para carga de archivos
     */
    createFileField(key, field, value) {
        // Es muy similar a tu implementación anterior pero simplificada
        const container = document.createElement('div');
        container.className = 'form-file-container';

        // Input para archivo
        const input = document.createElement('input');
        input.type = 'file';
        input.className = 'form-file-input';
        input.id = key;
        input.name = key;

        // Configurar aceptación de tipos de archivos
        if (field.accept || field.format === 'image') {
            input.accept = field.accept || 'image/*';
        }

        // Permitir múltiples archivos
        if (field.multiple) {
            input.multiple = true;
        }

        // Área de arrastrar y soltar
        const dropArea = document.createElement('div');
        dropArea.className = 'form-file-drop-area';
        dropArea.innerHTML = `
        <i class="fas fa-${field.format === 'image' ? 'image' : 'file'} fa-2x"></i>
        <p>${field.format === 'image' ? 'Arrastra imágenes aquí o ' : 'Arrastra archivos aquí o '} 
           <span>selecciona ${field.format === 'image' ? 'imágenes' : 'archivos'}</span></p>
    `;

        // Conectar el área con el input
        dropArea.querySelector('span').addEventListener('click', () => {
            input.click();
        });

        // Contenedor para vista previa
        const previewContainer = document.createElement('div');
        previewContainer.className = 'form-file-preview-container';

        // Eventos básicos para UI (implementación simplificada)
        input.addEventListener('change', () => {
            previewContainer.innerHTML = '';
            if (input.files.length > 0) {
                dropArea.classList.add('has-files');
            }
        });

        container.appendChild(dropArea);
        container.appendChild(input);
        container.appendChild(previewContainer);

        return container;
    }

    resetForm() {
        if (this.form) {
            this.form.reset();

            // També netejem errors visuals
            const errorDivs = this.form.querySelectorAll('.field-error');
            errorDivs.forEach(div => {
                div.textContent = '';
                div.classList.add('hidden');
            });

            const invalidInputs = this.form.querySelectorAll('.invalid-input');
            invalidInputs.forEach(input => {
                input.classList.remove('invalid-input');
            });
        }
    }

    /**
     * Carga estilos CSS desde un archivo externo y los aplica al formulario
     * @param {string} url - URL del archivo CSS a cargar
     * @returns {Promise<boolean>} - Promesa que se resuelve cuando se cargan los estilos
     */
    async loadStylesFromFile(url) {
        try {
            // Verificar que la URL sea válida
            if (!url) {
                throw new Error('URL no válida para cargar estilos');
            }

            // Mostrar indicador de carga si tienes uno
            if (this.options && this.options.debug) {
                console.log(`Cargando estilos desde: ${url}`);
            }

            // Realizar la petición para obtener el archivo CSS
            const response = await fetch(url);

            // Verificar si la respuesta es correcta
            if (!response.ok) {
                throw new Error(`Error al cargar estilos: ${response.status} ${response.statusText}`);
            }

            // Obtener el contenido del archivo como texto
            const cssText = await response.text();

            // Aplicar los estilos cargados
            this.applyCustomStyles(cssText);

            if (this.options && this.options.debug) {
                console.log('Estilos aplicados correctamente');
            }

            return true;
        } catch (error) {
            // Manejar errores
            console.error('Error cargando archivo de estilos:', error.message);

            // Si hay un callback de error definido, llamarlo
            if (this.onSubmitError && typeof this.onSubmitError === 'function') {
                this.onSubmitError({
                    error: 'style_loading_error',
                    message: error.message,
                    url
                });
            }

            return false;
        }
    }

    /**
     * Aplica estilos CSS personalizados al formulario
     * @param {string|object} styles - Estilos CSS como string o como objeto
     */
    applyCustomStyles(styles) {
        if (!styles) return;

        // Generar ID único para este conjunto de estilos
        const styleId = `form-generator-styles-${this.model}`;

        // Eliminar estilos anteriores si existen
        const existingStyles = document.getElementById(styleId);
        if (existingStyles) {
            existingStyles.remove();
        }

        // Crear nuevo elemento de estilo
        const styleElement = document.createElement('style');
        styleElement.id = styleId;

        // Convertir objeto a CSS si es necesario
        let cssContent = '';

        if (typeof styles === 'string') {
            cssContent = styles;
        } else if (typeof styles === 'object') {
            cssContent = this.convertObjectToCSS(styles);
        } else {
            console.warn('Formato de estilos no válido. Use string CSS o objeto JavaScript.');
            return;
        }

        // Añadir prefijo al ámbito para evitar colisiones
        cssContent = this.scopeCSS(cssContent, `.form-${this.model}`);

        // Añadir el CSS al elemento style
        styleElement.textContent = cssContent;

        // Añadir al head del documento
        document.head.appendChild(styleElement);

        // Guardar referencia a los estilos actuales
        this.customStyles = styles;

        if (this.options && this.options.debug) {
            console.log('Estilos personalizados aplicados');
        }
    }

    /**
     * Convierte un objeto de estilos a string CSS
     * @param {object} stylesObject - Objeto con estilos
     * @return {string} CSS generado
     */
    convertObjectToCSS(stylesObject) {
        if (!stylesObject || typeof stylesObject !== 'object') {
            return '';
        }

        let css = '';

        for (const selector in stylesObject) {
            css += `${selector} {\n`;

            const properties = stylesObject[selector];
            for (const property in properties) {
                // Convertir camelCase a kebab-case
                const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                const value = properties[property];
                css += `  ${cssProperty}: ${value};\n`;
            }

            css += '}\n\n';
        }

        return css;
    }

    /**
     * Añade un prefijo de ámbito a las reglas CSS
     * @param {string} css - CSS a modificar
     * @param {string} scope - Selector para usar como ámbito
     * @return {string} CSS modificado con ámbito
     */
    scopeCSS(css, scope) {
        if (!css || !scope) return css;

        try {
            // Expresión regular para encontrar selectores
            // Esta regex busca selectores fuera de bloques de comentarios o reglas @
            const selectorRegex = /(^|\})(([^{@]+){)/g;

            // Reemplazar selectores con versión con ámbito
            return css.replace(selectorRegex, (match, g1, g2, selectorGroup) => {
                // Ignorar si es una regla @ (media, keyframes, etc)
                if (selectorGroup.trim().startsWith('@')) {
                    return match;
                }

                // Separar selectores múltiples (por coma)
                const selectors = selectorGroup.split(',');

                // Añadir ámbito a cada selector
                const scopedSelectors = selectors.map(selector => {
                    selector = selector.trim();

                    // No modificar selectores que ya contienen el ámbito
                    if (selector.includes(scope)) {
                        return selector;
                    }

                    // No modificar selectores globales específicos
                    if (selector.startsWith(':root') || selector.startsWith('html') || selector.startsWith('body')) {
                        return selector;
                    }

                    // Manejar pseudoelementos y pseudoclases
                    if (selector.includes(':')) {
                        // Esto es simplificado, una implementación más robusta
                        // necesitaría un parser CSS más complejo
                        return `${scope} ${selector}`;
                    }

                    return `${scope} ${selector}`;
                });

                // Reunir selectores modificados
                return `${g1}${scopedSelectors.join(', ')}{`;
            });
        } catch (error) {
            console.error('Error al aplicar ámbito a CSS:', error);
            return css; // Devolver CSS original si hay error
        }
    }

    /**
     * Aplica un tema personalizado generando variables CSS
     * @param {object} themeColors - Objeto con colores del tema
     */
    applyCustomTheme(themeColors) {
        if (!themeColors || typeof themeColors !== 'object') return;

        // Valores por defecto
        const defaultColors = {
            // Tema claro
            light: {
                bgColor: '#ffffff',
                textColor: '#212529',
                borderColor: '#ced4da',
                inputBg: '#ffffff',
                primaryColor: '#4361ee',
                errorColor: '#e74c3c',
                groupBg: '#f8f9fa',
                helpTextColor: '#6c757d',
            },
            // Tema oscuro
            dark: {
                bgColor: '#212529',
                textColor: '#f8f9fa',
                borderColor: '#495057',
                inputBg: '#343a40',
                primaryColor: '#4cc9f0',
                errorColor: '#e5383b',
                groupBg: '#343a40',
                helpTextColor: '#adb5bd',
            }
        };

        // Combinar con valores por defecto según el tema actual
        const baseTheme = this.theme === 'dark' ? defaultColors.dark : defaultColors.light;
        const colors = {...baseTheme, ...themeColors};

        // Generar CSS de variables
        const css = `
      .form-${this.model} {
        --bg-color: ${colors.bgColor};
        --text-color: ${colors.textColor};
        --border-color: ${colors.borderColor};
        --input-bg: ${colors.inputBg};
        --primary-color: ${colors.primaryColor};
        --error-color: ${colors.errorColor};
        --group-bg: ${colors.groupBg};
        --help-text-color: ${colors.helpTextColor};
      }
    `;

        this.applyCustomStyles(css);

        // Guardar referencia al tema personalizado
        this.customTheme = themeColors;
    }

    /**
     * Añade un botón para alternar entre temas claro y oscuro
     */
    addThemeToggleButton() {
        const themeToggle = document.createElement('button');
        themeToggle.type = 'button';
        themeToggle.className = 'theme-toggle-btn';
        themeToggle.innerHTML = `<i class="fas ${this.theme === 'light' ? 'fa-moon' : 'fa-sun'}"></i>`;
        themeToggle.title = `Cambiar a modo ${this.theme === 'light' ? 'oscuro' : 'claro'}`;
        themeToggle.setAttribute('aria-label', `Cambiar a modo ${this.theme === 'light' ? 'oscuro' : 'claro'}`);

        themeToggle.addEventListener('click', () => {
            const newTheme = this.theme === 'light' ? 'dark' : 'light';
            this.setTheme(newTheme);

            // Actualizar icono del botón
            themeToggle.innerHTML = `<i class="fas ${newTheme === 'light' ? 'fa-moon' : 'fa-sun'}"></i>`;
            themeToggle.title = `Cambiar a modo ${newTheme === 'light' ? 'oscuro' : 'claro'}`;
            themeToggle.setAttribute('aria-label', `Cambiar a modo ${newTheme === 'light' ? 'oscuro' : 'claro'}`);
        });

        // Añadir botón después del título si existe, o al principio
        const formTitle = this.form.querySelector('.form-schema-title');
        if (formTitle) {
            formTitle.parentNode.insertBefore(themeToggle, formTitle.nextSibling);
        } else {
            this.form.insertBefore(themeToggle, this.form.firstChild);
        }
    }

    /**
     * Cambia el tema del formulario
     * @param {string} theme - Nombre del tema ('light' o 'dark')
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.warn('Tema no válido. Use "light" o "dark"');
            return;
        }

        // Quitar clase del tema actual
        this.form.classList.remove(`theme-${this.theme}`);

        // Actualizar tema
        this.theme = theme;

        // Añadir clase del nuevo tema
        this.form.classList.add(`theme-${this.theme}`);

        // Si hay un tema personalizado, volver a aplicarlo con los nuevos valores base
        if (this.customTheme) {
            this.applyCustomTheme(this.customTheme);
        }

        // Guardar preferencia en localStorage si está disponible
        if (window.localStorage) {
            localStorage.setItem('formGeneratorTheme', theme);
        }

        if (this.options && this.options.onThemeChange && typeof this.options.onThemeChange === 'function') {
            this.options.onThemeChange(theme);
        }

    }
}