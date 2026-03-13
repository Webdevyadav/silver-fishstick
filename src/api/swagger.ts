import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RosterIQ AI Agent API',
      version: '1.0.0',
      description: 'Autonomous AI agent system for healthcare insurance payers to analyze provider roster pipeline operations',
      contact: {
        name: 'RosterIQ Team',
        email: 'support@rosteriq.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.rosteriq.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Error code'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Additional error details'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            error: {
              $ref: '#/components/schemas/Error'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            },
            requestId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique request identifier'
            },
            executionTime: {
              type: 'number',
              description: 'Execution time in milliseconds'
            }
          }
        },
        QueryRequest: {
          type: 'object',
          required: ['query', 'sessionId', 'userId'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              maxLength: 10000,
              description: 'Natural language query'
            },
            sessionId: {
              type: 'string',
              format: 'uuid',
              description: 'Session identifier'
            },
            userId: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'User identifier'
            },
            options: {
              type: 'object',
              properties: {
                streaming: {
                  type: 'boolean',
                  default: false,
                  description: 'Enable real-time streaming'
                },
                includeVisualization: {
                  type: 'boolean',
                  default: true,
                  description: 'Include visualizations in response'
                },
                maxSources: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 50,
                  default: 10,
                  description: 'Maximum number of sources to return'
                },
                confidenceThreshold: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  default: 0.5,
                  description: 'Minimum confidence threshold'
                }
              }
            }
          }
        },
        SessionRequest: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'User identifier'
            },
            sessionId: {
              type: 'string',
              format: 'uuid',
              description: 'Existing session ID to resume'
            },
            metadata: {
              type: 'object',
              description: 'Additional session metadata'
            }
          }
        },
        Alert: {
          type: 'object',
          required: ['type', 'title', 'message'],
          properties: {
            type: {
              type: 'string',
              enum: ['alert', 'warning', 'info', 'success'],
              description: 'Alert type'
            },
            severity: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              default: 3,
              description: 'Alert severity (1=lowest, 5=highest)'
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'Alert title'
            },
            message: {
              type: 'string',
              minLength: 1,
              maxLength: 5000,
              description: 'Alert message'
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Recommended actions'
            },
            impact: {
              type: 'string',
              maxLength: 1000,
              description: 'Impact description'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Query',
        description: 'Natural language query processing endpoints'
      },
      {
        name: 'Session',
        description: 'Session management endpoints'
      },
      {
        name: 'WebSocket',
        description: 'WebSocket and real-time communication endpoints'
      },
      {
        name: 'Diagnostic',
        description: 'Diagnostic procedure endpoints'
      },
      {
        name: 'Memory',
        description: 'Memory management endpoints (episodic, procedural, semantic)'
      },
      {
        name: 'Visualization',
        description: 'Data visualization generation endpoints'
      },
      {
        name: 'Correlation',
        description: 'Cross-dataset correlation analysis endpoints'
      },
      {
        name: 'Alerts',
        description: 'Proactive alerts and monitoring endpoints'
      },
      {
        name: 'Health',
        description: 'System health and monitoring endpoints'
      }
    ]
  },
  apis: ['./src/api/*.ts'] // Path to API route files
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger documentation
 */
export const setupSwagger = (app: Express) => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'RosterIQ API Documentation'
  }));

  // Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export { swaggerSpec };
