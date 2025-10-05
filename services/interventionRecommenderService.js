/**
 * INTERVENTION RECOMMENDER SERVICE
 * Sistema de recomendación de intervenciones con priorización multicriterio
 * 
 * Utiliza métodos AHP (Analytic Hierarchy Process) y TOPSIS
 * para ordenar barrios por vulnerabilidad y proponer intervenciones óptimas.
 * 
 * Referencias:
 * - Saaty, T.L. (1980). The Analytic Hierarchy Process
 * - Hwang & Yoon (1981). Multiple Attribute Decision Making
 * - IPCC (2014). Climate Change Vulnerability Assessment
 */

const neighborhoodAnalysisService = require('./neighborhoodAnalysisService');
const scenarioSimulatorService = require('./scenarioSimulatorService');

class InterventionRecommenderService {
  constructor() {
    // Pesos para criterios de vulnerabilidad (AHP)
    // Basados en consulta a expertos y literatura
    this.vulnerabilityCriteria = {
      heat: {
        weight: 0.30,
        name: 'Vulnerabilidad al Calor',
        description: 'Temperatura superficial y efecto isla de calor',
        ideal: 'minimize' // menor es mejor
      },
      vegetation: {
        weight: 0.25,
        name: 'Déficit de Vegetación',
        description: 'Falta de cobertura vegetal (NDVI bajo)',
        ideal: 'maximize' // mayor NDVI es mejor, pero invertimos para vulnerabilidad
      },
      airQuality: {
        weight: 0.20,
        name: 'Calidad del Aire',
        description: 'Concentración de PM2.5',
        ideal: 'minimize'
      },
      waterStress: {
        weight: 0.15,
        name: 'Estrés Hídrico',
        description: 'Disponibilidad de agua (NDWI)',
        ideal: 'maximize' // mayor NDWI es mejor
      },
      socialVulnerability: {
        weight: 0.10,
        name: 'Vulnerabilidad Social',
        description: 'Población vulnerable (estimado)',
        ideal: 'minimize'
      }
    };

    // Consistencia de pesos (debe sumar 1.0)
    const totalWeight = Object.values(this.vulnerabilityCriteria)
      .reduce((sum, c) => sum + c.weight, 0);
    
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(`⚠️ Los pesos de criterios suman ${totalWeight}, se normalizarán a 1.0`);
    }

