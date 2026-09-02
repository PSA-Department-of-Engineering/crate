export * from './types';
export * from './RuleRegistry';
export * from './RulesEngine';

import { RuleRegistry } from './RuleRegistry';
import { RulesEngine } from './RulesEngine';

export const defaultRuleRegistry = new RuleRegistry();
export const defaultRulesEngine = new RulesEngine(defaultRuleRegistry);
