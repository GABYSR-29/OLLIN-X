// Variables globales
let simulationRunning = false;
let comparisonChart = null;

// Datos de simulación mock
const simulationData = {
    actual: {
        tiempo: 28.5,
        eficiencia: 73,
        costo: 525,
        estaciones: [65, 82, 95, 45, 38]  // Utilización por estación
    },
    mejorado: {
        tiempo: 24.5,
        eficiencia: 85,
        costo: 485,
        estaciones: [78, 85, 75, 88, 92]  // Utilización por estación
    }
};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    initializeSliders();
    initializeChart();
    updateStationValues();
    
    // Smooth scrolling para navegación
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});

// Inicializar sliders con valores dinámicos
function initializeSliders() {
    const estacionesSlider = document.getElementById('estaciones');
    const tiempoSlider = document.getElementById('tiempo');
    const operariosSlider = document.getElementById('operarios');
    const costoHoraSlider = document.getElementById('costo-hora');
    const costoMaterialSlider = document.getElementById('costo-material');
    const loteSlider = document.getElementById('lote');
    
    const estacionesValue = document.getElementById('estaciones-value');
    const tiempoValue = document.getElementById('tiempo-value');
    const operariosValue = document.getElementById('operarios-value');
    const costoHoraValue = document.getElementById('costo-hora-value');
    const costoMaterialValue = document.getElementById('costo-material-value');
    const loteValue = document.getElementById('lote-value');
    
    if (estacionesSlider && estacionesValue) {
        estacionesSlider.addEventListener('input', function() {
            estacionesValue.textContent = this.value;
            updateProductionLine();
        });
    }
    
    if (tiempoSlider && tiempoValue) {
        tiempoSlider.addEventListener('input', function() {
            tiempoValue.textContent = this.value + ' seg';
            updateCostCalculation();
        });
    }
    
    if (operariosSlider && operariosValue) {
        operariosSlider.addEventListener('input', function() {
            operariosValue.textContent = this.value;
            updateCostCalculation();
        });
    }
    
    if (costoHoraSlider && costoHoraValue) {
        costoHoraSlider.addEventListener('input', function() {
            costoHoraValue.textContent = this.value;
            updateCostCalculation();
        });
    }
    
    if (costoMaterialSlider && costoMaterialValue) {
        costoMaterialSlider.addEventListener('input', function() {
            costoMaterialValue.textContent = this.value;
            updateCostCalculation();
        });
    }
    
    if (loteSlider && loteValue) {
        loteSlider.addEventListener('input', function() {
            loteValue.textContent = this.value;
            updateCostCalculation();
        });
    }
    
    // Cambio de escenario
    const escenarioSelect = document.getElementById('escenario');
    if (escenarioSelect) {
        escenarioSelect.addEventListener('change', function() {
            updateScenarioData(this.value);
        });
    }
}

// Nueva función para calcular costos en tiempo real
function updateCostCalculation() {
    const estaciones = parseInt(document.getElementById('estaciones')?.value || 5);
    const tiempo = parseInt(document.getElementById('tiempo')?.value || 60);
    const operarios = parseInt(document.getElementById('operarios')?.value || 2);
    const costoHora = parseInt(document.getElementById('costo-hora')?.value || 25);
    const costoMaterial = parseInt(document.getElementById('costo-material')?.value || 12);
    const lote = parseInt(document.getElementById('lote')?.value || 100);
    
    // Calcular métricas dinámicamente
    const tiempoTotalMinutos = (tiempo * lote) / 60;
    const costoManoDeObra = (estaciones * operarios * costoHora * tiempoTotalMinutos) / 60;
    const costoMateriales = costoMaterial * lote;
    const costoTotal = costoManoDeObra + costoMateriales;
    const costoUnitario = costoTotal / lote;
    
    // Mostrar información dinámica en el status
    const status = document.getElementById('status');
    if (status) {
        status.innerHTML = `
            <i class="fas fa-calculator"></i>
            <div>
                <strong>Cálculo automático:</strong><br>
                Costo estimado: $${costoTotal.toFixed(2)} para ${lote} unidades<br>
                <small>($${costoUnitario.toFixed(2)} por unidad)</small>
            </div>
        `;
    }
}

