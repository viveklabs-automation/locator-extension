import { GeneratorConfig, LocatorKind, SupportedLanguage } from './types';

export const DEFAULT_PRIORITY_ORDER: LocatorKind[] = [
  'getByTestId',
  'getByRole',
  'getByLabel',
  'getByPlaceholder',
  'getByText',
  'getByAltText',
  'getByTitle',
  'css',
  'xpath',
];

export const DEFAULT_CONFIG: GeneratorConfig = {
  testIdAttribute: 'data-testid',
  priorityOrder: DEFAULT_PRIORITY_ORDER,
  defaultLanguage: 'typescript',
  maxScopingDepth: 3,
};

export function resolveConfig(custom?: Partial<GeneratorConfig>): GeneratorConfig {
  return {
    testIdAttribute: custom?.testIdAttribute || DEFAULT_CONFIG.testIdAttribute,
    priorityOrder: custom?.priorityOrder && custom.priorityOrder.length > 0
      ? custom.priorityOrder
      : DEFAULT_CONFIG.priorityOrder,
    defaultLanguage: custom?.defaultLanguage || DEFAULT_CONFIG.defaultLanguage,
    maxScopingDepth: custom?.maxScopingDepth ?? DEFAULT_CONFIG.maxScopingDepth,
  };
}
