/**
 * js/engine/StateManager.js
 * Almacén de Estado Reactivo Centralizado (Patrón Observable / Event Bus).
 * Gestiona los parámetros del circuito, ejecuta el motor de cálculo y notifica a los observadores.
 */

import { CircuitEngine } from './CircuitEngine.js';

export class StateManager {
  constructor(initialState = {}) {
    this._state = {
      topology: initialState.topology || 'series',
      voltage: initialState.voltage !== undefined ? initialState.voltage : 12,
      resistors: initialState.resistors || [10, 20, 30],
      switches: initialState.switches || ['ON', 'ON', 'ON'],
      telemetry: null
    };

    this._listeners = new Set();
    this._recalculate();
  }

  /**
   * Obtiene una copia del estado actual y telemetría calculada.
   */
  getState() {
    return {
      ...this._state,
      resistors: [...this._state.resistors],
      switches: [...this._state.switches],
      telemetry: { ...this._state.telemetry }
    };
  }

  /**
   * Suscribe una función listener que se ejecutará en cada cambio de estado.
   * @param {Function} listener - Callback (state) => void
   * @returns {Function} Función para desuscribirse
   */
  subscribe(listener) {
    this._listeners.add(listener);
    // Notificación inmediata con el estado actual
    listener(this.getState());
    return () => this._listeners.delete(listener);
  }

  /**
   * Actualiza la topología del circuito.
   * @param {'series'|'parallel'|'mixed'} topology 
   */
  setTopology(topology) {
    if (this._state.topology !== topology) {
      this._state.topology = topology;
      this._recalculate();
      this._notify();
    }
  }

  /**
   * Actualiza el voltaje de la fuente de alimentación.
   * @param {number} voltage 
   */
  setVoltage(voltage) {
    const val = Math.max(0, Math.min(100, Number(voltage) || 0));
    if (this._state.voltage !== val) {
      this._state.voltage = val;
      this._recalculate();
      this._notify();
    }
  }

  /**
   * Actualiza el valor nominal de una resistencia específica.
   * @param {number} index - 0 para R1, 1 para R2, 2 para R3
   * @param {number} resistance - Valor en Ohmios (1 a 1000)
   */
  setResistor(index, resistance) {
    const val = Math.max(1, Math.min(1000, Number(resistance) || 10));
    if (this._state.resistors[index] !== val) {
      this._state.resistors[index] = val;
      this._recalculate();
      this._notify();
    }
  }

  /**
   * Conmuta o establece el estado de un switch de falla.
   * @param {number} index - 0 para R1, 1 para R2, 2 para R3
   * @param {'ON'|'OPEN'|'SHORT'} state 
   */
  setSwitchState(index, state) {
    const validStates = ['ON', 'OPEN', 'SHORT'];
    const s = validStates.includes(state) ? state : 'ON';
    if (this._state.switches[index] !== s) {
      this._state.switches[index] = s;
      this._recalculate();
      this._notify();
    }
  }

  /**
   * Alterna el estado de un switch entre ON y OPEN (para acción rápida).
   * @param {number} index 
   */
  toggleSwitch(index) {
    const current = this._state.switches[index];
    const next = current === 'ON' ? 'OPEN' : 'ON';
    this.setSwitchState(index, next);
  }

  /**
   * Restablece todos los parámetros a los valores de calibración predeterminados.
   */
  resetToDefaults() {
    this._state.voltage = 12;
    this._state.resistors = [10, 20, 30];
    this._state.switches = ['ON', 'ON', 'ON'];
    this._recalculate();
    this._notify();
  }

  /**
   * Ejecuta el motor físico determinista y actualiza la telemetría.
   * @private
   */
  _recalculate() {
    this._state.telemetry = CircuitEngine.calculate({
      topology: this._state.topology,
      voltage: this._state.voltage,
      resistors: this._state.resistors,
      switches: this._state.switches
    });
  }

  /**
   * Notifica a todos los observadores registrados.
   * @private
   */
  _notify() {
    const snapshot = this.getState();
    this._listeners.forEach(fn => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('Error en listener de StateManager:', err);
      }
    });
  }
}