// Actualizar línea de producción visual
function updateProductionLine() {
    const numEstaciones = document.getElementById('estaciones').value;
    const productionLine = document.querySelector('.production-line');
    
    if (!productionLine) return;
    
    // Limpiar estaciones existentes
    productionLine.innerHTML = '';
    
    const iconos = ['fas fa-hammer', 'fas fa-wrench', 'fas fa-cog', 'fas fa-tools', 'fas fa-box', 'fas fa-truck', 'fas fa-shipping-fast', 'fas fa-check'];
    const utilizacion = [75, 45, 90, 65, 20, 10, 35, 50]; // Valores aleatorios de utilización
    
    for (let i = 0; i < numEstaciones; i++) {
        const station = document.createElement('div');
        const isBottleneck = utilizacion[i] > 80;
        const isActive = utilizacion[i] > 30;
        
        station.className = `station ${isActive ? 'active' : ''} ${isBottleneck ? 'bottleneck' : ''}`;
        
        station.innerHTML = `
            <i class="${iconos[i] || 'fas fa-cog'}"></i>
            <span>Estación ${i + 1}</span>
            <div class="progress-bar">
                <div class="progress" style="width: ${utilizacion[i]}%"></div>
            </div>
        `;
        
        productionLine.appendChild(station);
    }
}

// Actualizar datos basados en el escenario seleccionado
function updateScenarioData(scenario) {
    const data = simulationData[scenario];
    if (!data) return;
    
    // Actualizar métricas visuales
    updateMetrics(data);
    updateProductionLineUtilization(data.estaciones);
}

// Actualizar métricas en tiempo real
function updateMetrics(data) {
    const tiempoElement = document.querySelector('.metric-value');
    const eficienciaElements = document.querySelectorAll('.metric-value');
    const costoElements = document.querySelectorAll('.metric-value');
    
    if (tiempoElement) tiempoElement.textContent = data.tiempo + ' min';
    if (eficienciaElements[1]) eficienciaElements[1].textContent = data.eficiencia + '%';
    if (costoElements[2]) costoElements[2].textContent = '$' + data.costo;
}

// Actualizar utilización de estaciones
function updateProductionLineUtilization(utilizaciones) {
    const stations = document.querySelectorAll('.station');
    stations.forEach((station, index) => {
        if (index < utilizaciones.length) {
            const progressBar = station.querySelector('.progress');
            if (progressBar) {
                progressBar.style.width = utilizaciones[index] + '%';
            }
            
            // Actualizar clases según utilización
            station.classList.remove('active', 'bottleneck');
            if (utilizaciones[index] > 80) {
                station.classList.add('bottleneck');
            } else if (utilizaciones[index] > 30) {
                station.classList.add('active');
            }
        }
    });
}

// Función principal de simulación
function ejecutarSimulacion() {
    if (simulationRunning) return;
    
    simulationRunning = true;
    const button = document.querySelector('.simulate-btn');
    const status = document.getElementById('status');
    
    // Actualizar UI
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Simulando...';
    button.disabled = true;
    
    if (status) {
        status.innerHTML = '<i class="fas fa-cogs fa-spin"></i> <span>Ejecutando simulación...</span>';
        status.style.background = '#fff3cd';
        status.style.borderColor = '#ffc107';
    }
    
    // Simular progreso
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        
        if (progress >= 100) {
            clearInterval(interval);
            finalizarSimulacion();
        }
        
        // Animar estaciones durante la simulación
        animateStations();
    }, 200);
}

// Finalizar simulación
function finalizarSimulacion() {
    simulationRunning = false;
    const button = document.querySelector('.simulate-btn');
    const status = document.getElementById('status');
    
    // Restaurar botón
    button.innerHTML = '<i class="fas fa-play"></i> Ejecutar Simulación';
    button.disabled = false;
    
    // Actualizar status
    if (status) {
        status.innerHTML = '<i class="fas fa-check-circle"></i> <span>Simulación completada</span>';
        status.style.background = '#d1ecf1';
        status.style.borderColor = '#17a2b8';
    }
    
    // Actualizar resultados
    const escenario = document.getElementById('escenario').value;
    updateScenarioData(escenario);
    updateChart();
    
    // Scroll a resultados
    setTimeout(() => {
        document.getElementById('resultados').scrollIntoView({ behavior: 'smooth' });
    }, 500);
}

