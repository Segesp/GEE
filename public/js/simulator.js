/**
 * Simulador "¿Y si...?" - Interfaz de usuario
 * Script para manejar la interfaz del simulador de escenarios
 */

(function() {
  'use strict';

  // Elementos DOM
  const simulatorIntervention = document.getElementById('simulatorIntervention');
  const simulatorArea = document.getElementById('simulatorArea');
  const simulatorAreaValue = document.getElementById('simulatorAreaValue');
  const simulatorAreaLabel = document.getElementById('simulatorAreaLabel');
  const simulatorAreaUnit = document.getElementById('simulatorAreaUnit');
  const simulatorAreaContainer = document.getElementById('simulatorAreaContainer');
  const simulatorNeighborhood = document.getElementById('simulatorNeighborhood');
  const simulatorNeighborhoodContainer = document.getElementById('simulatorNeighborhoodContainer');
  const simulateButton = document.getElementById('simulateButton');
  const simulationResults = document.getElementById('simulationResults');
  const simulatorHelp = document.getElementById('simulatorHelp');
  const interventionDescription = document.getElementById('interventionDescription');
  const interventionDescriptionText = document.getElementById('interventionDescriptionText');

  let interventionTypes = [];
  let currentIntervention = null;

  /**
   * Cargar tipos de intervención desde la API
   */
  async function loadInterventionTypes() {
    try {
      const response = await fetch('/api/simulator/interventions');
      const data = await response.json();
      
      interventionTypes = data.interventions;
      
      // Poblar selector de intervenciones
      simulatorIntervention.innerHTML = '<option value="">Selecciona una opción...</option>';
      interventionTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = `${type.icon} ${type.name}`;
        simulatorIntervention.appendChild(option);
      });

      // Cargar barrios para el selector
      const neighborhoodsResponse = await fetch('/api/neighborhoods');
      const neighborhoodsData = await neighborhoodsResponse.json();
      
      simulatorNeighborhood.innerHTML = '<option value="">Toda la zona</option>';
      if (neighborhoodsData.neighborhoods) {
        neighborhoodsData.neighborhoods.forEach(n => {
          const option = document.createElement('option');
          option.value = n.id;
          option.textContent = n.name;
          simulatorNeighborhood.appendChild(option);
        });
      }

    } catch (error) {
      console.error('Error cargando tipos de intervención:', error);
      if (window.showToast) {
        window.showToast('Error al cargar opciones del simulador', 'error');
      }
    }
  }

  /**
   * Manejar selección de tipo de intervención
   */
  function handleInterventionChange(e) {
    const typeId = e.target.value;
    
    if (!typeId) {
      // Ocultar todo y volver al estado inicial
      interventionDescription.style.display = 'none';
      simulatorAreaContainer.style.display = 'none';
      simulatorNeighborhoodContainer.style.display = 'none';
      simulateButton.style.display = 'none';
      simulationResults.style.display = 'none';
      simulatorHelp.style.display = 'block';
      currentIntervention = null;
      return;
    }

    currentIntervention = interventionTypes.find(t => t.id === typeId);
    
    if (currentIntervention) {
      // Mostrar descripción
      interventionDescriptionText.innerHTML = `
        <strong>${currentIntervention.icon} ${currentIntervention.name}</strong><br>
        ${currentIntervention.description}
      `;
      interventionDescription.style.display = 'block';

      // Configurar deslizador
      simulatorArea.min = currentIntervention.minArea;
      simulatorArea.max = currentIntervention.maxArea;
      simulatorArea.step = currentIntervention.step;
      simulatorArea.value = currentIntervention.minArea;
      
      const displayValue = currentIntervention.minArea.toFixed(
        currentIntervention.step < 1 ? 2 : 0
      );
      simulatorAreaValue.textContent = displayValue;
      simulatorAreaUnit.textContent = currentIntervention.unit;
      
      // Actualizar atributos ARIA para accesibilidad
      simulatorArea.setAttribute('aria-valuemin', currentIntervention.minArea);
      simulatorArea.setAttribute('aria-valuemax', currentIntervention.maxArea);
      simulatorArea.setAttribute('aria-valuenow', currentIntervention.minArea);

      // Mostrar controles
      simulatorAreaContainer.style.display = 'block';
      simulatorNeighborhoodContainer.style.display = 'block';
      simulateButton.style.display = 'block';
      simulatorHelp.style.display = 'none';
      simulationResults.style.display = 'none';
    }
  }

  /**
   * Manejar movimiento del deslizador
   */
  function handleAreaChange(e) {
    if (!currentIntervention) return;
    
    const value = parseFloat(e.target.value);
    const decimals = currentIntervention.step < 1 ? 2 : 0;
    simulatorAreaValue.textContent = value.toFixed(decimals);
    
    // Actualizar ARIA para accesibilidad
    simulatorArea.setAttribute('aria-valuenow', value);
  }

  /**
   * Ejecutar simulación
   */
  async function runSimulation() {
    if (!currentIntervention) return;

    const area = parseFloat(simulatorArea.value);
    const neighborhoodId = simulatorNeighborhood.value || null;

    // Deshabilitar botón mientras se simula
    simulateButton.disabled = true;
    simulateButton.textContent = '⏳ Simulando...';

    try {
      const response = await fetch('/api/simulator/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interventionType: currentIntervention.id,
          area,
          neighborhoodId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la simulación');
      }

      const simulation = await response.json();
      displaySimulationResults(simulation);
      
      // Anunciar resultado a lectores de pantalla (accesibilidad)
      announceToScreenReader(`Simulación completada. ${simulation.summary.text}`);

    } catch (error) {
      console.error('Error en simulación:', error);
      if (window.showToast) {
        window.showToast(error.message || 'Error al simular. Intenta de nuevo.', 'error');
      }
    } finally {
      simulateButton.disabled = false;
      simulateButton.textContent = '🎯 Simular Impacto';
    }
  }

  /**
   * Mostrar resultados de la simulación
   */
  function displaySimulationResults(simulation) {
    // Resumen general
    const summaryEmoji = document.getElementById('summaryEmoji');
    const summaryText = document.getElementById('summaryText');
    const summaryScore = document.getElementById('summaryScore');
    
    summaryEmoji.textContent = simulation.summary.emoji;
    summaryEmoji.setAttribute('aria-label', simulation.summary.level);
    summaryText.textContent = simulation.summary.text;
    summaryScore.textContent = `Score: ${simulation.overallScore}/100`;

    // Impactos individuales
    const impactsContainer = document.getElementById('impactsContainer');
    impactsContainer.innerHTML = '';

    for (const [key, impact] of Object.entries(simulation.impacts)) {
      const card = createImpactCard(impact);
      impactsContainer.appendChild(card);
    }

    // Recomendaciones
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';
    
    simulation.recommendations.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      recommendationsList.appendChild(li);
    });

    // Mostrar sección de resultados
    simulationResults.style.display = 'block';
    
    // Scroll suave hacia resultados
    setTimeout(() => {
      simulationResults.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }, 100);
  }

  /**
   * Crear tarjeta de impacto individual
   */
  function createImpactCard(impact) {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 12px;
      background: ${impact.isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
      border-left: 3px solid ${impact.color};
      border-radius: 6px;
    `;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Impacto en ${impact.label}`);
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 1.3rem;" role="img" aria-label="${impact.label}">${impact.icon}</span>
        <div style="flex: 1;">
          <div style="font-size: 0.8rem; color: var(--text-muted);">${impact.label}</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: ${impact.color};">${impact.formatted}</div>
        </div>
        <span style="font-size: 1.5rem;" role="img" aria-label="${impact.isPositive ? 'Impacto positivo' : 'Advertencia'}">
          ${impact.isPositive ? '✅' : '⚠️'}
        </span>
      </div>
      <div style="font-size: 0.8rem; margin-top: 6px; color: var(--text);">
        ${impact.message}
      </div>
    `;
    
    return card;
  }

  /**
   * Anunciar mensaje a lectores de pantalla (accesibilidad)
   */
  function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => announcement.remove(), 1000);
  }

  /**
   * Inicializar simulador
   */
  function initSimulator() {
    if (!simulatorIntervention) {
      console.log('Elementos del simulador no encontrados en la página');
      return;
    }

    // Cargar datos iniciales
    loadInterventionTypes();

    // Event listeners
    simulatorIntervention.addEventListener('change', handleInterventionChange);
    simulatorArea.addEventListener('input', handleAreaChange);
    simulateButton.addEventListener('click', runSimulation);

    console.log('Simulador "¿Y si...?" inicializado');
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimulator);
  } else {
    initSimulator();
  }

  // Exponer funciones públicas si es necesario
  window.EcoPlanSimulator = {
    reload: loadInterventionTypes
  };

})();
