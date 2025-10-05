/**
 * @fileoverview Simulador de Escenarios Ambientales ("¿Y si...?")
 * @module services/scenarioSimulatorService
 * 
 * Calcula impactos estimados de intervenciones ambientales:
 * - Parques urbanos
 * - Techos verdes
 * - Pintura reflectante
 * - Arborización
 */

/**
 * Servicio de Simulación de Escenarios
 */
class ScenarioSimulatorService {
  constructor() {
    // Tipos de intervención disponibles
    this.interventionTypes = {
      'urban-park': {
        id: 'urban-park',
        name: 'Parque Urbano',
        icon: '🏞️',
        description: 'Crear un nuevo parque con árboles y áreas verdes',
        unit: 'hectáreas',
        minArea: 0.1,
        maxArea: 10,
        step: 0.1,
        impacts: {
          temperature: {
            coefficient: -0.8, // °C por hectárea
            label: 'Reducción de temperatura',
            icon: '🌡️',
            color: '#3b82f6'
          },
          vegetation: {
            coefficient: 0.15, // NDVI por hectárea
            label: 'Mejora de vegetación',
            icon: '🌳',
            color: '#10b981'
          },
          air: {
            coefficient: -2.5, // µg/m³ por hectárea
            label: 'Mejora de calidad del aire',
            icon: '🌫️',
            color: '#8b5cf6'
          },
          water: {
            coefficient: 0.08, // NDWI por hectárea
            label: 'Mejora de infiltración',
            icon: '💧',
            color: '#06b6d4'
          },
          biodiversity: {
            coefficient: 12, // especies por hectárea
            label: 'Aumento de biodiversidad',
            icon: '🦋',
            color: '#f59e0b'
          }
        }
      },
      'green-roof': {
        id: 'green-roof',
        name: 'Techos Verdes',
        icon: '🏠🌿',
        description: 'Instalar vegetación en techos de edificios',
        unit: 'hectáreas',
        minArea: 0.01,
        maxArea: 5,
        step: 0.01,
        impacts: {
          temperature: {
            coefficient: -0.5, // °C por hectárea
            label: 'Reducción de temperatura',
            icon: '🌡️',
            color: '#3b82f6'
          },
          vegetation: {
            coefficient: 0.08, // NDVI por hectárea
            label: 'Mejora de vegetación',
            icon: '🌳',
            color: '#10b981'
          },
          air: {
            coefficient: -1.2, // µg/m³ por hectárea
            label: 'Mejora de calidad del aire',
            icon: '🌫️',
            color: '#8b5cf6'
          },
          water: {
            coefficient: 0.05, // NDWI por hectárea
            label: 'Retención de agua lluvia',
            icon: '💧',
            color: '#06b6d4'
          },
          energy: {
            coefficient: 15, // % ahorro energético por hectárea
            label: 'Ahorro energético edificios',
            icon: '⚡',
            color: '#eab308'
          }
        }
      },
      'cool-paint': {
        id: 'cool-paint',
        name: 'Pintura Reflectante',
        icon: '🎨',
        description: 'Aplicar pintura clara/reflectante en edificios',
        unit: 'hectáreas',
        minArea: 0.1,
        maxArea: 20,
        step: 0.1,
        impacts: {
          temperature: {
            coefficient: -0.3, // °C por hectárea
            label: 'Reducción de temperatura',
            icon: '🌡️',
            color: '#3b82f6'
          },
          albedo: {
            coefficient: 0.25, // aumento de albedo por hectárea
            label: 'Aumento de reflectividad',
            icon: '☀️',
            color: '#f59e0b'
          },
          energy: {
            coefficient: 20, // % ahorro energético por hectárea
            label: 'Ahorro en aire acondicionado',
            icon: '⚡',
            color: '#eab308'
          }
        }
      },
      'tree-planting': {
        id: 'tree-planting',
        name: 'Arborización',
        icon: '🌳',
        description: 'Plantar árboles en calles y espacios públicos',
        unit: 'árboles',
        minArea: 10,
        maxArea: 1000,
        step: 10,
        impacts: {
          temperature: {
            coefficient: -0.005, // °C por árbol
            label: 'Reducción de temperatura',
            icon: '🌡️',
            color: '#3b82f6'
          },
          vegetation: {
            coefficient: 0.001, // NDVI por árbol
            label: 'Mejora de vegetación',
            icon: '🌳',
            color: '#10b981'
          },
          air: {
            coefficient: -0.15, // µg/m³ por árbol
            label: 'Mejora de calidad del aire',
            icon: '🌫️',
            color: '#8b5cf6'
          },
          carbon: {
            coefficient: 0.025, // toneladas CO2/año por árbol
            label: 'Captura de carbono',
            icon: '🌍',
            color: '#10b981'
          },
          shade: {
            coefficient: 15, // m² de sombra por árbol
            label: 'Área de sombra',
            icon: '☂️',
            color: '#6366f1'
          }
        }
      }
    };

    // Barrios disponibles (simplificado, podría venir de neighborhoodAnalysisService)
    this.neighborhoods = [
      { id: 'miraflores', name: 'Miraflores', area: 9.62 },
      { id: 'san-isidro', name: 'San Isidro', area: 11.1 },
      { id: 'surquillo', name: 'Surquillo', area: 3.46 },
      { id: 'barranco', name: 'Barranco', area: 3.33 },
      { id: 'la-molina', name: 'La Molina', area: 65.75 },
      { id: 'surco', name: 'Santiago de Surco', area: 34.75 }
    ];
  }

