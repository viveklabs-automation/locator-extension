export type LocatorKind =
  | 'getByTestId'
  | 'getByRole'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByText'
  | 'getByAltText'
  | 'getByTitle'
  | 'css'
  | 'xpath';

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'java';

export type RefinementStrategy = 'direct' | 'scoped' | 'filtered' | 'nth';

export interface LocatorCall {
  method: LocatorKind | 'locator';
  args: any[];
}

export interface FilterOptions {
  hasText?: string;
  hasNotText?: string;
}

export interface ChainedStep {
  type: 'locator' | 'filter' | 'nth';
  call: LocatorCall | { method: 'filter'; options: FilterOptions } | { method: 'nth'; index: number };
}

export interface LocatorCandidate {
  kind: LocatorKind;
  strategy: RefinementStrategy;
  isUnique: boolean;
  matchCount: number;
  steps: ChainedStep[];
  code: Record<SupportedLanguage, string>;
  description?: string;
  score?: number;
  scoreReason?: string;
}

export interface GeneratorConfig {
  testIdAttribute: string;
  priorityOrder: LocatorKind[];
  defaultLanguage: SupportedLanguage;
  maxScopingDepth: number;
}
