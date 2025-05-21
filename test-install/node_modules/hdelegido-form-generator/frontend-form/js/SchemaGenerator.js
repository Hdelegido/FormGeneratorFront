/**
 * SchemaGenerator - Utilidad para crear schemas para FormGenerator
 */
export default class SchemaGenerator {
    /**
     * Crea un schema completo para un formulario
     */
    static createSchema(options) {
        const {
            title,
            description,
            properties,
            required = [],
            fieldGroups = []
        } = options;

        const schema = {
            title,
            description,
            type: "object",
            properties: {},
            required
        };

        // Procesar las propiedades
        for (const [key, config] of Object.entries(properties)) {
            schema.properties[key] = this.processField(key, config);
        }

        // Añadir grupos de campos si existen
        if (fieldGroups.length > 0) {
            schema.fieldGroups = fieldGroups;
        }

        return schema;
    }

    /**
     * Procesa la definición de un campo
     */
    static processField(key, config) {
        const field = {
            type: config.type || 'string',
            title: config.title || this.humanizeFieldName(key),
        };

        // Copiar propiedades comunes
        [
            'description', 'format', 'placeholder', 'minLength', 'maxLength',
            'minimum', 'maximum', 'pattern', 'patternMessage', 'enum',
            'isContentTypeField', 'dependsOn', 'isObjectIdField', 'isManyToMany'
        ].forEach(prop => {
            if (config[prop] !== undefined) {
                field[prop] = config[prop];
            }
        });

        // Etiquetas para enumeraciones
        if (config.enum && config.enumLabels) {
            field['x-enum-labels'] = config.enumLabels;
        }

        return field;
    }

    /**
     * Convierte nombre de campo a formato legible
     */
    static humanizeFieldName(fieldName) {
        if (!fieldName) return '';

        // Separar camelCase
        let humanized = fieldName.replace(/([A-Z])/g, ' $1');

        // Reemplazar underscore por espacio
        humanized = humanized.replace(/_/g, ' ');

        // Capitalizar primera letra
        return humanized.charAt(0).toUpperCase() + humanized.slice(1).toLowerCase();
    }

    /**
     * Crea un grupo de campos
     */
    static createFieldGroup(options) {
        return {
            id: options.id,
            title: options.title,
            fields: options.fields,
            expanded: options.expanded !== false,
            icon: options.icon || null,
            color: options.color || null
        };
    }
}