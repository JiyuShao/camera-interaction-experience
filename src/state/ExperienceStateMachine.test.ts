import { describe, expect, it, vi } from 'vitest';
import { ExperienceStateMachine } from './ExperienceStateMachine';

describe('ExperienceStateMachine', () => {
  it('moves through the initial gathering journey', () => {
    const machine = new ExperienceStateMachine();
    machine.transition('welcome');
    machine.transition('forming');
    machine.transition('baby');
    expect(machine.state).toBe('baby');
  });

  it('allows an in-flight animation to reverse direction', () => {
    const machine = new ExperienceStateMachine();
    machine.transition('welcome');
    machine.transition('forming');
    machine.transition('scattering');
    machine.transition('forming');
    expect(machine.state).toBe('forming');
  });

  it('rejects impossible transitions', () => {
    const machine = new ExperienceStateMachine();
    expect(() => machine.transition('baby')).toThrow('loading → baby');
  });

  it('notifies subscribers immediately and after changes', () => {
    const listener = vi.fn();
    const machine = new ExperienceStateMachine();
    machine.onChange(listener);
    machine.transition('welcome');
    expect(listener).toHaveBeenNthCalledWith(1, 'loading');
    expect(listener).toHaveBeenNthCalledWith(2, 'welcome');
  });
});
