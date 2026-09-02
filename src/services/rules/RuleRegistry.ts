import { Rule, RulePreset } from './types';

export class RuleRegistry {
  private rules: Map<string, Rule> = new Map();
  private presets: Map<string, RulePreset> = new Map();

  constructor() {
    // Default 'all' preset that automatically includes all registered rules
    this.presets.set('all', {
      id: 'all',
      name: 'All Rules',
      description: 'Applies all active system rules for filename and metadata standardization.',
      ruleIds: [],
    });
  }

  /**
   * Registers a rule and adds it to the 'all' preset.
   */
  registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
    const allPreset = this.presets.get('all');
    if (allPreset && !allPreset.ruleIds.includes(rule.id)) {
      allPreset.ruleIds.push(rule.id);
    }
  }

  /**
   * Removes a rule from the registry and from all presets.
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
    for (const preset of this.presets.values()) {
      preset.ruleIds = preset.ruleIds.filter(id => id !== ruleId);
    }
  }

  /**
   * Retrieves a rule by ID.
   */
  getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Returns all registered rules.
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Registers a custom rule preset.
   */
  registerPreset(preset: RulePreset): void {
    this.presets.set(preset.id, preset);
  }

  /**
   * Retrieves a preset by ID.
   */
  getPreset(presetId: string): RulePreset | undefined {
    return this.presets.get(presetId);
  }

  /**
   * Returns all registered presets.
   */
  getAllPresets(): RulePreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Returns the rules associated with a given preset (defaults to 'all').
   */
  getRulesForPreset(presetId: string = 'all'): Rule[] {
    const preset = this.presets.get(presetId);
    if (!preset) return [];
    return preset.ruleIds
      .map(id => this.rules.get(id))
      .filter((r): r is Rule => r !== undefined);
  }

  /**
   * Clears all rules and resets presets to initial default state.
   */
  clear(): void {
    this.rules.clear();
    this.presets.clear();
    this.presets.set('all', {
      id: 'all',
      name: 'All Rules',
      description: 'Applies all active system rules for filename and metadata standardization.',
      ruleIds: [],
    });
  }
}