  /**
   * Lista todos los tipos de intervención disponibles
   */
  getInterventionTypes() {
    return Object.values(this.interventionTypes).map(type => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      description: type.description,
      unit: type.unit,
      minArea: type.minArea,
      maxArea: type.maxArea,
      step: type.step,
      impacts: Object.keys(type.impacts)
    }));
  }

  /**
   * Simula el impacto de una intervención
   * @param {string} interventionType - Tipo de intervención
   * @param {number} area - Área o cantidad de la intervención
   * @param {string} neighborhoodId - ID del barrio (opcional)
   * @returns {Object} Impactos estimados
   */
  simulateIntervention(interventionType, area, neighborhoodId = null) {
    const intervention = this.interventionTypes[interventionType];
    
    if (!intervention) {
      throw new Error(`Tipo de intervención no válido: ${interventionType}`);
    }

    // Validar área
    if (area < intervention.minArea || area > intervention.maxArea) {
      throw new Error(
        `Área fuera de rango. Debe estar entre ${intervention.minArea} y ${intervention.maxArea} ${intervention.unit}`
      );
    }

    // Calcular impactos
    const impacts = {};
    for (const [key, impact] of Object.entries(intervention.impacts)) {
      const change = impact.coefficient * area;
      const absChange = Math.abs(change);
      
      impacts[key] = {
        label: impact.label,
        icon: impact.icon,
        color: impact.color,
        value: change,
        absValue: absChange,
        formatted: this._formatImpact(key, change),
        isPositive: this._isPositiveImpact(key, change),
        message: this._generateMessage(key, impact.label, change, area, intervention.unit)
      };
    }

    // Calcular score de impacto general (0-100)
    const overallScore = this._calculateOverallScore(impacts);

    // Información del barrio si se proporcionó
    let neighborhood = null;
    if (neighborhoodId) {
      neighborhood = this.neighborhoods.find(n => n.id === neighborhoodId);
      if (neighborhood) {
        // Calcular porcentaje del barrio afectado
        if (intervention.unit === 'hectáreas') {
          const percentOfNeighborhood = (area / (neighborhood.area * 100)) * 100;
          neighborhood.percentAffected = percentOfNeighborhood.toFixed(2);
        }
      }
    }

    return {
      intervention: {
        type: intervention.id,
        name: intervention.name,
        icon: intervention.icon,
        description: intervention.description,
        area,
        unit: intervention.unit
      },
      neighborhood,
      impacts,
      overallScore,
      summary: this._generateSummary(intervention, area, impacts, overallScore),
      recommendations: this._generateRecommendations(intervention, area, impacts),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compara múltiples escenarios
   * @param {Array} scenarios - Array de {interventionType, area, neighborhoodId}
   * @returns {Object} Comparación de escenarios
   */
  compareScenarios(scenarios) {
    if (scenarios.length < 2 || scenarios.length > 4) {
      throw new Error('Debes comparar entre 2 y 4 escenarios');
    }

    const results = scenarios.map((scenario, index) => {
      const result = this.simulateIntervention(
        scenario.interventionType,
        scenario.area,
        scenario.neighborhoodId
      );
      return {
        scenarioId: index + 1,
        ...result
      };
    });

    // Determinar mejor escenario por impacto
    const bestScenario = results.reduce((best, current) => 
      current.overallScore > best.overallScore ? current : best
    );

    return {
      scenarios: results,
      bestScenario: bestScenario.scenarioId,
      comparison: this._generateComparison(results),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene escenarios pre-configurados para un barrio
   * @param {string} neighborhoodId - ID del barrio
   * @returns {Array} Escenarios recomendados
   */
  getRecommendedScenarios(neighborhoodId) {
    const neighborhood = this.neighborhoods.find(n => n.id === neighborhoodId);
    
    if (!neighborhood) {
      throw new Error('Barrio no encontrado');
    }

    const scenarios = [
      {
        id: 'scenario-1',
        name: 'Parque Pequeño',
        description: `Crear un parque de 1 hectárea en ${neighborhood.name}`,
        interventionType: 'urban-park',
        area: 1,
        priority: 'high'
      },
      {
        id: 'scenario-2',
        name: 'Techos Verdes',
        description: `Instalar 0.5 hectáreas de techos verdes en ${neighborhood.name}`,
        interventionType: 'green-roof',
        area: 0.5,
        priority: 'medium'
      },
      {
        id: 'scenario-3',
        name: 'Arborización Masiva',
        description: `Plantar 500 árboles en ${neighborhood.name}`,
        interventionType: 'tree-planting',
        area: 500,
        priority: 'high'
      },
      {
        id: 'scenario-4',
        name: 'Pintura Reflectante',
        description: `Pintar 2 hectáreas de techos en ${neighborhood.name}`,
        interventionType: 'cool-paint',
        area: 2,
        priority: 'low'
      }
    ];

    // Simular cada escenario
    return scenarios.map(scenario => ({
      ...scenario,
      simulation: this.simulateIntervention(
        scenario.interventionType,
        scenario.area,
        neighborhoodId
      )
    }));
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  /**
   * Formatea el valor de un impacto
   */
  _formatImpact(key, value) {
    const absValue = Math.abs(value);
    
    switch (key) {
      case 'temperature':
        return `${value > 0 ? '+' : ''}${value.toFixed(1)}°C`;
      case 'vegetation':
        return `${value > 0 ? '+' : ''}${value.toFixed(3)} NDVI`;
      case 'air':
        return `${value > 0 ? '+' : ''}${value.toFixed(1)} µg/m³`;
      case 'water':
        return `${value > 0 ? '+' : ''}${value.toFixed(3)} NDWI`;
      case 'biodiversity':
        return `${value > 0 ? '+' : ''}${Math.round(value)} especies`;
      case 'energy':
        return `${absValue.toFixed(1)}% ahorro`;
      case 'carbon':
        return `${absValue.toFixed(2)} ton CO₂/año`;
      case 'shade':
        return `${Math.round(absValue)} m²`;
      case 'albedo':
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
      default:
        return value.toFixed(2);
    }
  }

  /**
   * Determina si un cambio es positivo
   */
  _isPositiveImpact(key, value) {
    // Temperatura y aire: negativos son positivos (reducción)
    if (key === 'temperature' || key === 'air') {
      return value < 0;
    }
    // Todo lo demás: positivos son positivos
    return value > 0;
  }

  /**
   * Genera mensaje descriptivo
   */
  _generateMessage(key, label, value, area, unit) {
    const absValue = Math.abs(value);
    const formatted = this._formatImpact(key, value);
    
    let action = '';
    if (key === 'temperature' && value < 0) {
      action = 'reduciría la temperatura en';
    } else if (key === 'air' && value < 0) {
      action = 'mejoraría la calidad del aire reduciendo PM2.5 en';
    } else if (key === 'vegetation') {
      action = 'aumentaría la vegetación en';
    } else if (key === 'biodiversity') {
      action = 'podría atraer aproximadamente';
    } else if (key === 'energy') {
      action = 'generaría un ahorro energético de hasta';
    } else if (key === 'carbon') {
      action = 'capturaría aproximadamente';
    } else if (key === 'shade') {
      action = 'proporcionaría';
    } else {
      action = 'cambiaría en';
    }

    return `Esto ${action} ${formatted} en tu zona`;
  }

  /**
   * Calcula score general de impacto (0-100)
   */
  _calculateOverallScore(impacts) {
    let score = 50; // Base

    for (const [key, impact] of Object.entries(impacts)) {
      if (impact.isPositive) {
        // Cada impacto positivo suma puntos
        if (key === 'temperature') score += Math.min(impact.absValue * 5, 15);
        if (key === 'vegetation') score += Math.min(impact.absValue * 30, 15);
        if (key === 'air') score += Math.min(impact.absValue * 2, 10);
        if (key === 'water') score += Math.min(impact.absValue * 20, 10);
      }
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Genera resumen del escenario
   */
  _generateSummary(intervention, area, impacts, score) {
    const positiveImpacts = Object.entries(impacts)
      .filter(([_, impact]) => impact.isPositive)
      .length;

    let level = 'bajo';
    let emoji = '🟡';
    if (score >= 75) {
      level = 'alto';
      emoji = '🟢';
    } else if (score >= 60) {
      level = 'moderado-alto';
      emoji = '🟢';
    } else if (score >= 50) {
      level = 'moderado';
      emoji = '🟡';
    }

    return {
      text: `${intervention.name} de ${area} ${intervention.unit} tendría un impacto ${level} con ${positiveImpacts} beneficios ambientales`,
      emoji,
      level,
      score
    };
  }

  /**
   * Genera recomendaciones basadas en el escenario
   */
  _generateRecommendations(intervention, area, impacts) {
    const recommendations = [];

    if (intervention.id === 'urban-park') {
      recommendations.push('💰 Busca fondos municipales o ONG ambientales');
      recommendations.push('👥 Involucra a la comunidad desde el diseño');
      recommendations.push('🌳 Prioriza especies nativas y resistentes');
      if (area > 2) {
        recommendations.push('🏃 Incluye senderos y áreas recreativas');
      }
    } else if (intervention.id === 'green-roof') {
      recommendations.push('🏗️ Evalúa estructura del edificio primero');
      recommendations.push('💧 Instala sistema de riego automático');
      recommendations.push('🌱 Usa plantas suculentas de bajo mantenimiento');
    } else if (intervention.id === 'cool-paint') {
      recommendations.push('🎨 Usa pintura con índice SRI > 75');
      recommendations.push('🏢 Prioriza edificios con aire acondicionado');
      recommendations.push('☀️ Mide temperatura antes y después');
    } else if (intervention.id === 'tree-planting') {
      recommendations.push('🌳 Espaciamiento adecuado (6-8m entre árboles)');
      recommendations.push('💧 Plan de riego para primeros 2 años');
      recommendations.push('👨‍🌾 Capacita a vecinos en mantenimiento');
      if (area > 100) {
        recommendations.push('📋 Registra y monitorea cada árbol');
      }
    }

    return recommendations;
  }

  /**
   * Genera comparación entre escenarios
   */
  _generateComparison(results) {
    const comparison = {};

    // Comparar por cada tipo de impacto
    const impactTypes = new Set();
    results.forEach(r => {
      Object.keys(r.impacts).forEach(key => impactTypes.add(key));
    });

    for (const impactType of impactTypes) {
      const values = results.map((r, idx) => ({
        scenarioId: idx + 1,
        value: r.impacts[impactType]?.absValue || 0,
        formatted: r.impacts[impactType]?.formatted || 'N/A'
      }));

      const best = values.reduce((max, current) => 
        current.value > max.value ? current : max
      );

      comparison[impactType] = {
        values,
        best: best.scenarioId
      };
    }

    return comparison;
  }
}

module.exports = new ScenarioSimulatorService();
