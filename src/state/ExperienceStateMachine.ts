export type ExperienceState =
  | 'loading'
  | 'welcome'
  | 'forming'
  | 'baby'
  | 'scattering'
  | 'scattered'
  | 'error';

type StateListener = (state: ExperienceState) => void;

const allowedTransitions: Record<ExperienceState, ExperienceState[]> = {
  loading: ['welcome', 'error'],
  welcome: ['forming', 'error'],
  forming: ['baby', 'scattering', 'error'],
  baby: ['scattering', 'error'],
  scattering: ['scattered', 'forming', 'error'],
  scattered: ['forming', 'error'],
  error: [],
};

export class ExperienceStateMachine {
  private currentState: ExperienceState = 'loading';
  private readonly listeners = new Set<StateListener>();

  get state(): ExperienceState {
    return this.currentState;
  }

  transition(nextState: ExperienceState): void {
    if (!allowedTransitions[this.currentState].includes(nextState)) {
      throw new Error(`Invalid experience transition: ${this.currentState} → ${nextState}`);
    }
    this.currentState = nextState;
    this.listeners.forEach((listener) => listener(nextState));
  }

  onChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }
}