    // Catálogo de intervenciones posibles
    this.interventionCatalog = [
      {
        id: 'urban_parks',
        name: 'Parques Urbanos',
        interventionType: 'urban_park',
        description: 'Crear o rehabilitar parques públicos',
        targetCriteria: ['heat', 'vegetation', 'airQuality'],
        effectiveness: {
          heat: 0.85,      // Alta reducción de temperatura
          vegetation: 0.90, // Muy alto aumento de NDVI
          airQuality: 0.70, // Moderada mejora de aire
          waterStress: 0.60 // Moderada retención de agua
        },
        costPerHectare: 150000, // USD (estimado)
        maintenancePerYear: 8000,
        implementationTime: 12, // meses
        viability: 'medium',
        cobenefits: ['recreación', 'biodiversidad', 'cohesión social']
      },
      {
        id: 'green_roofs',
        name: 'Techos Verdes',
        interventionType: 'green_roof',
        description: 'Instalar cubiertas vegetales en edificios',
        targetCriteria: ['heat', 'airQuality', 'waterStress'],
        effectiveness: {
          heat: 0.75,
          vegetation: 0.65,
          airQuality: 0.60,
          waterStress: 0.80 // Alta retención de agua lluvia
        },
        costPerM2: 80, // USD
        maintenancePerYear: 5,
        implementationTime: 3,
        viability: 'high',
        cobenefits: ['eficiencia energética', 'aislamiento térmico']
      },
      {
        id: 'cool_pavements',
        name: 'Pavimentos Fríos',
        interventionType: 'cool_paint',
        description: 'Pintura reflectiva y superficies de bajo albedo',
        targetCriteria: ['heat'],
        effectiveness: {
          heat: 0.70,
          vegetation: 0.00,
          airQuality: 0.10,
          waterStress: 0.05
        },
        costPerM2: 15,
        maintenancePerYear: 2,
        implementationTime: 1,
        viability: 'high',
        cobenefits: ['visibilidad nocturna', 'bajo mantenimiento']
      },
      {
        id: 'street_trees',
        name: 'Arbolado Urbano',
        interventionType: 'tree_planting',
        description: 'Plantar árboles en calles y espacios públicos',
        targetCriteria: ['heat', 'vegetation', 'airQuality'],
        effectiveness: {
          heat: 0.80,
          vegetation: 0.85,
          airQuality: 0.75,
          waterStress: 0.40
        },
        costPerTree: 250,
        maintenancePerYear: 50,
        implementationTime: 6,
        viability: 'high',
        cobenefits: ['sombra peatonal', 'belleza escénica', 'biodiversidad']
      },
      {
        id: 'green_corridors',
        name: 'Corredores Verdes',
        interventionType: 'urban_park', // Similar a parques pero lineales
        description: 'Conectar áreas verdes con caminos vegetados',
        targetCriteria: ['heat', 'vegetation', 'airQuality'],
        effectiveness: {
          heat: 0.75,
          vegetation: 0.80,
          airQuality: 0.65,
          waterStress: 0.50
        },
        costPerKm: 500000,
        maintenancePerYear: 20000,
        implementationTime: 18,
        viability: 'medium',
        cobenefits: ['movilidad activa', 'conectividad ecológica']
      }
    ];
  }

  /**
   * Calcula el índice de vulnerabilidad de un barrio usando TOPSIS
   * @param {Object} analysis - Análisis del barrio
   * @returns {Object} Índice de vulnerabilidad y desglose
   */
  calculateVulnerabilityIndex(analysis) {
    const criteria = {};
    
    // Extraer valores de criterios
    criteria.heat = analysis.indices.heat?.value || 0;
    criteria.vegetation = 1 - (analysis.indices.vegetation?.value || 0.5); // Invertir (bajo NDVI = alta vulnerabilidad)
    criteria.airQuality = analysis.indices.air?.value || 0;
    criteria.waterStress = 1 - (analysis.indices.water?.value || 0.5); // Invertir
    
    // Estimar vulnerabilidad social (proxy: inverso del overall score)
    criteria.socialVulnerability = 1 - (analysis.overallScore || 50) / 100;

    // Normalizar valores (0-1)
    const normalized = {
      heat: this._normalize(criteria.heat, 20, 35), // Rango típico 20-35°C
      vegetation: criteria.vegetation, // Ya normalizado 0-1
      airQuality: this._normalize(criteria.airQuality, 0, 100), // PM2.5
      waterStress: criteria.waterStress, // Ya normalizado 0-1
      socialVulnerability: criteria.socialVulnerability // Ya normalizado 0-1
    };

    // Aplicar pesos (weighted sum)
    let vulnerabilityScore = 0;
    const breakdown = {};

    for (const [key, criterion] of Object.entries(this.vulnerabilityCriteria)) {
      const value = normalized[key] || 0;
      const contribution = value * criterion.weight;
      vulnerabilityScore += contribution;
      
      breakdown[key] = {
        rawValue: criteria[key],
        normalizedValue: value,
        weight: criterion.weight,
        contribution: contribution,
        status: this._getVulnerabilityStatus(value)
      };
    }

    // Clasificar vulnerabilidad
    let classification;
    let priority;
    
    if (vulnerabilityScore >= 0.7) {
      classification = 'critical';
      priority = 1;
    } else if (vulnerabilityScore >= 0.5) {
      classification = 'high';
      priority = 2;
    } else if (vulnerabilityScore >= 0.3) {
      classification = 'medium';
      priority = 3;
    } else {
      classification = 'low';
      priority = 4;
    }

    return {
      score: vulnerabilityScore,
      classification,
      priority,
      breakdown,
      neighborhoodId: analysis.neighborhood.id,
      neighborhoodName: analysis.neighborhood.name,
      population: analysis.neighborhood.population || 0
    };
  }

  /**
   * Recomienda intervenciones para un barrio específico
   * @param {string} neighborhoodId - ID del barrio
   * @param {Object} options - Opciones (budget, timeframe, etc.)
   * @returns {Object} Recomendaciones priorizadas
   */
  async recommendInterventions(neighborhoodId, options = {}) {
    const {
      budget = 1000000,        // USD
      timeframe = 24,          // meses
      maxInterventions = 5,
      prioritizeCriteria = null // null = usar vulnerabilidad, o array de criterios
    } = options;

    // Obtener análisis del barrio
    const analysis = await neighborhoodAnalysisService.analyzeNeighborhood(neighborhoodId);
    
    // Calcular vulnerabilidad
    const vulnerability = this.calculateVulnerabilityIndex(analysis);

    // Identificar criterios más críticos
    const criticalCriteria = Object.entries(vulnerability.breakdown)
      .filter(([_, data]) => data.normalizedValue > 0.6)
      .sort((a, b) => b[1].contribution - a[1].contribution)
      .map(([key, _]) => key);

    // Filtrar intervenciones relevantes
    let relevantInterventions = this.interventionCatalog.filter(intervention => {
      // Debe abordar al menos uno de los criterios críticos
      return intervention.targetCriteria.some(tc => criticalCriteria.includes(tc));
    });

    // Calcular efectividad ponderada de cada intervención
    const scoredInterventions = relevantInterventions.map(intervention => {
      let effectivenessScore = 0;
      
      for (const [criterion, data] of Object.entries(vulnerability.breakdown)) {
        const effectiveness = intervention.effectiveness[criterion] || 0;
        const weight = data.weight;
        const needIntensity = data.normalizedValue;
        
        // Score = efectividad × peso del criterio × intensidad de la necesidad
        effectivenessScore += effectiveness * weight * needIntensity;
      }

      // Estimar costo según tipo
      let estimatedCost;
      let suggestedScale;
      
      if (intervention.id === 'urban_parks') {
        // Sugerir parques proporcionales al tamaño del barrio
        const parkHectares = Math.ceil(analysis.neighborhood.population / 50000); // 1 ha por 50k hab
        estimatedCost = parkHectares * intervention.costPerHectare;
        suggestedScale = { hectares: parkHectares, unit: 'hectáreas' };
      } else if (intervention.id === 'green_roofs') {
        // Sugerir techos verdes en edificios públicos (estimado)
        const roofM2 = 5000; // Ejemplo: 5 edificios × 1000 m² c/u
        estimatedCost = roofM2 * intervention.costPerM2;
        suggestedScale = { m2: roofM2, unit: 'm²' };
      } else if (intervention.id === 'cool_pavements') {
        // Pintar calles principales (estimado)
        const pavementM2 = 20000;
        estimatedCost = pavementM2 * intervention.costPerM2;
        suggestedScale = { m2: pavementM2, unit: 'm²' };
      } else if (intervention.id === 'street_trees') {
        // Plantar árboles en todas las calles (estimado)
        const trees = Math.ceil(analysis.neighborhood.population / 100); // 1 árbol por 100 hab
        estimatedCost = trees * intervention.costPerTree;
        suggestedScale = { trees, unit: 'árboles' };
      } else if (intervention.id === 'green_corridors') {
        // Un corredor de 2 km conectando zonas clave
        const km = 2;
        estimatedCost = km * intervention.costPerKm;
        suggestedScale = { km, unit: 'kilómetros' };
      }

      // Calcular score cost-benefit (mayor efectividad por dólar = mejor)
      const costBenefitRatio = effectivenessScore / estimatedCost;

      // Calcular viabilidad temporal
      const temporalFeasibility = timeframe >= intervention.implementationTime ? 1.0 : 0.5;

      // Calcular viabilidad presupuestal
      const budgetFeasibility = budget >= estimatedCost ? 1.0 : 
                                budget >= estimatedCost * 0.5 ? 0.7 :
                                0.3;

      // Score final considerando todos los factores
      const finalScore = effectivenessScore * 0.5 + 
                        costBenefitRatio * 100000 * 0.3 + 
                        temporalFeasibility * 0.1 +
                        budgetFeasibility * 0.1;

      return {
        ...intervention,
        effectivenessScore,
        estimatedCost,
        suggestedScale,
        costBenefitRatio,
        temporalFeasibility,
        budgetFeasibility,
        finalScore,
        feasible: budgetFeasibility >= 0.7 && temporalFeasibility >= 0.7
      };
    });

    // Ordenar por score final (mayor a menor)
    scoredInterventions.sort((a, b) => b.finalScore - a.finalScore);

    // Seleccionar top N que caben en el presupuesto
    const selectedInterventions = [];
    let remainingBudget = budget;

    for (const intervention of scoredInterventions) {
      if (selectedInterventions.length >= maxInterventions) break;
      
      if (intervention.estimatedCost <= remainingBudget) {
        selectedInterventions.push(intervention);
        remainingBudget -= intervention.estimatedCost;
      }
    }

    // Simular impacto combinado de las intervenciones seleccionadas
    let combinedImpact = null;
    if (selectedInterventions.length > 0) {
      combinedImpact = this._simulateCombinedImpact(
        selectedInterventions,
        vulnerability
      );
    }

    return {
      neighborhoodId,
      neighborhoodName: analysis.neighborhood.name,
      vulnerability,
      criticalCriteria,
      recommendations: selectedInterventions,
      totalCost: budget - remainingBudget,
      remainingBudget,
      combinedImpact,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Prioriza barrios por vulnerabilidad (ranking)
   * @param {Array} neighborhoodIds - IDs de barrios a analizar
   * @returns {Array} Barrios ordenados por vulnerabilidad (mayor a menor)
   */
  async prioritizeNeighborhoods(neighborhoodIds = null) {
    // Si no se especifican IDs, usar todos los disponibles
    if (!neighborhoodIds) {
      const allNeighborhoods = neighborhoodAnalysisService.getNeighborhoods();
      neighborhoodIds = allNeighborhoods.map(n => n.id);
    }

    // Analizar cada barrio
    const vulnerabilities = [];
    
    for (const id of neighborhoodIds) {
      try {
        const analysis = await neighborhoodAnalysisService.analyzeNeighborhood(id);
        const vulnerability = this.calculateVulnerabilityIndex(analysis);
        vulnerabilities.push(vulnerability);
      } catch (error) {
        console.warn(`No se pudo analizar barrio ${id}:`, error.message);
      }
    }

    // Ordenar por score de vulnerabilidad (mayor = más vulnerable = mayor prioridad)
    vulnerabilities.sort((a, b) => b.score - a.score);

    // Agregar ranking
    vulnerabilities.forEach((v, index) => {
      v.rank = index + 1;
    });

    return vulnerabilities;
  }

  /**
   * Genera portafolio de intervenciones para múltiples barrios
   * @param {Object} options - budget total, timeframe, etc.
   * @returns {Object} Portafolio optimizado
   */
  async generateInterventionPortfolio(options = {}) {
    const {
      totalBudget = 5000000,
      timeframe = 36,
      neighborhoodIds = null
    } = options;

    // Priorizar barrios
    const prioritizedNeighborhoods = await this.prioritizeNeighborhoods(neighborhoodIds);

    // Asignar presupuesto proporcional a vulnerabilidad
    const totalVulnerabilityScore = prioritizedNeighborhoods
      .reduce((sum, n) => sum + n.score, 0);

    const portfolio = [];
    let remainingBudget = totalBudget;

    for (const neighborhood of prioritizedNeighborhoods) {
      if (remainingBudget <= 0) break;

      // Presupuesto asignado = proporción de vulnerabilidad
      const budgetAllocation = (neighborhood.score / totalVulnerabilityScore) * totalBudget;
      const actualBudget = Math.min(budgetAllocation, remainingBudget);

      // Recomendar intervenciones para este barrio
      const recommendations = await this.recommendInterventions(
        neighborhood.neighborhoodId,
        {
          budget: actualBudget,
          timeframe,
          maxInterventions: 3
        }
      );

      portfolio.push({
        ...neighborhood,
        budgetAllocated: actualBudget,
        interventions: recommendations.recommendations,
        expectedImpact: recommendations.combinedImpact
      });

      remainingBudget -= recommendations.totalCost;
    }

    // Calcular métricas del portafolio
    const totalInvestment = totalBudget - remainingBudget;
    const totalInterventions = portfolio.reduce((sum, p) => sum + p.interventions.length, 0);
    const populationBenefited = portfolio.reduce((sum, p) => sum + p.population, 0);

    return {
      portfolio,
      summary: {
        totalBudget,
        totalInvestment,
        remainingBudget,
        totalInterventions,
        neighborhoodsIncluded: portfolio.length,
        populationBenefited,
        averageVulnerabilityReduction: this._calculateAvgImpact(portfolio)
      },
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================================
  // MÉTODOS AUXILIARES
  // ============================================================================

  /**
   * Normaliza un valor a rango 0-1
   */
  _normalize(value, min, max) {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Clasifica nivel de vulnerabilidad
   */
  _getVulnerabilityStatus(normalizedValue) {
    if (normalizedValue >= 0.7) return 'critical';
    if (normalizedValue >= 0.5) return 'high';
    if (normalizedValue >= 0.3) return 'medium';
    return 'low';
  }

  /**
   * Simula impacto combinado de múltiples intervenciones
   */
  _simulateCombinedImpact(interventions, vulnerability) {
    const impact = {
      heat: { reduction: 0, unit: '°C' },
      vegetation: { increase: 0, unit: 'NDVI' },
      airQuality: { improvement: 0, unit: '%' },
      waterStress: { improvement: 0, unit: '%' },
      vulnerabilityReduction: 0
    };

    // Sumar efectos (con decremento por efectos marginales)
    for (let i = 0; i < interventions.length; i++) {
      const intervention = interventions[i];
      const diminishingFactor = 1 / (1 + i * 0.2); // Cada intervención adicional tiene 20% menos efecto

      // Estimar reducciones basadas en efectividad
      impact.heat.reduction += (intervention.effectiveness.heat || 0) * 5 * diminishingFactor;
      impact.vegetation.increase += (intervention.effectiveness.vegetation || 0) * 0.2 * diminishingFactor;
      impact.airQuality.improvement += (intervention.effectiveness.airQuality || 0) * 30 * diminishingFactor;
      impact.waterStress.improvement += (intervention.effectiveness.waterStress || 0) * 25 * diminishingFactor;
    }

    // Calcular reducción esperada de vulnerabilidad
    impact.vulnerabilityReduction = (
      (impact.heat.reduction / 10) * vulnerability.breakdown.heat.weight +
      (impact.vegetation.increase / 0.3) * vulnerability.breakdown.vegetation.weight +
      (impact.airQuality.improvement / 50) * vulnerability.breakdown.airQuality.weight +
      (impact.waterStress.improvement / 50) * vulnerability.breakdown.waterStress.weight
    );

    // Redondear valores
    impact.heat.reduction = Math.round(impact.heat.reduction * 10) / 10;
    impact.vegetation.increase = Math.round(impact.vegetation.increase * 100) / 100;
    impact.airQuality.improvement = Math.round(impact.airQuality.improvement);
    impact.waterStress.improvement = Math.round(impact.waterStress.improvement);
    impact.vulnerabilityReduction = Math.round(impact.vulnerabilityReduction * 100);

    return impact;
  }

  /**
   * Calcula impacto promedio del portafolio
   */
  _calculateAvgImpact(portfolio) {
    if (portfolio.length === 0) return 0;
    
    const totalReduction = portfolio.reduce((sum, p) => {
      return sum + (p.expectedImpact?.vulnerabilityReduction || 0);
    }, 0);

    return Math.round(totalReduction / portfolio.length);
  }

  /**
   * Obtiene catálogo de intervenciones
   */
  getInterventionCatalog() {
    return this.interventionCatalog.map(i => ({
      id: i.id,
      name: i.name,
      description: i.description,
      targetCriteria: i.targetCriteria,
      viability: i.viability,
      cobenefits: i.cobenefits
    }));
  }
}

// Exportar instancia singleton
const interventionRecommenderService = new InterventionRecommenderService();
module.exports = interventionRecommenderService;
