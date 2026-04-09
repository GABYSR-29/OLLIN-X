import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import '../styles/landing.css';

Chart.register(...registerables);

const SIMULATION_DATA = {
  actual: {
    tiempo: 28.5,
    eficiencia: 73,
    costo: 525,
    estaciones: [65, 82, 95, 45, 38],
  },
  mejorado: {
    tiempo: 24.5,
    eficiencia: 85,
    costo: 485,
    estaciones: [78, 85, 75, 88, 92],
  },
};

const ICONOS = ['fas fa-hammer', 'fas fa-wrench', 'fas fa-cog', 'fas fa-tools', 'fas fa-box', 'fas fa-truck', 'fas fa-shipping-fast', 'fas fa-check'];
const UTILIZACION_BASE = [75, 45, 90, 65, 20, 10, 35, 50];

export default function Landing() {
  const navigate = useNavigate();
  const [estaciones, setEstaciones] = useState(5);
  const [tiempo, setTiempo] = useState(60);
  const [operarios, setOperarios] = useState(2);
  const [costoHora, setCostoHora] = useState(25);
  const [costoMaterial, setCostoMaterial] = useState(12);
  const [lote, setLote] = useState(100);
  const [escenario, setEscenario] = useState('actual');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [statusType, setStatusType] = useState('ready'); // 'ready' | 'calculating' | 'running' | 'completed'
  const [simulateBtnContent, setSimulateBtnContent] = useState(<><i className="fas fa-play"></i> Ejecutar Simulación</>);
  const [metricTiempo, setMetricTiempo] = useState('24.5 min');
  const [metricEficiencia, setMetricEficiencia] = useState('85%');
  const [metricCosto, setMetricCosto] = useState('$485');
  const [utilizacion, setUtilizacion] = useState(UTILIZACION_BASE);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const costoTotal = ((estaciones * operarios * costoHora * ((tiempo * lote) / 60)) / 60) + (costoMaterial * lote);
  const costoUnitario = costoTotal / lote;

  function handleScrollToSection(e, id) {
    e.preventDefault();
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    setUtilizacion(UTILIZACION_BASE.slice(0, estaciones).concat(UTILIZACION_BASE.slice(estaciones)));
  }, [estaciones]);


  useEffect(() => {
    const data = SIMULATION_DATA[escenario];
    if (data) {
      setMetricTiempo(data.tiempo + ' min');
      setMetricEficiencia(data.eficiencia + '%');
      setMetricCosto('$' + data.costo);
      setUtilizacion((prev) => {
        const next = [...prev];
        data.estaciones.forEach((v, i) => { if (i < next.length) next[i] = v; });
        return next;
      });
    }
  }, [escenario]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: ['Tiempo Total (min)', 'Eficiencia (%)', 'Costo/Hora ($)', 'Utilización Promedio (%)'],
        datasets: [
          { label: 'Estado Actual', data: [28.5, 73, 525, 65], backgroundColor: 'rgba(231, 76, 60, 0.7)', borderColor: 'rgba(231, 76, 60, 1)', borderWidth: 2 },
          { label: 'Propuesta Mejorada', data: [24.5, 85, 485, 78], backgroundColor: 'rgba(39, 174, 96, 0.7)', borderColor: 'rgba(39, 174, 96, 1)', borderWidth: 2 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Comparativa de Métricas Clave' } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => { chartInstanceRef.current?.destroy(); };
  }, []);

  function ejecutarSimulacion() {
    if (simulationRunning) return;
    setSimulationRunning(true);
    setSimulateBtnContent(<><i className="fas fa-spinner fa-spin"></i> Simulando...</>);
    setStatusType('running');

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        clearInterval(interval);
        setSimulationRunning(false);
        setSimulateBtnContent(<><i className="fas fa-play"></i> Ejecutar Simulación</>);
        setStatusType('completed');
        const data = SIMULATION_DATA[escenario];
        if (data) {
          setMetricTiempo(data.tiempo + ' min');
          setMetricEficiencia(data.eficiencia + '%');
          setMetricCosto('$' + data.costo);
          const arr = [...data.estaciones];
          while (arr.length < 8) arr.push(UTILIZACION_BASE[arr.length % UTILIZACION_BASE.length]);
          setUtilizacion(arr);
        }
        if (chartInstanceRef.current && escenario === 'mejorado') {
          const d = SIMULATION_DATA.mejorado;
          chartInstanceRef.current.data.datasets[1].data = [d.tiempo, d.eficiencia, d.costo, d.estaciones.reduce((a, b) => a + b) / d.estaciones.length];
          chartInstanceRef.current.update('active');
        }
        setTimeout(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth' }), 500);
      }
    }, 200);
  }

  const estacionesArray = Array.from({ length: Math.min(estaciones, 8) }, (_, i) => i);

  return (
    <div className="landing-page">
      <header className="header">
        <div className="container">
          <div className="logo">
            <i className="fas fa-cogs"></i>
            <span>OllinX</span>
          </div>
          <nav className="nav">
            <a href="#inicio" onClick={(e) => handleScrollToSection(e, 'inicio')}>Inicio</a>
            <a href="#simulador" onClick={(e) => handleScrollToSection(e, 'simulador')}>Simulador</a>
            <a href="#resultados" onClick={(e) => handleScrollToSection(e, 'resultados')}>Análisis</a>
            <a href="#contacto" onClick={(e) => handleScrollToSection(e, 'contacto')}>Contacto</a>
            <Link to="/login" className="nav-auth-btn">
              <i className="fas fa-sign-in-alt"></i> Ingresar
            </Link>
            <Link to="/register" className="nav-auth-btn register">
              <i className="fas fa-user-plus"></i> Registrarse
            </Link>
          </nav>
        </div>
      </header>

      <section id="inicio" className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Simulador 3D Industrial con IA</h1>
            <p className="hero-subtitle">Diseña y mejora tu lugar de trabajo favorito</p>
            <div className="hero-features">
              <div className="feature">
                <i className="fas fa-cube"></i>
                <span>Visualización 3D</span>
              </div>
              <div className="feature">
                <i className="fas fa-brain"></i>
                <span>Análisis IA</span>
              </div>
              <div className="feature">
                <i className="fas fa-chart-line"></i>
                <span>Métricas en Tiempo Real</span>
              </div>
            </div>
            <button className="cta-button" type="button" onClick={() => navigate('/login')}>
              <i className="fas fa-play"></i> Iniciar Demostración
            </button>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              <img src="/hero-industrial.png" alt="OllinX - Simulación Industrial Inteligente" className="main-hero-img" />
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>¿Cómo funciona el simulador?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-cog"></i></div>
              <h3>1. Configuración</h3>
              <p>Define parámetros personalizables de tu línea de producción: estaciones, tiempos, operarios y costos exactos</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-play-circle"></i></div>
              <h3>2. Simulación</h3>
              <p>Ejecuta escenarios comparativos del estado actual vs mejoras propuestas</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-chart-bar"></i></div>
              <h3>3. Análisis</h3>
              <p>Recibe insights inteligentes sobre cuellos de botella y oportunidades</p>
            </div>
          </div>
        </div>
      </section>

      <section id="simulador" className="simulator-section">
        <div className="container">
          <h2>Demostración Interactiva</h2>
          <div className="simulator-layout">
            <div className="control-panel">
              <h3>Panel de Control</h3>
              <div className="control-group">
                <label htmlFor="escenario">Escenario:</label>
                <select id="escenario" value={escenario} onChange={(e) => setEscenario(e.target.value)}>
                  <option value="actual">Estado Actual</option>
                  <option value="mejorado">Propuesta Mejorada</option>
                </select>
              </div>
              <div className="control-group">
                <label>Estaciones de Trabajo:</label>
                <input type="range" min="3" max="8" value={estaciones} onChange={(e) => setEstaciones(Number(e.target.value))} />
                <span>{estaciones}</span>
              </div>
              <div className="control-group">
                <label>Tiempo por Unidad (seg):</label>
                <input type="range" min="30" max="120" value={tiempo} onChange={(e) => setTiempo(Number(e.target.value))} />
                <span>{tiempo} seg</span>
              </div>
              <div className="control-group">
                <label>Operarios por Estación:</label>
                <input type="range" min="1" max="4" value={operarios} onChange={(e) => setOperarios(Number(e.target.value))} />
                <span>{operarios}</span>
              </div>
              <div className="control-group">
                <label>Costo por Hora (¢/hr):</label>
                <input type="range" min="15" max="35" value={costoHora} onChange={(e) => setCostoHora(Number(e.target.value))} />
                <span>{costoHora}</span>
              </div>
              <div className="control-group">
                <label>Costo Material por Unidad (¢):</label>
                <input type="range" min="5" max="25" value={costoMaterial} onChange={(e) => setCostoMaterial(Number(e.target.value))} />
                <span>{costoMaterial}</span>
              </div>
              <div className="control-group">
                <label>Unidades por Lote:</label>
                <input type="range" min="50" max="500" value={lote} onChange={(e) => setLote(Number(e.target.value))} />
                <span>{lote}</span>
              </div>
              <button className="simulate-btn" type="button" disabled={simulationRunning} onClick={ejecutarSimulacion}>
                {simulateBtnContent}
              </button>
              <div
                className="status"
                style={{
                  background: statusType === 'running' ? '#fff3cd' : statusType === 'completed' ? '#d1ecf1' : '#e8f6f3',
                  borderLeftColor: statusType === 'running' ? '#ffc107' : statusType === 'completed' ? '#17a2b8' : '#27ae60',
                }}
              >
                <i className={`fas ${statusType === 'running' ? 'fa-cogs fa-spin' : statusType === 'completed' ? 'fa-check-circle' : 'fa-calculator'}`}></i>
                <span>
                  {statusType === 'running' && 'Ejecutando simulación...'}
                  {statusType === 'completed' && 'Simulación completada'}
                  {statusType !== 'running' && statusType !== 'completed' && (
                    <>
                      <strong>Cálculo automático:</strong><br />
                      Costo estimado: ${costoTotal.toFixed(2)} para {lote} unidades<br />
                      <small>(${costoUnitario.toFixed(2)} por unidad)</small>
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="visualization-area">
              <h3>Visualización 3D de la Línea de Producción</h3>
              <div className="mockup-viewport">
                <div className="production-line">
                  {estacionesArray.map((i) => {
                    const util = utilizacion[i] ?? 50;
                    const isBottleneck = util > 80;
                    const isActive = util > 30;
                    return (
                      <div key={i} className={`station ${isActive ? 'active' : ''} ${isBottleneck ? 'bottleneck' : ''}`}>
                        <i className={ICONOS[i] || 'fas fa-cog'}></i>
                        <span>Estación {i + 1}</span>
                        <div className="progress-bar">
                          <div className="progress" style={{ width: `${util}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="legend">
                  <span className="legend-item active">🟢 Funcionando</span>
                  <span className="legend-item bottleneck">🔴 Cuello de Botella</span>
                  <span className="legend-item idle">⚪ Inactivo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="resultados" className="results-section">
        <div className="container">
          <h2>Análisis Inteligente de Resultados</h2>
          <div className="results-layout">
            <div className="metrics-panel">
              <h3>Métricas Comparativas</h3>
              <div className="metric-card">
                <div className="metric-icon"><i className="fas fa-clock"></i></div>
                <div className="metric-content">
                  <span className="metric-label">Tiempo Total</span>
                  <span className="metric-value">{metricTiempo}</span>
                  <span className="metric-change positive">-15% vs actual</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon"><i className="fas fa-percentage"></i></div>
                <div className="metric-content">
                  <span className="metric-label">Eficiencia</span>
                  <span className="metric-value">{metricEficiencia}</span>
                  <span className="metric-change positive">+12% vs actual</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon"><i className="fas fa-dollar-sign"></i></div>
                <div className="metric-content">
                  <span className="metric-label">Costo/Hora</span>
                  <span className="metric-value">{metricCosto}</span>
                  <span className="metric-change positive">-8% vs actual</span>
                </div>
              </div>
            </div>
            <div className="ai-analysis">
              <h3>🤖 Análisis IA</h3>
              <div className="analysis-content">
                <div className="insight">
                  <i className="fas fa-lightbulb"></i>
                  <p><strong>Cuello de botella identificado:</strong> La Estación 3 está operando al 90% de capacidad, limitando el flujo general.</p>
                </div>
                <div className="insight">
                  <i className="fas fa-trending-up"></i>
                  <p><strong>Oportunidad de mejora:</strong> Agregar un operario adicional en Estación 3 podría incrementar la eficiencia en un 15%.</p>
                </div>
                <div className="insight">
                  <i className="fas fa-money-bill-wave"></i>
                  <p><strong>Impacto económico:</strong> La inversión se recuperaría en 3.2 meses con el ahorro estimado de $485/hora.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="chart-container">
            <h3>Comparativa Visual</h3>
            <canvas ref={chartRef} width="800" height="300"></canvas>
          </div>
        </div>
      </section>

      <footer id="contacto" className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>OllinX</h3>
              <p>Simulación inteligente para la industria del futuro</p>
            </div>
            <div className="footer-section">
              <h4>Contacto</h4>
              <p>📧 contacto@ollinx.com</p>
              <p>📞 +52 (55) 1234-5678</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
