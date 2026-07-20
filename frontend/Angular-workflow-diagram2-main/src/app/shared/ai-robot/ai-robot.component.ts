import { Component, input, computed } from '@angular/core';

export type RobotState = 'idle' | 'thinking' | 'talking' | 'error' | 'success';

@Component({
  selector: 'app-ai-robot',
  standalone: true,
  templateUrl: './ai-robot.component.html',
  styleUrl: './ai-robot.component.css',
})
export class AiRobotComponent {
  /** Current state of the robot – drives all visual changes */
  state = input<RobotState>('idle');
  /** Optional compact mode for tight sidebar layouts */
  compact = input(false);

  /** Derived CSS class for the wrapper */
  hostClass = computed(() => {
    const s = this.state();
    const c = this.compact() ? ' robot--compact' : '';
    return `robot robot--${s}${c}`;
  });

  /** Eye glow color based on state */
  eyeColor = computed(() => {
    switch (this.state()) {
      case 'thinking': return '#14b8a6';
      case 'talking':  return '#5eead4';
      case 'error':    return '#f87171';
      case 'success':  return '#34d399';
      default:         return '#99f6e4';
    }
  });

  /** Antenna glow */
  antennaColor = computed(() => {
    switch (this.state()) {
      case 'thinking': return '#0ea5e9';
      case 'talking':  return '#14b8a6';
      case 'error':    return '#ef4444';
      case 'success':  return '#10b981';
      default:         return '#0d9488';
    }
  });

  /** Status label */
  statusLabel = computed(() => {
    switch (this.state()) {
      case 'thinking': return 'Procesando...';
      case 'talking':  return 'Respondiendo';
      case 'error':    return 'Error';
      case 'success':  return 'Listo';
      default:         return 'Esperando';
    }
  });
}
