/**
 * SWAGGER/OPENAPI CONFIGURATION
 * Documentación automática de la API pública de EcoPlan
 * 
 * Permite a terceros (periodistas, ONGs, universidades, desarrolladores)
 * entender y usar los endpoints disponibles
 */

const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoPlan API - Ciencia Ciudadana Ambiental',
      version: '1.0.0',
      description: `
## 🌱 API Pública de EcoPlan - Lima, Perú

EcoPlan es una plataforma de ciencia ciudadana para monitoreo ambiental urbano.
Esta API permite acceso programático a datos ambientales, reportes ciudadanos,
y análisis de barrios.

### 🎯 Casos de Uso

- **Periodismo de datos**: Investigaciones sobre calidad ambiental
- **Investigación académica**: Estudios sobre islas de calor urbanas
- **Aplicaciones móviles**: Integración de datos ambientales
- **ONGs ambientales**: Monitoreo de indicadores
- **Políticas públicas**: Evaluación de impacto de intervenciones

### 🔐 Autenticación

Actualmente la API es pública y no requiere autenticación.
En producción se implementará un sistema de API keys.

### 📊 Datos Abiertos

Todos los datos están bajo licencia Creative Commons BY 4.0.
Puedes usar, compartir y adaptar los datos citando la fuente.

### 🌍 Cobertura

12 barrios de Lima Metropolitana (~1.2M habitantes):
- San Juan de Lurigancho
- Villa María del Triunfo  
- Villa El Salvador
- San Juan de Miraflores
- Ate
- Comas
- San Martín de Porres
- Puente Piedra
- Lurín
- Pachacámac
- Independencia
- Los Olivos

### 📖 Documentación Adicional

- [Manual Completo](https://github.com/Segesp/GEE/blob/main/docs/manual-ecoplan-gee.md)
- [Página de Transparencia](http://localhost:3000/transparencia.html)
- [Tutoriales](http://localhost:3000/tutoriales.html)

### 🤝 Contacto

- GitHub: https://github.com/Segesp/GEE
- Email: ecoplan@segesp.gob.pe (ejemplo)
      `,
      contact: {
        name: 'Equipo EcoPlan',
        email: 'ecoplan@segesp.gob.pe',
        url: 'https://github.com/Segesp/GEE'
      },
      license: {
        name: 'Creative Commons BY 4.0',
        url: 'https://creativecommons.org/licenses/by/4.0/'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://ecoplan.gob.pe',
        description: 'Servidor de producción (ejemplo)'
      }
    ],
    tags: [
      {
        name: 'Reportes Ciudadanos',
        description: 'Endpoints para reportes de problemas ambientales'
      },
      {
        name: 'Validación Comunitaria',
        description: 'Sistema de validación peer-to-peer'
      },
      {
        name: 'Micro-encuestas',
        description: 'Encuestas rápidas de 1 clic'
      },
      {
        name: 'Análisis de Barrios',
        description: 'Indicadores ambientales por distrito (Mi Barrio)'
      },
      {
        name: 'Simulador',
        description: 'Simulación de impacto de intervenciones ambientales'
      },
      {
        name: 'Exportación de Datos',
        description: 'Descarga de datasets completos'
      },
      {
        name: 'Earth Engine',
        description: 'Integración con Google Earth Engine para datos satelitales'
      },
      {
        name: 'Recomendaciones',
        description: 'Sistema de priorización de barrios y recomendación de intervenciones (AHP/TOPSIS)'
      }
    ],
    components: {
      schemas: {
        CitizenReport: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            category: {
              type: 'string',
              enum: ['heat', 'green', 'flooding', 'waste', 'air', 'water', 'other'],
              example: 'heat',
              description: 'Categoría del problema ambiental'
            },
            latitude: {
              type: 'number',
              format: 'float',
              example: -12.0464,
              description: 'Latitud WGS84'
            },
            longitude: {
              type: 'number',
              format: 'float',
              example: -77.0428,
              description: 'Longitud WGS84'
            },
            description: {
              type: 'string',
              maxLength: 2000,
              example: 'Fuerte calor en la esquina sin sombra ni árboles'
            },
            photoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://storage.googleapis.com/ecoplan/photos/abc123.jpg'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-05T10:30:00Z'
            },
            status: {
              type: 'string',
              enum: ['pending', 'validated', 'rejected'],
              example: 'validated'
            },
            validationScore: {
              type: 'number',
              format: 'float',
              minimum: 0,
              maximum: 1,
              example: 0.85,
              description: 'Puntaje de validación comunitaria (0-1)'
            }
          }
        },
        NeighborhoodAnalysis: {
          type: 'object',
          properties: {
            neighborhoodId: {
              type: 'string',
              example: 'san-juan-lurigancho'
            },
            neighborhoodName: {
              type: 'string',
              example: 'San Juan de Lurigancho'
            },
            indicators: {
              type: 'object',
              properties: {
                temperature: {
                  type: 'object',
                  properties: {
                    value: { type: 'number', example: 28.5 },
                    unit: { type: 'string', example: '°C' },
                    status: { type: 'string', enum: ['green', 'yellow', 'red'], example: 'yellow' },
                    description: { type: 'string' }
                  }
                },
                vegetation: {
                  type: 'object',
                  properties: {
                    value: { type: 'number', example: 0.35 },
                    unit: { type: 'string', example: 'NDVI' },
                    status: { type: 'string', enum: ['green', 'yellow', 'red'], example: 'yellow' }
                  }
                },
                airQuality: {
                  type: 'object',
                  properties: {
                    value: { type: 'number', example: 45 },
                    unit: { type: 'string', example: 'PM2.5 µg/m³' },
                    status: { type: 'string', enum: ['green', 'yellow', 'red'], example: 'green' }
                  }
                }
              }
            },
            overallScore: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              example: 65,
              description: 'Puntuación general de salud ambiental'
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: [
                'Incrementar áreas verdes en 15%',
                'Implementar techos verdes en edificios públicos'
              ]
            }
          }
        },
        SimulationResult: {
          type: 'object',
          properties: {
            interventionType: {
              type: 'string',
              example: 'urban_park'
            },
            area: {
              type: 'number',
              example: 1.5,
              description: 'Área en hectáreas'
            },
            impacts: {
              type: 'object',
              properties: {
                temperature: {
                  type: 'object',
                  properties: {
                    reduction: { type: 'number', example: -2.5 },
                    unit: { type: 'string', example: '°C' }
                  }
                },
                vegetation: {
                  type: 'object',
                  properties: {
                    increase: { type: 'number', example: 0.15 },
                    unit: { type: 'string', example: 'NDVI' }
                  }
                }
              }
            },
            score: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              example: 75
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Invalid parameter'
            },
            message: {
              type: 'string',
              example: 'The category must be one of: heat, green, flooding, waste, air, water, other'
            }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Solicitud inválida',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFound: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ServerError: {
          description: 'Error interno del servidor',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    }
  },
  apis: ['./server.js', './services/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