// Animar estaciones durante simulación
function animateStations() {
    const stations = document.querySelectorAll('.station');
    stations.forEach((station, index) => {
        setTimeout(() => {
            station.style.transform = 'scale(1.05)';
            setTimeout(() => {
                station.style.transform = 'scale(1)';
            }, 200);
        }, index * 100);
    });
}

// Inicializar gráfico de comparación
function initializeChart() {
    const ctx = document.getElementById('comparisonChart');
    if (!ctx) return;
    
    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tiempo Total (min)', 'Eficiencia (%)', 'Costo/Hora ($)', 'Utilización Promedio (%)'],
            datasets: [
                {
                    label: 'Estado Actual',
                    data: [28.5, 73, 525, 65],
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Propuesta Mejorada',
                    data: [24.5, 85, 485, 78],
                    backgroundColor: 'rgba(39, 174, 96, 0.7)',
                    borderColor: 'rgba(39, 174, 96, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Comparativa de Métricas Clave'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            // Formatear valores según la métrica
                            const labels = this.chart.data.labels;
                            const currentLabel = labels[index] || '';
                            
                            if (currentLabel.includes('$')) {
                                return '$' + value;
                            } else if (currentLabel.includes('%') || currentLabel.includes('Eficiencia')) {
                                return value + '%';
                            } else if (currentLabel.includes('min')) {
                                return value + ' min';
                            }
                            return value;
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Actualizar gráfico con nuevos datos
function updateChart() {
    if (!comparisonChart) return;
    
    const escenario = document.getElementById('escenario').value;
    const data = simulationData[escenario];
    
    // Actualizar datos del gráfico
    if (escenario === 'mejorado') {
        comparisonChart.data.datasets[1].data = [
            data.tiempo,
            data.eficiencia,
            data.costo,
            data.estaciones.reduce((a, b) => a + b) / data.estaciones.length
        ];
    }
    
    comparisonChart.update('active');
}

// Función para iniciar demo desde hero
function iniciarDemo() {
    document.getElementById('simulador').scrollIntoView({ behavior: 'smooth' });
    
    // Después de scroll, ejecutar una simulación demo
    setTimeout(() => {
        ejecutarSimulacion();
    }, 1000);
}

// Actualizar valores mostrados de los sliders
function updateStationValues() {
    const estacionesSlider = document.getElementById('estaciones');
    const tiempoSlider = document.getElementById('tiempo');
    const operariosSlider = document.getElementById('operarios');
    const costoHoraSlider = document.getElementById('costo-hora');
    const costoMaterialSlider = document.getElementById('costo-material');
    const loteSlider = document.getElementById('lote');
    
    if (estacionesSlider) {
        document.getElementById('estaciones-value').textContent = estacionesSlider.value;
    }
    
    if (tiempoSlider) {
        document.getElementById('tiempo-value').textContent = tiempoSlider.value + ' seg';
    }
    
    if (operariosSlider) {
        document.getElementById('operarios-value').textContent = operariosSlider.value;
    }
    
    if (costoHoraSlider) {
        document.getElementById('costo-hora-value').textContent = costoHoraSlider.value;
    }
    
    if (costoMaterialSlider) {
        document.getElementById('costo-material-value').textContent = costoMaterialSlider.value;
    }
    
    if (loteSlider) {
        document.getElementById('lote-value').textContent = loteSlider.value;
    }
    
    // Ejecutar cálculo inicial
    updateCostCalculation();
}

// Efectos de scroll para animaciones
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector('.hero');
    const speed = 0.5;
    
    if (parallax) {
        parallax.style.transform = `translateY(${scrolled * speed}px)`;
    }
    
    // Animación de aparición de elementos
    const elements = document.querySelectorAll('.feature-card, .metric-card');
    elements.forEach(element => {
        const elementTop = element.offsetTop;
        const elementVisible = 150;
        
        if (scrolled > elementTop - window.innerHeight + elementVisible) {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }
    });
});

// Inicializar animaciones de entrada
document.addEventListener('DOMContentLoaded', function() {
    const elements = document.querySelectorAll('.feature-card, .metric-card');
    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
});

// Funciones utilitarias
function formatNumber(num) {
    return num.toLocaleString('es-MX');
}

function generateRandomData(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Exportar funciones para uso global
window.ejecutarSimulacion = ejecutarSimulacion;
window.iniciarDemo = iniciarDemo;