// Phase 2: Web Audio synth.
export type SoundName = 'pop' | 'squelch' | 'crunch' | 'drip' | 'tape' | 'click';
export const sound = {
  enabled: false,
  setEnabled(on: boolean) {
    this.enabled = on;
  },
  play(_name: SoundName) {},
};
