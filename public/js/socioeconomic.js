/**
 * Datos Socioeconómicos - Frontend
 * Punto 6: Población (GPW v4), infraestructura y privación
 */

(function() {
  'use strict';

  // Estado global
  let currentSocioData = null;
  let socioComparisonChart = null;
  let allNeighborhoods = [];

  // Elementos del DOM
  const socioNeighborhoodSelector = document.getElementById('socioNeighborhoodSelector');
  const socioYearSelector = document.getElementById('socioYearSelector');
  const socioLoading = document.getElementById('socioLoading');
  const socioResults = document.getElementById('socioResults');
  const socioHelp = document.getElementById('socioHelp');
  const socioControls = document.getElementById('socioControls');
  const downloadSocioDataBtn = document.getElementById('downloadSocioDataBtn');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');

  // Checkboxes de capas
  const layerDensity = document.getElementById('layerDensity');
  const layerServices = document.getElementById('layerServices');
  const layerDeprivation = document.getElementById('layerDeprivation');

  // Sliders de filtro
  const filterDensityMin = document.getElementById('filterDensityMin');
  const filterDensityMax = document.getElementById('filterDensityMax');
  const filterDeprivation = document.getElementById('filterDeprivation');
  const filterServices = document.getElementById('filterServices');

  // Tooltips informativos
  const infoTooltips = {
    density: 'Densidad poblacional = Población total del barrio dividida por su área en km². Fuente: GPW v4.11 (SEDAC/NASA/CIESIN). Resolución ~1km.',
    deprivation: 'Índice de privación relativa (0-1): proxy basado en luminosidad nocturna (VIIRS) y acceso a áreas verdes (NDVI). Mayor valor = mayor privación. Para análisis definitivo, usar datos censales INEI.',
    services: 'Servicios per cápita: promedio de hospitales y colegios por cada 10,000 habitantes. Datos sintéticos MVP - reemplazar con shapefile municipal/INEI.'
  };

  /**
   * Inicialización
   */
  async function init() {
    try {
      // Cargar lista de barrios
      const response = await fetch('/api/neighborhoods');
      const data = await response.json();
      allNeighborhoods = data.neighborhoods;

      // Poblar selector
      socioNeighborhoodSelector.innerHTML = '<option value="">Selecciona un barrio...</option>';
      allNeighborhoods.forEach(n => {
        const option = document.createElement('option');
        option.value = n.id;
        option.textContent = n.name;
        socioNeighborhoodSelector.appendChild(option);
      });

      // Event listeners
      socioNeighborhoodSelector.addEventListener('change', handleNeighborhoodChange);
      socioYearSelector.addEventListener('change', handleNeighborhoodChange);
      downloadSocioDataBtn.addEventListener('click', downloadData);
      applyFiltersBtn.addEventListener('click', applyFilters);

      // Checkboxes de capas
      layerDensity.addEventListener('change', updateVisualization);
      layerServices.addEventListener('change', updateVisualization);
      layerDeprivation.addEventListener('change', updateVisualization);

      // Sliders
      [filterDensityMin, filterDensityMax, filterDeprivation, filterServices].forEach(slider => {
        slider.addEventListener('input', updateFilterLabels);
      });

      // Tooltips
      document.querySelectorAll('.info-tooltip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const infoType = e.target.getAttribute('data-info');
          showTooltip(infoType);
        });
      });

      updateFilterLabels();
    } catch (error) {
      console.error('Error inicializando datos socioeconómicos:', error);
    }
  }

  /**
   * Maneja cambio de barrio o año
   */
  async function handleNeighborhoodChange() {
    const neighborhoodId = socioNeighborhoodSelector.value;
    const year = socioYearSelector.value;

    if (!neighborhoodId) {
      socioResults.style.display = 'none';
      socioHelp.style.display = 'block';
      socioControls.style.display = 'none';
      return;
    }

    try {
      // Mostrar loading
      socioLoading.style.display = 'block';
      socioResults.style.display = 'none';
      socioHelp.style.display = 'none';
      socioControls.style.display = 'none';

      // Obtener datos
      const response = await fetch(`/api/socioeconomic/${neighborhoodId}?year=${year}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      currentSocioData = await response.json();

      // Mostrar resultados
      displayResults(currentSocioData);

      socioLoading.style.display = 'none';
      socioResults.style.display = 'block';
      socioControls.style.display = 'block';
    } catch (error) {
      console.error('Error cargando datos socioeconómicos:', error);
      socioLoading.style.display = 'none';
      alert('Error al cargar datos: ' + error.message);
    }
  }

  /**
   * Muestra los resultados
   */
  function displayResults(data) {
    // Header
    document.getElementById('socioNeighborhoodName').textContent = data.neighborhood;
    document.getElementById('socioSummary').textContent = data.summary;

    // Población
    document.getElementById('socioPopTotal').textContent = data.population.populationTotal.toLocaleString();
    document.getElementById('socioDensity').textContent = data.population.densityMean.toLocaleString();
    document.getElementById('socioArea').textContent = data.population.areaKm2;

    // Servicios
    document.getElementById('socioServicesTotal').textContent = data.infrastructure.servicesPerCapita.toFixed(2);
    document.getElementById('socioHospitals').textContent = data.infrastructure.hospitals.count;
    document.getElementById('socioSchools').textContent = data.infrastructure.schools.count;
    document.getElementById('socioParks').textContent = data.infrastructure.parks.perCapitaM2.toFixed(1);

    // Privación
    document.getElementById('socioDeprivationIndex').textContent = data.deprivation.deprivationIndex.toFixed(3);
    document.getElementById('socioDeprivationLevel').textContent = data.deprivation.interpretation;
    document.getElementById('socioNightlight').textContent = data.deprivation.nightlightRadiance.toFixed(2) + ' nW·cm⁻²·sr⁻¹';
    document.getElementById('socioGreenAccess').textContent = data.deprivation.greenSpaceAccess.toFixed(3);

    // Fuentes
    document.getElementById('socioPopSource').textContent = data.population.source;
    document.getElementById('socioInfraSource').textContent = data.infrastructure.source;
    document.getElementById('socioDeprivSource').textContent = data.deprivation.source;

    // Gráfico de comparación
    renderComparisonChart(data);
  }

  /**
   * Renderiza el gráfico de comparación
   */
  function renderComparisonChart(data) {
    const ctx = document.getElementById('socioComparisonChart');
    
    // Destruir gráfico anterior
    if (socioComparisonChart) {
      socioComparisonChart.destroy();
    }

    // Preparar datos normalizados
    const normalized = data.normalized;
    const labels = ['Densidad Poblacional', 'Servicios per Cápita', 'Privación Relativa'];
    const values = [
      normalized.density,
      normalized.services,
      normalized.deprivation
    ];

    // Colores según nivel
    const colors = values.map(v => {
      if (v < 0.33) return 'rgba(16, 185, 129, 0.8)'; // Verde
      if (v < 0.66) return 'rgba(245, 158, 11, 0.8)'; // Amarillo
      return 'rgba(239, 68, 68, 0.8)'; // Rojo
    });

    socioComparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Valor Normalizado (0-1)',
          data: values,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.8', '1')),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            ticks: {
              color: '#94a3b8'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            }
          },
          x: {
            ticks: {
              color: '#94a3b8'
            },
            grid: {
              display: false
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
                const value = context.parsed.y;
                let interpretation = '';
                if (value < 0.33) interpretation = ' (Bajo)';
                else if (value < 0.66) interpretation = ' (Moderado)';
                else interpretation = ' (Alto)';
                return context.dataset.label + ': ' + value.toFixed(3) + interpretation;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Actualiza labels de filtros
   */
  function updateFilterLabels() {
    const densityMin = parseInt(filterDensityMin.value);
    const densityMax = parseInt(filterDensityMax.value);
    const deprivation = parseFloat(filterDeprivation.value);
    const services = parseFloat(filterServices.value);

    document.getElementById('filterDensityValue').textContent = 
      `${densityMin.toLocaleString()} - ${densityMax.toLocaleString()}`;
    document.getElementById('filterDeprivationValue').textContent = deprivation.toFixed(2);
    document.getElementById('filterServicesValue').textContent = services.toFixed(1);
  }

  /**
   * Aplica filtros (para comparación múltiple)
   */
  async function applyFilters() {
    const filters = {
      densityMin: parseInt(filterDensityMin.value),
      densityMax: parseInt(filterDensityMax.value),
      deprivationMin: parseFloat(filterDeprivation.value),
      servicesMin: parseFloat(filterServices.value),
      year: parseInt(socioYearSelector.value)
    };

    try {
      socioLoading.style.display = 'block';
      
      const response = await fetch('/api/socioeconomic/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });

      const data = await response.json();
      
      socioLoading.style.display = 'none';

      // Mostrar resultados filtrados
      if (data.neighborhoods.length === 0) {
        alert('No se encontraron barrios que cumplan los criterios');
      } else {
        alert(`Se encontraron ${data.neighborhoods.length} barrios:\n\n` + 
          data.neighborhoods.map(n => `• ${n.neighborhood}`).join('\n'));
      }
    } catch (error) {
      console.error('Error aplicando filtros:', error);
      socioLoading.style.display = 'none';
      alert('Error al aplicar filtros: ' + error.message);
    }
  }

  /**
   * Actualiza visualización según capas seleccionadas
   */
  function updateVisualization() {
    // Esta función se puede expandir para controlar capas en el mapa
    console.log('Capas activas:', {
      density: layerDensity.checked,
      services: layerServices.checked,
      deprivation: layerDeprivation.checked
    });
  }

  /**
   * Descarga datos en JSON o CSV
   */
  function downloadData() {
    if (!currentSocioData) return;

    // Preparar datos para descarga
    const exportData = {
      neighborhood: currentSocioData.neighborhood,
      year: currentSocioData.year,
      timestamp: currentSocioData.timestamp,
      population: {
        total: currentSocioData.population.populationTotal,
        density: currentSocioData.population.densityMean,
        area_km2: currentSocioData.population.areaKm2,
        source: currentSocioData.population.source
      },
      infrastructure: {
        hospitals_count: currentSocioData.infrastructure.hospitals.count,
        hospitals_per_capita: currentSocioData.infrastructure.hospitals.perCapita,
        schools_count: currentSocioData.infrastructure.schools.count,
        schools_per_capita: currentSocioData.infrastructure.schools.perCapita,
        parks_area_km2: currentSocioData.infrastructure.parks.areaKm2,
        parks_per_capita_m2: currentSocioData.infrastructure.parks.perCapitaM2,
        services_per_capita: currentSocioData.infrastructure.servicesPerCapita,
        source: currentSocioData.infrastructure.source
      },
      deprivation: {
        index: currentSocioData.deprivation.deprivationIndex,
        interpretation: currentSocioData.deprivation.interpretation,
        nightlight_radiance: currentSocioData.deprivation.nightlightRadiance,
        green_space_access: currentSocioData.deprivation.greenSpaceAccess,
        source: currentSocioData.deprivation.source
      },
      normalized: currentSocioData.normalized
    };

    // Opciones de formato
    const format = prompt('Formato de descarga:\n1. JSON\n2. CSV\n\nIngrese 1 o 2:', '1');

    if (format === '1') {
      downloadJSON(exportData);
    } else if (format === '2') {
      downloadCSV(exportData);
    }
  }

  /**
   * Descarga en formato JSON
   */
  function downloadJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socioeconomic_${data.neighborhood.replace(/\s+/g, '_')}_${data.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Descarga en formato CSV
   */
  function downloadCSV(data) {
    const csv = [
      'Indicador,Valor,Unidad',
      `Barrio,${data.neighborhood},`,
      `Año,${data.year},`,
      `Población Total,${data.population.total},habitantes`,
      `Densidad Poblacional,${data.population.density},hab/km²`,
      `Área,${data.population.area_km2},km²`,
      `Hospitales,${data.infrastructure.hospitals_count},unidades`,
      `Hospitales per Cápita,${data.infrastructure.hospitals_per_capita},por 10k hab`,
      `Colegios,${data.infrastructure.schools_count},unidades`,
      `Colegios per Cápita,${data.infrastructure.schools_per_capita},por 10k hab`,
      `Área de Parques,${data.infrastructure.parks_area_km2},km²`,
      `Parques per Cápita,${data.infrastructure.parks_per_capita_m2},m²/hab`,
      `Servicios per Cápita,${data.infrastructure.services_per_capita},por 10k hab`,
      `Índice de Privación,${data.deprivation.index},(0-1)`,
      `Interpretación Privación,${data.deprivation.interpretation},`,
      `Luminosidad Nocturna,${data.deprivation.nightlight_radiance},nW·cm⁻²·sr⁻¹`,
      `Acceso Áreas Verdes,${data.deprivation.green_space_access},(NDVI 0-1)`,
      `Densidad Normalizada,${data.normalized.density},(0-1)`,
      `Servicios Normalizados,${data.normalized.services},(0-1)`,
      `Privación Normalizada,${data.normalized.deprivation},(0-1)`
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socioeconomic_${data.neighborhood.replace(/\s+/g, '_')}_${data.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Muestra tooltip informativo
   */
  function showTooltip(infoType) {
    const message = infoTooltips[infoType];
    if (message) {
      alert(message);
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
