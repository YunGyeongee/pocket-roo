import { ATTACKS, type AttackSpec } from '../game/CombatBalance';
import type { AttackKind } from '../game/GameState';

export type AttackPhase = 'startup' | 'active' | 'recovery' | 'done';

/** One punch or kick in progress. The animation reads `progress`; hits only happen in the active window. */
export class Attack {
  elapsed = 0;
  /** Set once the attack has connected (or was dodged), so it can never land twice. */
  connected = false;
  readonly spec: AttackSpec;

  constructor(readonly kind: AttackKind) {
    this.spec = ATTACKS[kind];
  }

  get duration(): number {
    return this.spec.startup + this.spec.active + this.spec.recovery;
  }

  get phase(): AttackPhase {
    const { startup, active } = this.spec;
    if (this.elapsed < startup) return 'startup';
    if (this.elapsed < startup + active) return 'active';
    if (this.elapsed < this.duration) return 'recovery';
    return 'done';
  }

  /** 0..1 over the whole attack. */
  get progress(): number {
    return Math.min(1, this.elapsed / this.duration);
  }

  /** True while the attack can still connect. */
  get canConnect(): boolean {
    return this.phase === 'active' && !this.connected;
  }
}
