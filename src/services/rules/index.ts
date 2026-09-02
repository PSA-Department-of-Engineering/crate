export * from './types';
export * from './RuleRegistry';
export * from './RulesEngine';
export * from './implementations';
export * from './registerDefaultRules';

import { RuleRegistry } from './RuleRegistry';
import { RulesEngine } from './RulesEngine';
import { registerDefaultRules } from './registerDefaultRules';

export const defaultRuleRegistry = new RuleRegistry();
registerDefaultRules(defaultRuleRegistry);

export const defaultRulesEngine = new RulesEngine(defaultRuleRegistry);
