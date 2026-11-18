// PRUEBA DE PUNTO DE QUIEBRE (breakpoint test)
// Objetivo: aproximar la capacidad del sistema aumentando la tasa de inicio de flujos
// hasta que un umbral crítico falle. El límite observado depende de esta configuración
// y del entorno; no debe interpretarse como una capacidad universal de la API.
//
// A diferencia de un perfil de VUs, el modelo abierto intenta iniciar iteraciones a
// una tasa programada incluso si las anteriores tardan más. Por eso también importa
// revisar si k6 pudo sostener esa tasa (por ejemplo, las iteraciones descartadas).
//
// Ejecutar:  k6 run k6/05-punto-quiebre.js

// Se reutilizan el mismo flujo de usuario, monitor y ciclo de vida. Aquí se importa
// solo la configuración común necesaria; los umbrales se definen específicamente abajo.
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { ESCENARIO_MONITOR, TREND_STATS } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

// Tasa de llegada objetivo al final de la rampa, expresada en inicios de iteración
// por segundo (no equivale directamente al número de VUs concurrentes).
const TASA_MAX = parseInt(__ENV.TASA_MAX || '60', 10);

export const options = {
  // Incluye percentiles altos para identificar el deterioro de las respuestas lentas.
  summaryTrendStats: TREND_STATS,
  scenarios: {
    viajeros: {
      // Aumenta progresivamente la tasa de inicio desde 1 iteración/s hasta
      // TASA_MAX en diez minutos; no es una tasa fija durante todo el test.
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      // k6 reserva inicialmente 50 VUs y puede crear hasta 1000 para sostener
      // la tasa si los flujos tardan más. No limita la tasa objetivo en sí.
      preAllocatedVUs: 50,
      maxVUs: 1000,
      // Al haber una sola etapa, la tasa sube de forma progresiva a lo largo de 10m.
      stages: [{ duration: '10m', target: TASA_MAX }],
    },
    // Mantiene la observación del servidor en paralelo durante toda la rampa.
    monitor: { ...ESCENARIO_MONITOR, duration: '10m' },
  },
  thresholds: {
    // Estos son límites de aborto (abortOnFail), no solo criterios para calificar
    // la prueba al final. El primer umbral que falle detiene la ejecución: ese
    // momento y la tasa alcanzada ayudan a identificar el punto de quiebre.
    // Se filtran por scenario:viajeros para excluir las peticiones de monitorización.
    // delayAbortEval exige que transcurran 30 s antes de evaluar el aborto y así
    // reduce falsos cortes por datos iniciales o ruido momentáneo.
    'http_req_failed{scenario:viajeros}': [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{scenario:viajeros}': [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

// Comprueba salud, reinicia métricas y guarda una referencia inicial del servidor.
export function setup() {
  return prepararPrueba();
}

export default function () {
  // Sin pausas deliberadas entre flujos: en este executor la tasa la controla
  // el plan de llegada, no la velocidad con que un VU termina su iteración.
  viajero({ pausa: [0, 0] });
}

// Función invocada por el escenario de monitorización.
export { monitorServidor };

// Informa del estado final del servidor y de los contadores recopilados.
export function teardown(datos) {
  cerrarPrueba(datos);
}

// Genera el resumen y evidencia de la ejecución bajo el nombre "punto-quiebre".
export const handleSummary = crearResumen('punto-quiebre');
