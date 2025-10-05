/**
 * RECOMMENDATION PDF SERVICE
 * Genera reportes PDF automáticos con recomendaciones de intervenciones
 * 
 * Incluye:
 * - Ranking de barrios por vulnerabilidad
 * - Intervenciones recomendadas con costos
 * - Gráficos de impacto esperado
 * - Mapas de localización
 * - Cronograma de implementación
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class RecommendationPdfService {
  constructor() {
    this.colors = {
      primary: '#2E7D32',
      secondary: '#1976D2',
      critical: '#D32F2F',
      high: '#F57C00',
      medium: '#FBC02D',
      low: '#388E3C',
      text: '#212121',
      textLight: '#757575',
      background: '#FAFAFA',
      white: '#FFFFFF'
    };

    this.fonts = {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique'
    };
  }

  /**
   * Genera PDF de recomendaciones para un barrio
   * @param {Object} recommendations - Resultado de recommendInterventions()
   * @param {string} outputPath - Ruta del archivo PDF a generar
   * @returns {Promise<string>} Ruta del PDF generado
   */
  async generateNeighborhoodReport(recommendations, outputPath = null) {
    if (!outputPath) {
      const filename = `recomendaciones_${recommendations.neighborhoodId}_${Date.now()}.pdf`;
      outputPath = path.join(__dirname, '../reports', filename);
    }

    // Asegurar que existe el directorio
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Recomendaciones de Intervenciones - ${recommendations.neighborhoodName}`,
            Author: 'EcoPlan - Plataforma de Ciencia Ciudadana',
            Subject: 'Análisis de vulnerabilidad y recomendaciones de intervenciones ambientales',
            Keywords: 'vulnerabilidad, intervenciones, medio ambiente, planificación urbana'
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // ===== PORTADA =====
        this._addCoverPage(doc, recommendations);

        // ===== RESUMEN EJECUTIVO =====
        doc.addPage();
        this._addExecutiveSummary(doc, recommendations);

        // ===== ANÁLISIS DE VULNERABILIDAD =====
        doc.addPage();
        this._addVulnerabilityAnalysis(doc, recommendations);

        // ===== RECOMENDACIONES DETALLADAS =====
        doc.addPage();
        this._addDetailedRecommendations(doc, recommendations);

        // ===== ANÁLISIS DE COSTOS =====
        doc.addPage();
        this._addCostAnalysis(doc, recommendations);

        // ===== IMPACTO ESPERADO =====
        doc.addPage();
        this._addExpectedImpact(doc, recommendations);

        // ===== CRONOGRAMA =====
        doc.addPage();
        this._addImplementationTimeline(doc, recommendations);

        // ===== PIE DE PÁGINA =====
        this._addFooter(doc, recommendations);

        doc.end();

        stream.on('finish', () => {
          console.log(`✅ PDF generado: ${outputPath}`);
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          console.error('❌ Error al generar PDF:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera PDF del portafolio completo (múltiples barrios)
   * @param {Object} portfolio - Resultado de generateInterventionPortfolio()
   * @param {string} outputPath - Ruta del archivo PDF
   * @returns {Promise<string>} Ruta del PDF generado
   */
  async generatePortfolioReport(portfolio, outputPath = null) {
    if (!outputPath) {
      const filename = `portafolio_intervenciones_${Date.now()}.pdf`;
      outputPath = path.join(__dirname, '../reports', filename);
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // ===== PORTADA =====
        this._addPortfolioCoverPage(doc, portfolio);

        // ===== RESUMEN EJECUTIVO DEL PORTAFOLIO =====
        doc.addPage();
        this._addPortfolioSummary(doc, portfolio);

        // ===== RANKING DE BARRIOS =====
        doc.addPage();
        this._addNeighborhoodRanking(doc, portfolio);

        // ===== DISTRIBUCIÓN DE PRESUPUESTO =====
        doc.addPage();
        this._addBudgetDistribution(doc, portfolio);

        // ===== RESUMEN POR BARRIO =====
        for (const neighborhood of portfolio.portfolio) {
          doc.addPage();
          this._addNeighborhoodSummaryInPortfolio(doc, neighborhood);
        }

        // ===== MATRIZ DE PRIORIZACIÓN =====
        doc.addPage();
        this._addPrioritizationMatrix(doc, portfolio);

        doc.end();

        stream.on('finish', () => {
          console.log(`✅ PDF de portafolio generado: ${outputPath}`);
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          console.error('❌ Error al generar PDF de portafolio:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================================================
  // SECCIONES DEL PDF - REPORTE INDIVIDUAL
  // ============================================================================

  _addCoverPage(doc, recommendations) {
    const { neighborhoodName, vulnerability } = recommendations;

    // Fondo de color según vulnerabilidad
    const bgColor = this._getVulnerabilityColor(vulnerability.classification);
    doc.rect(0, 0, 595, 300).fill(bgColor);

    // Título principal
    doc.fillColor(this.colors.white)
       .fontSize(32)
       .font(this.fonts.bold)
       .text('RECOMENDACIONES DE', 50, 100, { align: 'center' })
       .text('INTERVENCIONES AMBIENTALES', 50, 140, { align: 'center' });

    // Nombre del barrio
    doc.fontSize(24)
       .font(this.fonts.regular)
       .text(neighborhoodName, 50, 200, { align: 'center' });

    // Clasificación de vulnerabilidad
    const classText = {
      critical: 'VULNERABILIDAD CRÍTICA',
      high: 'VULNERABILIDAD ALTA',
      medium: 'VULNERABILIDAD MEDIA',
      low: 'VULNERABILIDAD BAJA'
    }[vulnerability.classification];

    doc.fontSize(16)
       .font(this.fonts.bold)
       .text(classText, 50, 240, { align: 'center' });

    // Información de generación
    doc.fillColor(this.colors.text)
       .fontSize(10)
       .font(this.fonts.regular)
       .text(`Generado: ${new Date().toLocaleDateString('es-PE', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       })}`, 50, 700, { align: 'center' })
       .text('EcoPlan - Plataforma de Ciencia Ciudadana Ambiental', 50, 715, { align: 'center' })
       .text('www.ecoplan.gob.pe', 50, 730, { align: 'center' });
  }

  _addExecutiveSummary(doc, recommendations) {
    this._addSectionTitle(doc, '📊 RESUMEN EJECUTIVO');

    const { vulnerability, recommendations: interventions, totalCost, combinedImpact } = recommendations;

    let y = 130;

    // Índice de vulnerabilidad
    doc.fontSize(11)
       .font(this.fonts.bold)
       .fillColor(this.colors.text)
       .text('Índice de Vulnerabilidad:', 50, y);
    
    doc.font(this.fonts.regular)
       .text(`${(vulnerability.score * 100).toFixed(1)}%`, 250, y);
    
    y += 20;

    // Prioridad
    doc.font(this.fonts.bold)
       .text('Prioridad de Atención:', 50, y);
    
    doc.font(this.fonts.regular)
       .text(`Nivel ${vulnerability.priority} (${vulnerability.classification.toUpperCase()})`, 250, y);
    
    y += 20;

    // Población beneficiada
    doc.font(this.fonts.bold)
       .text('Población Beneficiada:', 50, y);
    
    doc.font(this.fonts.regular)
       .text(`~${vulnerability.population.toLocaleString('es-PE')} habitantes`, 250, y);
    
    y += 30;

    // Intervenciones recomendadas
    doc.font(this.fonts.bold)
       .fontSize(12)
       .text('Intervenciones Recomendadas:', 50, y);
    
    y += 20;

    if (interventions.length === 0) {
      doc.font(this.fonts.italic)
         .fontSize(10)
         .fillColor(this.colors.textLight)
         .text('No se encontraron intervenciones viables con el presupuesto disponible.', 50, y);
    } else {
      interventions.forEach((intervention, index) => {
        doc.font(this.fonts.regular)
           .fontSize(10)
           .fillColor(this.colors.text)
           .text(`${index + 1}. ${intervention.name}`, 60, y)
           .text(`$${intervention.estimatedCost.toLocaleString('es-PE')}`, 400, y);
        
        y += 18;
      });

      y += 10;

      // Costo total
      doc.font(this.fonts.bold)
         .fontSize(11)
         .text('Inversión Total:', 50, y);
      
      doc.font(this.fonts.bold)
         .text(`$${totalCost.toLocaleString('es-PE')} USD`, 400, y);
    }

    y += 30;

    // Impacto esperado
    if (combinedImpact) {
      doc.font(this.fonts.bold)
         .fontSize(12)
         .text('Impacto Esperado:', 50, y);
      
      y += 20;

      doc.font(this.fonts.regular)
         .fontSize(10)
         .text(`• Reducción de temperatura: -${combinedImpact.heat.reduction}°C`, 60, y);
      y += 18;
      
      doc.text(`• Aumento de vegetación: +${combinedImpact.vegetation.increase} NDVI`, 60, y);
      y += 18;
      
      doc.text(`• Mejora de calidad del aire: +${combinedImpact.airQuality.improvement}%`, 60, y);
      y += 18;
      
      doc.text(`• Reducción de vulnerabilidad: ${combinedImpact.vulnerabilityReduction}%`, 60, y);
    }
  }

  _addVulnerabilityAnalysis(doc, recommendations) {
    this._addSectionTitle(doc, '🔍 ANÁLISIS DE VULNERABILIDAD');

    const { vulnerability } = recommendations;
    let y = 130;

    doc.fontSize(10)
       .font(this.fonts.regular)
       .fillColor(this.colors.text)
       .text('Este análisis utiliza metodología TOPSIS (Technique for Order Preference by Similarity to Ideal Solution)', 50, y, { 
         width: 495, 
         align: 'justify' 
       });
    
    y += 40;

    // Tabla de criterios
    doc.font(this.fonts.bold)
       .fontSize(11)
       .text('Desglose por Criterio:', 50, y);
    
    y += 25;

    // Cabecera de tabla
    const tableTop = y;
    const col1 = 50;
    const col2 = 220;
    const col3 = 320;
    const col4 = 420;
    const col5 = 490;

    doc.font(this.fonts.bold)
       .fontSize(9)
       .text('Criterio', col1, tableTop)
       .text('Valor', col2, tableTop)
       .text('Peso', col3, tableTop)
       .text('Aporte', col4, tableTop)
       .text('Estado', col5, tableTop);

    y = tableTop + 15;

    // Línea separadora
    doc.moveTo(col1, y)
       .lineTo(535, y)
       .stroke();

    y += 10;

    // Filas de datos
    Object.entries(vulnerability.breakdown).forEach(([key, data]) => {
      const criterionName = {
        heat: 'Calor',
        vegetation: 'Vegetación',
        airQuality: 'Calidad del Aire',
        waterStress: 'Estrés Hídrico',
        socialVulnerability: 'Vulnerab. Social'
      }[key] || key;

      doc.font(this.fonts.regular)
         .fontSize(9)
         .text(criterionName, col1, y)
         .text(data.rawValue.toFixed(2), col2, y)
         .text(`${(data.weight * 100).toFixed(0)}%`, col3, y)
         .text(data.contribution.toFixed(3), col4, y);

      // Indicador de estado (color)
      const statusColor = this._getVulnerabilityColor(data.status);
      doc.circle(col5 + 5, y + 5, 4)
         .fill(statusColor);

      y += 18;
    });

    y += 20;

    // Conclusión
    doc.font(this.fonts.bold)
       .fontSize(10)
       .fillColor(this.colors.text)
       .text('Conclusión:', 50, y);
    
    y += 15;

    const conclusion = this._getVulnerabilityConclusion(vulnerability);
    doc.font(this.fonts.regular)
       .fontSize(10)
       .text(conclusion, 50, y, { width: 495, align: 'justify' });
  }

  _addDetailedRecommendations(doc, recommendations) {
    this._addSectionTitle(doc, '💡 RECOMENDACIONES DETALLADAS');

    const { recommendations: interventions } = recommendations;
    let y = 130;

    if (interventions.length === 0) {
      doc.font(this.fonts.italic)
         .fontSize(10)
         .fillColor(this.colors.textLight)
         .text('No hay intervenciones recomendadas con el presupuesto actual.', 50, y);
      return;
    }

    interventions.forEach((intervention, index) => {
      // Verificar si necesitamos nueva página
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      // Número y nombre
      doc.font(this.fonts.bold)
         .fontSize(14)
         .fillColor(this.colors.primary)
         .text(`${index + 1}. ${intervention.name}`, 50, y);

      y += 20;

      // Descripción
      doc.font(this.fonts.regular)
         .fontSize(10)
         .fillColor(this.colors.text)
         .text(intervention.description, 50, y, { width: 495 });

      y += 25;

      // Escala sugerida
      if (intervention.suggestedScale) {
        doc.font(this.fonts.bold)
           .text('Escala Recomendada:', 50, y);
        
        doc.font(this.fonts.regular)
           .text(`${intervention.suggestedScale[Object.keys(intervention.suggestedScale)[0]]} ${intervention.suggestedScale.unit}`, 200, y);
        
        y += 18;
      }

      // Costo
      doc.font(this.fonts.bold)
         .text('Costo Estimado:', 50, y);
      
      doc.font(this.fonts.regular)
         .text(`$${intervention.estimatedCost.toLocaleString('es-PE')} USD`, 200, y);
      
      y += 18;

      // Tiempo de implementación
      doc.font(this.fonts.bold)
         .text('Tiempo de Implementación:', 50, y);
      
      doc.font(this.fonts.regular)
         .text(`${intervention.implementationTime} meses`, 200, y);
      
      y += 18;

      // Viabilidad
      doc.font(this.fonts.bold)
         .text('Viabilidad:', 50, y);
      
      const viabilityText = {
        high: 'Alta ✓',
        medium: 'Media ●',
        low: 'Baja ▼'
      }[intervention.viability];
      
      doc.font(this.fonts.regular)
         .text(viabilityText, 200, y);
      
      y += 25;

      // Co-beneficios
      doc.font(this.fonts.bold)
         .text('Co-beneficios:', 50, y);
      
      y += 15;

      intervention.cobenefits.forEach(benefit => {
        doc.font(this.fonts.regular)
           .fontSize(9)
           .text(`• ${benefit}`, 60, y);
        y += 14;
      });

      y += 15;

      // Línea separadora
      if (index < interventions.length - 1) {
        doc.moveTo(50, y)
           .lineTo(545, y)
           .strokeColor(this.colors.textLight)
           .stroke();
        y += 20;
      }
    });
  }

  _addCostAnalysis(doc, recommendations) {
    this._addSectionTitle(doc, '💰 ANÁLISIS DE COSTOS');

    const { recommendations: interventions, totalCost, remainingBudget } = recommendations;
    let y = 130;

    if (interventions.length === 0) {
      doc.font(this.fonts.italic)
         .fontSize(10)
         .text('No hay análisis de costos disponible.', 50, y);
      return;
    }

    // Tabla de costos
    const tableTop = y;
    const col1 = 50;
    const col2 = 300;
    const col3 = 450;

    // Cabecera
    doc.font(this.fonts.bold)
       .fontSize(10)
       .text('Intervención', col1, tableTop)
       .text('Costo', col2, tableTop)
       .text('% del Total', col3, tableTop);

    y = tableTop + 18;

    doc.moveTo(col1, y)
       .lineTo(535, y)
       .stroke();

    y += 10;

    // Filas
    interventions.forEach(intervention => {
      doc.font(this.fonts.regular)
         .fontSize(9)
         .text(intervention.name, col1, y, { width: 230 })
         .text(`$${intervention.estimatedCost.toLocaleString('es-PE')}`, col2, y)
         .text(`${((intervention.estimatedCost / totalCost) * 100).toFixed(1)}%`, col3, y);

      y += 18;
    });

    y += 10;

    // Total
    doc.moveTo(col1, y)
       .lineTo(535, y)
       .stroke();

    y += 10;

    doc.font(this.fonts.bold)
       .fontSize(10)
       .text('INVERSIÓN TOTAL', col1, y)
       .text(`$${totalCost.toLocaleString('es-PE')} USD`, col2, y);

    y += 30;

    // Costo por habitante
    const costPerCapita = totalCost / recommendations.vulnerability.population;
    doc.font(this.fonts.regular)
       .fontSize(10)
       .text('Inversión por habitante:', col1, y)
       .text(`$${costPerCapita.toFixed(2)} USD`, col2, y);

    y += 40;

    // Presupuesto restante
    if (remainingBudget > 0) {
      doc.fontSize(9)
         .fillColor(this.colors.textLight)
         .text(`Nota: Presupuesto no utilizado: $${remainingBudget.toLocaleString('es-PE')} USD`, 50, y, { 
           width: 495, 
           align: 'justify' 
         });
    }
  }

  _addExpectedImpact(doc, recommendations) {
    this._addSectionTitle(doc, '📈 IMPACTO ESPERADO');

    const { combinedImpact, vulnerability } = recommendations;
    let y = 130;

    if (!combinedImpact) {
      doc.font(this.fonts.italic)
         .fontSize(10)
         .text('No hay proyecciones de impacto disponibles.', 50, y);
      return;
    }

    doc.fontSize(10)
       .font(this.fonts.regular)
       .text('Estas proyecciones se basan en coeficientes científicos y experiencias internacionales.', 50, y, { 
         width: 495, 
         align: 'justify' 
       });

    y += 40;

    // Gráfico de barras simulado (texto)
    const impacts = [
      { label: 'Reducción de Temperatura', value: combinedImpact.heat.reduction, max: 10, unit: '°C', color: this.colors.critical },
      { label: 'Aumento de Vegetación', value: combinedImpact.vegetation.increase, max: 0.5, unit: 'NDVI', color: this.colors.low },
      { label: 'Mejora Calidad del Aire', value: combinedImpact.airQuality.improvement, max: 100, unit: '%', color: this.colors.secondary },
      { label: 'Reducción Vulnerabilidad', value: combinedImpact.vulnerabilityReduction, max: 100, unit: '%', color: this.colors.primary }
    ];

    impacts.forEach(impact => {
      doc.font(this.fonts.bold)
         .fontSize(10)
         .fillColor(this.colors.text)
         .text(impact.label, 50, y);

      y += 15;

      // Barra de progreso
      const barWidth = 400;
      const barHeight = 20;
      const fillWidth = (impact.value / impact.max) * barWidth;

      // Fondo de la barra
      doc.rect(50, y, barWidth, barHeight)
         .fillAndStroke(this.colors.background, this.colors.textLight);

      // Relleno
      doc.rect(50, y, fillWidth, barHeight)
         .fill(impact.color);

      // Valor
      doc.font(this.fonts.bold)
         .fontSize(11)
         .fillColor(this.colors.white)
         .text(`${impact.value}${impact.unit}`, 50 + 10, y + 4);

      y += 35;
    });

    y += 20;

    // Interpretación
    doc.font(this.fonts.bold)
       .fontSize(10)
       .fillColor(this.colors.text)
       .text('Interpretación:', 50, y);

    y += 15;

    const interpretation = this._getImpactInterpretation(combinedImpact, vulnerability);
    doc.font(this.fonts.regular)
       .fontSize(10)
       .text(interpretation, 50, y, { width: 495, align: 'justify' });
  }

  _addImplementationTimeline(doc, recommendations) {
    this._addSectionTitle(doc, '📅 CRONOGRAMA DE IMPLEMENTACIÓN');

    const { recommendations: interventions } = recommendations;
    let y = 130;

    if (interventions.length === 0) {
      doc.font(this.fonts.italic)
         .fontSize(10)
         .text('No hay cronograma disponible.', 50, y);
      return;
    }

    // Ordenar por tiempo de implementación
    const sorted = [...interventions].sort((a, b) => a.implementationTime - b.implementationTime);

    // Fases recomendadas
    let currentMonth = 0;

    sorted.forEach((intervention, index) => {
      doc.font(this.fonts.bold)
         .fontSize(11)
         .fillColor(this.colors.primary)
         .text(`Fase ${index + 1}: ${intervention.name}`, 50, y);

      y += 18;

      doc.font(this.fonts.regular)
         .fontSize(10)
         .fillColor(this.colors.text)
         .text(`Inicio: Mes ${currentMonth + 1}`, 60, y)
         .text(`Duración: ${intervention.implementationTime} meses`, 250, y)
         .text(`Fin: Mes ${currentMonth + intervention.implementationTime}`, 420, y);

      y += 25;

      // Hitos clave
      doc.fontSize(9)
         .text('Hitos clave:', 60, y);

      y += 14;

      const milestones = this._generateMilestones(intervention);
      milestones.forEach(milestone => {
        doc.fontSize(8)
           .text(`• ${milestone}`, 70, y);
        y += 12;
      });

      y += 15;

      currentMonth += intervention.implementationTime;
    });

    y += 10;

    // Duración total
    doc.font(this.fonts.bold)
       .fontSize(11)
       .text(`Duración Total Estimada: ${currentMonth} meses`, 50, y);
  }

  _addFooter(doc, recommendations) {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Línea superior del pie
      doc.moveTo(50, 780)
         .lineTo(545, 780)
         .strokeColor(this.colors.textLight)
         .stroke();

      // Texto del pie
      doc.fontSize(8)
         .fillColor(this.colors.textLight)
         .text(
           `EcoPlan © ${new Date().getFullYear()} | Página ${i + 1} de ${pages.count}`,
           50,
           785,
           { align: 'center', width: 495 }
         );
    }
  }

  // ============================================================================
  // SECCIONES DEL PDF - PORTAFOLIO
  // ============================================================================

  _addPortfolioCoverPage(doc, portfolio) {
    doc.rect(0, 0, 595, 300).fill(this.colors.primary);

    doc.fillColor(this.colors.white)
       .fontSize(32)
       .font(this.fonts.bold)
       .text('PORTAFOLIO DE', 50, 100, { align: 'center' })
       .text('INTERVENCIONES AMBIENTALES', 50, 140, { align: 'center' });

    doc.fontSize(18)
       .font(this.fonts.regular)
       .text(`${portfolio.portfolio.length} Barrios Priorizados`, 50, 220, { align: 'center' });

    doc.fontSize(14)
       .text(`Inversión Total: $${portfolio.summary.totalInvestment.toLocaleString('es-PE')} USD`, 50, 250, { align: 'center' });

    doc.fillColor(this.colors.text)
       .fontSize(10)
       .font(this.fonts.regular)
       .text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, 50, 700, { align: 'center' })
       .text('EcoPlan - Plataforma de Ciencia Ciudadana Ambiental', 50, 715, { align: 'center' });
  }

  _addPortfolioSummary(doc, portfolio) {
    this._addSectionTitle(doc, '📊 RESUMEN EJECUTIVO DEL PORTAFOLIO');

    const { summary } = portfolio;
    let y = 130;

    const items = [
      { label: 'Presupuesto Total', value: `$${summary.totalBudget.toLocaleString('es-PE')} USD` },
      { label: 'Inversión Ejecutada', value: `$${summary.totalInvestment.toLocaleString('es-PE')} USD` },
      { label: 'Barrios Beneficiados', value: summary.neighborhoodsIncluded },
      { label: 'Población Beneficiada', value: `~${summary.populationBenefited.toLocaleString('es-PE')} hab.` },
      { label: 'Total de Intervenciones', value: summary.totalInterventions },
      { label: 'Reducción Prom. Vulnerabilidad', value: `${summary.averageVulnerabilityReduction}%` }
    ];

    items.forEach(item => {
      doc.font(this.fonts.bold)
         .fontSize(11)
         .fillColor(this.colors.text)
         .text(`${item.label}:`, 50, y);

      doc.font(this.fonts.regular)
         .text(item.value, 300, y);

      y += 25;
    });
  }

  _addNeighborhoodRanking(doc, portfolio) {
    this._addSectionTitle(doc, '🏆 RANKING DE BARRIOS POR VULNERABILIDAD');

    let y = 130;

    // Cabecera
    doc.font(this.fonts.bold)
       .fontSize(9)
       .text('#', 50, y)
       .text('Barrio', 80, y)
       .text('Vulnerab.', 280, y)
       .text('Prioridad', 360, y)
       .text('Presupuesto', 450, y);

    y += 18;

    doc.moveTo(50, y)
       .lineTo(535, y)
       .stroke();

    y += 10;

    // Filas
    portfolio.portfolio.forEach((neighborhood, index) => {
      doc.font(this.fonts.regular)
         .fontSize(9)
         .text(index + 1, 50, y)
         .text(neighborhood.neighborhoodName, 80, y, { width: 180 })
         .text(`${(neighborhood.score * 100).toFixed(1)}%`, 280, y)
         .text(neighborhood.classification.toUpperCase(), 360, y);

      const color = this._getVulnerabilityColor(neighborhood.classification);
      doc.circle(440, y + 5, 4).fill(color);

      doc.fillColor(this.colors.text)
         .text(`$${neighborhood.budgetAllocated.toLocaleString('es-PE')}`, 450, y);

      y += 18;
    });
  }

  _addBudgetDistribution(doc, portfolio) {
    this._addSectionTitle(doc, '💰 DISTRIBUCIÓN DE PRESUPUESTO');

    let y = 130;

    doc.fontSize(10)
       .font(this.fonts.regular)
       .text('La asignación de presupuesto es proporcional al índice de vulnerabilidad de cada barrio.', 50, y, { 
         width: 495, 
         align: 'justify' 
       });

    y += 40;

    // Gráfico de barras horizontal simulado
    portfolio.portfolio.forEach(neighborhood => {
      const percentage = (neighborhood.budgetAllocated / portfolio.summary.totalInvestment) * 100;
      const barWidth = (percentage / 100) * 400;

      doc.font(this.fonts.regular)
         .fontSize(9)
         .text(neighborhood.neighborhoodName, 50, y, { width: 100 });

      // Barra
      doc.rect(160, y, barWidth, 12)
         .fill(this._getVulnerabilityColor(neighborhood.classification));

      // Porcentaje
      doc.fillColor(this.colors.text)
         .text(`${percentage.toFixed(1)}%`, 160 + barWidth + 10, y);

      y += 20;
    });
  }

  _addNeighborhoodSummaryInPortfolio(doc, neighborhood) {
    doc.fontSize(16)
       .font(this.fonts.bold)
       .fillColor(this.colors.primary)
       .text(neighborhood.neighborhoodName, 50, 50);

    let y = 80;

    // Info básica
    doc.fontSize(10)
       .font(this.fonts.regular)
       .fillColor(this.colors.text)
       .text(`Vulnerabilidad: ${(neighborhood.score * 100).toFixed(1)}%`, 50, y)
       .text(`Población: ${neighborhood.population.toLocaleString('es-PE')} hab.`, 250, y)
       .text(`Presupuesto: $${neighborhood.budgetAllocated.toLocaleString('es-PE')}`, 420, y);

    y += 30;

    // Intervenciones
    doc.font(this.fonts.bold)
       .fontSize(12)
       .text('Intervenciones Asignadas:', 50, y);

    y += 20;

    neighborhood.interventions.forEach((intervention, index) => {
      doc.font(this.fonts.regular)
         .fontSize(10)
         .text(`${index + 1}. ${intervention.name}`, 60, y)
         .text(`$${intervention.estimatedCost.toLocaleString('es-PE')}`, 400, y);

      y += 15;

      doc.fontSize(9)
         .fillColor(this.colors.textLight)
         .text(intervention.description, 70, y, { width: 460 });

      y += 25;
    });
  }

  _addPrioritizationMatrix(doc, portfolio) {
    this._addSectionTitle(doc, '📋 MATRIZ DE PRIORIZACIÓN');

    let y = 130;

    doc.fontSize(10)
       .font(this.fonts.regular)
       .text('Esta matriz resume la metodología de priorización utilizada (AHP + TOPSIS).', 50, y);

    y += 30;

    // Tabla simplificada
    const criteriaWeights = [
      { name: 'Calor', weight: 30 },
      { name: 'Vegetación', weight: 25 },
      { name: 'Calidad del Aire', weight: 20 },
      { name: 'Estrés Hídrico', weight: 15 },
      { name: 'Vulnerab. Social', weight: 10 }
    ];

    doc.font(this.fonts.bold)
       .fontSize(9)
       .text('Criterio', 50, y)
       .text('Peso', 200, y)
       .text('Justificación', 280, y);

    y += 18;

    doc.moveTo(50, y)
       .lineTo(535, y)
       .stroke();

    y += 10;

    criteriaWeights.forEach(criterion => {
      doc.font(this.fonts.regular)
         .fontSize(9)
         .text(criterion.name, 50, y)
         .text(`${criterion.weight}%`, 200, y)
         .text('Impacto en salud y bienestar', 280, y, { width: 255 });

      y += 18;
    });
  }

  // ============================================================================
  // MÉTODOS AUXILIARES
  // ============================================================================

  _addSectionTitle(doc, title) {
    doc.fontSize(18)
       .font(this.fonts.bold)
       .fillColor(this.colors.primary)
       .text(title, 50, 70);

    doc.moveTo(50, 95)
       .lineTo(545, 95)
       .strokeColor(this.colors.primary)
       .lineWidth(2)
       .stroke()
       .lineWidth(1);
  }

  _getVulnerabilityColor(classification) {
    const colors = {
      critical: this.colors.critical,
      high: this.colors.high,
      medium: this.colors.medium,
      low: this.colors.low
    };
    return colors[classification] || this.colors.textLight;
  }

  _getVulnerabilityConclusion(vulnerability) {
    const { classification, score } = vulnerability;

    if (classification === 'critical') {
      return `El barrio presenta una vulnerabilidad CRÍTICA (${(score * 100).toFixed(1)}%). Se requiere intervención urgente para reducir los riesgos ambientales que afectan a la población. Las condiciones actuales representan una amenaza significativa para la salud y el bienestar de los residentes.`;
    } else if (classification === 'high') {
      return `El barrio muestra vulnerabilidad ALTA (${(score * 100).toFixed(1)}%). Es prioritario implementar intervenciones para mejorar las condiciones ambientales y reducir la exposición de la población a factores de riesgo.`;
    } else if (classification === 'medium') {
      return `El barrio tiene vulnerabilidad MEDIA (${(score * 100).toFixed(1)}%). Si bien no es crítico, existen oportunidades de mejora que beneficiarían a la población mediante intervenciones preventivas.`;
    } else {
      return `El barrio presenta vulnerabilidad BAJA (${(score * 100).toFixed(1)}%). Las condiciones ambientales son relativamente favorables, aunque siempre hay margen para mejoras incrementales.`;
    }
  }

  _getImpactInterpretation(impact, vulnerability) {
    const reductionPercent = impact.vulnerabilityReduction;

    if (reductionPercent >= 40) {
      return `Las intervenciones propuestas tienen el potencial de reducir significativamente la vulnerabilidad del barrio (${reductionPercent}%). Esto representa una transformación sustancial de las condiciones ambientales que beneficiará directamente a la calidad de vida de los residentes.`;
    } else if (reductionPercent >= 20) {
      return `Las intervenciones recomendadas pueden reducir moderadamente la vulnerabilidad (${reductionPercent}%). Aunque no es una solución completa, representan un avance importante hacia la mejora de las condiciones ambientales del barrio.`;
    } else {
      return `Las intervenciones propuestas tendrán un impacto moderado (${reductionPercent}% de reducción). Se recomienda complementar con acciones adicionales para maximizar los beneficios ambientales.`;
    }
  }

  _generateMilestones(intervention) {
    const milestones = {
      urban_parks: [
        'Diseño participativo con comunidad',
        'Aprobación de permisos municipales',
        'Preparación de terreno',
        'Plantación de vegetación',
        'Instalación de mobiliario urbano',
        'Inauguración y transferencia a comunidad'
      ],
      green_roof: [
        'Evaluación estructural de edificios',
        'Diseño de sistema de drenaje',
        'Impermeabilización',
        'Instalación de sustrato y vegetación',
        'Sistema de riego automatizado',
        'Capacitación en mantenimiento'
      ],
      cool_paint: [
        'Limpieza y preparación de superficies',
        'Aplicación de pintura reflectiva',
        'Señalización y protección',
        'Monitoreo de temperatura'
      ],
      tree_planting: [
        'Selección de especies nativas',
        'Preparación de hoyos de plantación',
        'Plantación con participación comunitaria',
        'Sistema de riego temporal',
        'Programa de adopción de árboles'
      ]
    };

    return milestones[intervention.interventionType] || [
      'Planificación',
      'Diseño',
      'Implementación',
      'Monitoreo'
    ];
  }
}

// Exportar instancia singleton
const recommendationPdfService = new RecommendationPdfService();
module.exports = recommendationPdfService;
