/**
 * ÍNDICES AMBIENTALES COMPUESTOS - Punto 7
 * 
 * Gestión de 4 índices compuestos:
 * 1. Vulnerabilidad al calor (MODIS LST + NDVI + densidad poblacional)
 * 2. Déficit de áreas verdes (parques + NDVI vs estándar OMS 9m²/hab)
 * 3. Contaminación atmosférica (AOD + PM2.5 + NO2)
 * 4. Riesgo hídrico (pendiente + impermeabilidad + cercanía a cauces)
 */

(function () {
  'use strict';

  // Variables globales
  let neighborhoodsData = [];
  let currentNeighborhood = null;
  let currentData = null;
  let radarChart = null;

  // Elementos del DOM
  const selector = document.getElementById('compositeNeighborhoodSelector');
  const controls = document.getElementById('compositeControls');
  const loading = document.getElementById('compositeLoading');
  const results = document.getElementById('compositeResults');
  const help = document.getElementById('compositeHelp');

  // Pesos personalizados
  const weightSliders = {
    heat: document.getElementById('weightHeat'),
    green: document.getElementById('weightGreen'),
    pollution: document.getElementById('weightPollution'),
    water: document.getElementById('weightWater')
  };

  const weightValues = {
    heat: document.getElementById('weightHeatValue'),
    green: document.getElementById('weightGreenValue'),
    pollution: document.getElementById('weightPollutionValue'),
    water: document.getElementById('weightWaterValue')
  };

  const totalWeightDisplay = document.getElementById('weightsTotalValue');

  // Simulador de escenarios
  const scenarioSliders = {
    vegetation: document.getElementById('scenarioVegetation'),
    pollution: document.getElementById('scenarioPollution'),
    greenSpace: document.getElementById('scenarioGreenSpace')
  };

  const scenarioValues = {
    vegetation: document.getElementById('scenarioVegetationValue'),
    pollution: document.getElementById('scenarioPollutionValue'),
    greenSpace: document.getElementById('scenarioGreenSpaceValue')
  };

  /**
   * Inicialización
   */
  async function init() {
    console.log('Inicializando índices compuestos...');
    
    try {
      await loadNeighborhoods();
      setupEventListeners();
    } catch (error) {
      console.error('Error en inicialización:', error);
      showError('Error al inicializar la sección de índices compuestos');
    }
  }

  /**
   * Cargar lista de barrios
   */
  async function loadNeighborhoods() {
    try {
      const response = await fetch('/api/neighborhoods');
      if (!response.ok) throw new Error('Error al cargar barrios');
      
      neighborhoodsData = await response.json();
      
      selector.innerHTML = '<option value="">Selecciona un barrio...</option>';
      neighborhoodsData.forEach(n => {
        const option = document.createElement('option');
        option.value = n.id;
        option.textContent = n.name;
        selector.appendChild(option);
      });
      
      console.log(`${neighborhoodsData.length} barrios cargados`);
    } catch (error) {
      console.error('Error cargando barrios:', error);
      selector.innerHTML = '<option value="">Error al cargar barrios</option>';
    }
  }

  /**
   * Configurar listeners de eventos
   */
  function setupEventListeners() {
    // Selector de barrio
    selector.addEventListener('change', handleNeighborhoodChange);

    // Pesos personalizados
    Object.keys(weightSliders).forEach(key => {
      weightSliders[key].addEventListener('input', () => {
        updateWeightDisplay(key);
        updateTotalWeight();
      });
    });

    // Botón restablecer pesos
    document.getElementById('resetWeightsBtn').addEventListener('click', resetWeights);

    // Botón aplicar pesos personalizados
    document.getElementById('applyCustomWeightsBtn').addEventListener('click', applyCustomWeights);

    // Checkboxes de índices
    ['indexHeat', 'indexGreen', 'indexPollution', 'indexWater'].forEach(id => {
      document.getElementById(id).addEventListener('change', updateChartVisibility);
    });

    // Simulador de escenarios
    Object.keys(scenarioSliders).forEach(key => {
      scenarioSliders[key].addEventListener('input', () => {
        updateScenarioDisplay(key);
      });
    });

    document.getElementById('simulateScenarioBtn').addEventListener('click', simulateScenario);

    // Botón descargar
    document.getElementById('downloadCompositeDataBtn').addEventListener('click', downloadData);

    // Botones de detalles de índices
    document.querySelectorAll('.index-details-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        showIndexDetails(index);
      });
    });
  }

  /**
   * Manejar cambio de barrio
   */
  async function handleNeighborhoodChange() {
    const neighborhoodId = selector.value;
    
    if (!neighborhoodId) {
      hideResults();
      return;
    }

    currentNeighborhood = neighborhoodsData.find(n => n.id === neighborhoodId);
    
    if (!currentNeighborhood) {
      showError('Barrio no encontrado');
      return;
    }

    await loadCompositeIndices(neighborhoodId);
  }

  /**
   * Cargar índices compuestos del barrio
   */
  async function loadCompositeIndices(neighborhoodId) {
    showLoading();

    try {
      const response = await fetch(`/api/composite-indices/${neighborhoodId}`);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      currentData = data;
      
      displayResults(data);
    } catch (error) {
      console.error('Error cargando índices:', error);
      showError('Error al cargar los índices compuestos. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Mostrar resultados
   */
  function displayResults(data) {
    hideLoading();
    help.style.display = 'none';
    controls.style.display = 'block';
    results.style.display = 'block';

    // Nombre del barrio
    document.getElementById('compositeNeighborhoodName').textContent = currentNeighborhood.name;

    // Índice total
    const totalIndex = data.totalIndex;
    document.getElementById('compositeTotalIndex').textContent = totalIndex.toFixed(2);
    document.getElementById('compositeTotalInterpretation').textContent = interpretTotalIndex(totalIndex);

    // Índices individuales
    displayIndividualIndices(data.indices);

    // Gráfico radar
    renderRadarChart(data.indices);

    // Resumen
    displaySummary(data);

    // Resetear simulador
    resetScenario();
  }

  /**
   * Mostrar índices individuales
   */
  function displayIndividualIndices(indices) {
    // Calor
    document.getElementById('heatIndex').textContent = indices.heatVulnerability.value.toFixed(2);
    document.getElementById('heatInterpretation').textContent = interpretIndex(indices.heatVulnerability.value, 'heat');

    // Áreas verdes
    document.getElementById('greenIndex').textContent = indices.greenSpaceDeficit.value.toFixed(2);
    document.getElementById('greenInterpretation').textContent = interpretIndex(indices.greenSpaceDeficit.value, 'green');

    // Contaminación
    document.getElementById('pollutionIndex').textContent = indices.airPollution.value.toFixed(2);
    document.getElementById('pollutionInterpretation').textContent = interpretIndex(indices.airPollution.value, 'pollution');

    // Agua
    document.getElementById('waterIndex').textContent = indices.waterRisk.value.toFixed(2);
    document.getElementById('waterInterpretation').textContent = interpretIndex(indices.waterRisk.value, 'water');
  }

  /**
   * Interpretar índice total
   */
  function interpretTotalIndex(value) {
    if (value < 0.3) return '✅ Condiciones ambientales favorables';
    if (value < 0.5) return '⚠️ Condiciones moderadas - atención necesaria';
    if (value < 0.7) return '⚠️ Condiciones desfavorables - intervención recomendada';
    return '🚨 Condiciones críticas - intervención prioritaria';
  }

  /**
   * Interpretar índice individual
   */
  function interpretIndex(value, type) {
    const interpretations = {
      heat: {
        low: 'Baja vulnerabilidad',
        moderate: 'Vulnerabilidad moderada',
        high: 'Alta vulnerabilidad',
        critical: 'Vulnerabilidad crítica'
      },
      green: {
        low: 'Espacios verdes adecuados',
        moderate: 'Déficit moderado',
        high: 'Déficit significativo',
        critical: 'Déficit crítico'
      },
      pollution: {
        low: 'Aire de buena calidad',
        moderate: 'Calidad moderada',
        high: 'Contaminación elevada',
        critical: 'Contaminación crítica'
      },
      water: {
        low: 'Riesgo hídrico bajo',
        moderate: 'Riesgo moderado',
        high: 'Riesgo elevado',
        critical: 'Riesgo crítico'
      }
    };

    let level;
    if (value < 0.3) level = 'low';
    else if (value < 0.5) level = 'moderate';
    else if (value < 0.7) level = 'high';
    else level = 'critical';

    return interpretations[type][level];
  }

  /**
   * Renderizar gráfico radar
   */
  function renderRadarChart(indices) {
    const ctx = document.getElementById('compositeRadarChart');
    
    if (radarChart) {
      radarChart.destroy();
    }

    const chartData = {
      labels: [
        '🔥 Calor',
        '🌳 Áreas Verdes',
        '💨 Contaminación',
        '💧 Agua'
      ],
      datasets: [{
        label: 'Índices Ambientales',
        data: [
          indices.heatVulnerability.value,
          indices.greenSpaceDeficit.value,
          indices.airPollution.value,
          indices.waterRisk.value
        ],
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(139, 92, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(139, 92, 246, 1)'
      }]
    };

    radarChart = new Chart(ctx, {
      type: 'radar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 1,
            ticks: {
              stepSize: 0.2,
              callback: function(value) {
                return value.toFixed(1);
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.r.toFixed(3);
              }
            }
          }
        }
      }
    });
  }

  /**
   * Actualizar visibilidad del gráfico según checkboxes
   */
  function updateChartVisibility() {
    if (!currentData) return;

    const visible = {
      heat: document.getElementById('indexHeat').checked,
      green: document.getElementById('indexGreen').checked,
      pollution: document.getElementById('indexPollution').checked,
      water: document.getElementById('indexWater').checked
    };

    const labels = [];
    const data = [];

    if (visible.heat) {
      labels.push('🔥 Calor');
      data.push(currentData.indices.heatVulnerability.value);
    }
    if (visible.green) {
      labels.push('🌳 Áreas Verdes');
      data.push(currentData.indices.greenSpaceDeficit.value);
    }
    if (visible.pollution) {
      labels.push('💨 Contaminación');
      data.push(currentData.indices.airPollution.value);
    }
    if (visible.water) {
      labels.push('💧 Agua');
      data.push(currentData.indices.waterRisk.value);
    }

    if (radarChart) {
      radarChart.data.labels = labels;
      radarChart.data.datasets[0].data = data;
      radarChart.update();
    }
  }

  /**
   * Actualizar display de pesos
   */
  function updateWeightDisplay(key) {
    const value = parseFloat(weightSliders[key].value);
    weightValues[key].textContent = value.toFixed(2);
  }

  /**
   * Actualizar suma total de pesos
   */
  function updateTotalWeight() {
    const total = Object.keys(weightSliders).reduce((sum, key) => {
      return sum + parseFloat(weightSliders[key].value);
    }, 0);

    totalWeightDisplay.textContent = total.toFixed(2);
    
    // Colorear según si suma 1.0
    if (Math.abs(total - 1.0) < 0.01) {
      totalWeightDisplay.style.color = 'var(--success)';
    } else {
      totalWeightDisplay.style.color = 'var(--error)';
    }
  }

  /**
   * Restablecer pesos por defecto
   */
  function resetWeights() {
    weightSliders.heat.value = 0.30;
    weightSliders.green.value = 0.25;
    weightSliders.pollution.value = 0.25;
    weightSliders.water.value = 0.20;

    Object.keys(weightSliders).forEach(key => {
      updateWeightDisplay(key);
    });
    updateTotalWeight();
  }

  /**
   * Aplicar pesos personalizados
   */
  async function applyCustomWeights() {
    if (!currentNeighborhood) {
      alert('Por favor, selecciona un barrio primero');
      return;
    }

    const total = Object.keys(weightSliders).reduce((sum, key) => {
      return sum + parseFloat(weightSliders[key].value);
    }, 0);

    if (Math.abs(total - 1.0) > 0.01) {
      alert('Los pesos deben sumar exactamente 1.0. Total actual: ' + total.toFixed(2));
      return;
    }

    showLoading();

    try {
      const weights = {
        heat: parseFloat(weightSliders.heat.value),
        green: parseFloat(weightSliders.green.value),
        pollution: parseFloat(weightSliders.pollution.value),
        water: parseFloat(weightSliders.water.value)
      };

      const response = await fetch('/api/composite-indices/custom-weights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          neighborhoodId: currentNeighborhood.id,
          weights
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      currentData = data;
      
      displayResults(data);
      
      // Mostrar mensaje de éxito
      alert('✅ Pesos personalizados aplicados correctamente');
    } catch (error) {
      console.error('Error aplicando pesos:', error);
      showError('Error al aplicar pesos personalizados');
    }
  }

  /**
   * Actualizar display del simulador
   */
  function updateScenarioDisplay(key) {
    const value = parseFloat(scenarioSliders[key].value);
    scenarioValues[key].textContent = value.toFixed(key === 'greenSpace' ? 1 : 0);
  }

  /**
   * Resetear simulador de escenarios
   */
  function resetScenario() {
    scenarioSliders.vegetation.value = 0;
    scenarioSliders.pollution.value = 0;
    scenarioSliders.greenSpace.value = 0;

    Object.keys(scenarioSliders).forEach(key => {
      updateScenarioDisplay(key);
    });

    document.getElementById('scenarioResults').style.display = 'none';
  }

  /**
   * Simular escenario
   */
  async function simulateScenario() {
    if (!currentNeighborhood) {
      alert('Por favor, selecciona un barrio primero');
      return;
    }

    const vegetation = parseFloat(scenarioSliders.vegetation.value);
    const pollution = parseFloat(scenarioSliders.pollution.value);
    const greenSpace = parseFloat(scenarioSliders.greenSpace.value);

    if (vegetation === 0 && pollution === 0 && greenSpace === 0) {
      alert('Por favor, ajusta al menos un parámetro del escenario');
      return;
    }

    showLoading();

    try {
      const response = await fetch('/api/composite-indices/scenario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          neighborhoodId: currentNeighborhood.id,
          changes: {
            vegetationIncrease: vegetation / 100,
            pollutionReduction: pollution / 100,
            greenSpaceIncrease: greenSpace
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      displayScenarioResults(data);
      hideLoading();
    } catch (error) {
      console.error('Error simulando escenario:', error);
      showError('Error al simular escenario');
    }
  }

  /**
   * Mostrar resultados del escenario
   */
  function displayScenarioResults(data) {
    const results = document.getElementById('scenarioResults');
    results.style.display = 'block';

    const improvements = {
      heat: data.after.indices.heatVulnerability.value - data.before.indices.heatVulnerability.value,
      green: data.after.indices.greenSpaceDeficit.value - data.before.indices.greenSpaceDeficit.value,
      pollution: data.after.indices.airPollution.value - data.before.indices.airPollution.value,
      total: data.after.totalIndex - data.before.totalIndex
    };

    document.getElementById('scenarioHeatImprovement').textContent = 
      (improvements.heat < 0 ? '↓ ' : '↑ ') + Math.abs(improvements.heat * 100).toFixed(1) + '%';
    
    document.getElementById('scenarioGreenImprovement').textContent = 
      (improvements.green < 0 ? '↓ ' : '↑ ') + Math.abs(improvements.green * 100).toFixed(1) + '%';
    
    document.getElementById('scenarioPollutionImprovement').textContent = 
      (improvements.pollution < 0 ? '↓ ' : '↑ ') + Math.abs(improvements.pollution * 100).toFixed(1) + '%';
    
    document.getElementById('scenarioTotalImprovement').textContent = 
      (improvements.total < 0 ? '↓ ' : '↑ ') + Math.abs(improvements.total * 100).toFixed(1) + '%';

    // Actualizar estilos según mejora o empeoramiento
    ['Heat', 'Green', 'Pollution', 'Total'].forEach(key => {
      const element = document.getElementById('scenario' + key + 'Improvement');
      const value = improvements[key.toLowerCase()];
      element.style.color = value < 0 ? 'var(--success)' : 'var(--error)';
    });
  }

  /**
   * Mostrar detalles de un índice
   */
  function showIndexDetails(index) {
    if (!currentData) return;

    const indices = currentData.indices;
    let details = '';

    switch (index) {
      case 'heat':
        const heat = indices.heatVulnerability;
        details = `
🔥 Vulnerabilidad al Calor

Componentes:
• LST (Temperatura superficial): ${heat.components.lst.toFixed(3)}
• NDVI normalizado: ${heat.components.ndvi.toFixed(3)}
• Densidad poblacional: ${heat.components.density.toFixed(3)}
• Factor de vulnerabilidad: ${heat.components.vulnerability.toFixed(3)}

Pesos: LST 40% · NDVI 30% · Densidad 20% · Vulnerabilidad 10%

Valor final: ${heat.value.toFixed(3)}
        `;
        break;

      case 'green':
        const green = indices.greenSpaceDeficit;
        details = `
🌳 Déficit de Áreas Verdes

Métricas:
• Cobertura de parques: ${(green.components.parkCoverage * 100).toFixed(1)}%
• NDVI promedio: ${green.components.ndvi.toFixed(3)}
• m²/habitante actual: ${green.components.greenSpacePerCapita.toFixed(2)}
• Estándar OMS: 9.0 m²/habitante
• Déficit: ${green.components.deficit.toFixed(2)} m²/hab

Valor final: ${green.value.toFixed(3)}
        `;
        break;

      case 'pollution':
        const pollution = indices.airPollution;
        details = `
💨 Contaminación Atmosférica

Componentes:
• AOD (Profundidad óptica): ${pollution.components.aod.toFixed(3)}
• PM2.5 estimado: ${pollution.components.pm25.toFixed(1)} μg/m³
• NO2 troposférico: ${pollution.components.no2.toFixed(3)}
• Factor de densidad: ${pollution.components.densityFactor.toFixed(3)}

Pesos: AOD 40% · PM2.5 40% · NO2 20%

Valor final: ${pollution.value.toFixed(3)}
        `;
        break;

      case 'water':
        const water = indices.waterRisk;
        details = `
💧 Riesgo Hídrico

Factores:
• Pendiente media: ${water.components.slope.toFixed(2)}°
• Impermeabilidad: ${(water.components.impermeability * 100).toFixed(1)}%
• Proximidad a cauces: ${water.components.waterProximity.toFixed(3)}

Pesos: Pendiente 40% · Impermeabilidad 40% · Proximidad 20%

Valor final: ${water.value.toFixed(3)}
        `;
        break;
    }

    alert(details);
  }

  /**
   * Mostrar resumen
   */
  function displaySummary(data) {
    const indices = data.indices;
    const criticalIndices = [];

    if (indices.heatVulnerability.value > 0.6) criticalIndices.push('vulnerabilidad al calor');
    if (indices.greenSpaceDeficit.value > 0.6) criticalIndices.push('déficit de áreas verdes');
    if (indices.airPollution.value > 0.6) criticalIndices.push('contaminación');
    if (indices.waterRisk.value > 0.6) criticalIndices.push('riesgo hídrico');

    let summary = '';
    if (criticalIndices.length === 0) {
      summary = 'El barrio presenta condiciones ambientales dentro de parámetros aceptables.';
    } else {
      summary = `Atención prioritaria requerida en: ${criticalIndices.join(', ')}.`;
    }

    document.getElementById('compositeSummary').textContent = summary;
  }

  /**
   * Descargar datos
   */
  function downloadData() {
    if (!currentData) {
      alert('No hay datos para descargar');
      return;
    }

    const dataToExport = {
      barrio: currentNeighborhood.name,
      fecha: new Date().toISOString(),
      indiceTotal: currentData.totalIndex,
      indices: currentData.indices,
      metadata: {
        fuentes: [
          'MODIS LST (MOD11A1)',
          'MODIS NDVI (MOD13A1)',
          'MODIS AOD (MCD19A2)',
          'Sentinel-2 SR',
          'Sentinel-5P (NO2)',
          'SRTM DEM',
          'GPW v4 Population'
        ],
        fecha_calculo: currentData.timestamp || new Date().toISOString()
      }
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indices_compuestos_${currentNeighborhood.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Datos descargados:', dataToExport);
  }

  /**
   * Mostrar estado de carga
   */
  function showLoading() {
    loading.style.display = 'block';
    results.style.display = 'none';
    help.style.display = 'none';
  }

  /**
   * Ocultar estado de carga
   */
  function hideLoading() {
    loading.style.display = 'none';
  }

  /**
   * Ocultar resultados
   */
  function hideResults() {
    controls.style.display = 'none';
    results.style.display = 'none';
    help.style.display = 'block';
  }

  /**
   * Mostrar error
   */
  function showError(message) {
    hideLoading();
    alert('❌ ' + message);
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
