import { ChainedStep, SupportedLanguage } from './types';

function escapeString(str: string, quote: "'" | '"' = "'"): string {
  if (quote === "'") {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toJavaAriaRole(role: string): string {
  return `AriaRole.${role.toUpperCase().replace(/-/g, '_')}`;
}

export function formatStepForLanguage(
  step: ChainedStep,
  lang: SupportedLanguage,
  isFirst: boolean
): string {
  const prefix = isFirst ? 'page.' : '.';

  if (step.type === 'nth') {
    const call = step.call as { method: 'nth'; index: number };
    return `${prefix}nth(${call.index})`;
  }

  if (step.type === 'filter') {
    const filter = step.call as { method: 'filter'; options: { hasText?: string; hasNotText?: string } };
    const { hasText, hasNotText } = filter.options;

    switch (lang) {
      case 'python': {
        const parts: string[] = [];
        if (hasText !== undefined) parts.push(`has_text="${escapeString(hasText, '"')}"`);
        if (hasNotText !== undefined) parts.push(`has_not_text="${escapeString(hasNotText, '"')}"`);
        return `${prefix}filter(${parts.join(', ')})`;
      }
      case 'java': {
        const parts: string[] = [];
        if (hasText !== undefined) parts.push(`.setHasText("${escapeString(hasText, '"')}")`);
        if (hasNotText !== undefined) parts.push(`.setHasNotText("${escapeString(hasNotText, '"')}")`);
        return `${prefix}filter(new Locator.FilterOptions()${parts.join('')})`;
      }
      case 'typescript':
      case 'javascript':
      default: {
        const parts: string[] = [];
        if (hasText !== undefined) parts.push(`hasText: '${escapeString(hasText, "'")}'`);
        if (hasNotText !== undefined) parts.push(`hasNotText: '${escapeString(hasNotText, "'")}'`);
        return `${prefix}filter({ ${parts.join(', ')} })`;
      }
    }
  }

  // Locator step
  const locatorCall = step.call as { method: string; args: any[] };
  const method = locatorCall.method;
  const args = locatorCall.args;

  switch (lang) {
    case 'python': {
      if (method === 'getByTestId') {
        return `${prefix}get_by_test_id("${escapeString(args[0], '"')}")`;
      }
      if (method === 'getByRole') {
        const role = args[0];
        const options = args[1] || {};
        const optsList: string[] = [];
        if (options.name !== undefined) {
          optsList.push(`name="${escapeString(options.name, '"')}"`);
        }
        if (options.exact !== undefined) {
          optsList.push(`exact=${options.exact ? 'True' : 'False'}`);
        }
        const optStr = optsList.length > 0 ? `, ${optsList.join(', ')}` : '';
        return `${prefix}get_by_role("${escapeString(role, '"')}"${optStr})`;
      }
      if (method === 'getByLabel') {
        const text = args[0];
        const options = args[1];
        const exactStr = options?.exact !== undefined ? `, exact=${options.exact ? 'True' : 'False'}` : '';
        return `${prefix}get_by_label("${escapeString(text, '"')}"${exactStr})`;
      }
      if (method === 'getByPlaceholder') {
        const text = args[0];
        const options = args[1];
        const exactStr = options?.exact !== undefined ? `, exact=${options.exact ? 'True' : 'False'}` : '';
        return `${prefix}get_by_placeholder("${escapeString(text, '"')}"${exactStr})`;
      }
      if (method === 'getByText') {
        const text = args[0];
        const options = args[1];
        const exactStr = options?.exact !== undefined ? `, exact=${options.exact ? 'True' : 'False'}` : '';
        return `${prefix}get_by_text("${escapeString(text, '"')}"${exactStr})`;
      }
      if (method === 'getByAltText') {
        const text = args[0];
        const options = args[1];
        const exactStr = options?.exact !== undefined ? `, exact=${options.exact ? 'True' : 'False'}` : '';
        return `${prefix}get_by_alt_text("${escapeString(text, '"')}"${exactStr})`;
      }
      if (method === 'getByTitle') {
        const text = args[0];
        const options = args[1];
        const exactStr = options?.exact !== undefined ? `, exact=${options.exact ? 'True' : 'False'}` : '';
        return `${prefix}get_by_title("${escapeString(text, '"')}"${exactStr})`;
      }
      return `${prefix}locator("${escapeString(args[0], '"')}")`;
    }

    case 'java': {
      if (method === 'getByTestId') {
        return `${prefix}getByTestId("${escapeString(args[0], '"')}")`;
      }
      if (method === 'getByRole') {
        const role = args[0];
        const options = args[1] || {};
        if (options.name !== undefined) {
          let optChain = `.setName("${escapeString(options.name, '"')}")`;
          if (options.exact !== undefined) {
            optChain += `.setExact(${options.exact})`;
          }
          return `${prefix}getByRole(${toJavaAriaRole(role)}, new Page.GetByRoleOptions()${optChain})`;
        }
        return `${prefix}getByRole(${toJavaAriaRole(role)})`;
      }
      if (method === 'getByLabel') {
        const text = args[0];
        const options = args[1];
        if (options?.exact !== undefined) {
          return `${prefix}getByLabel("${escapeString(text, '"')}", new Page.GetByLabelOptions().setExact(${options.exact}))`;
        }
        return `${prefix}getByLabel("${escapeString(text, '"')}")`;
      }
      if (method === 'getByPlaceholder') {
        const text = args[0];
        const options = args[1];
        if (options?.exact !== undefined) {
          return `${prefix}getByPlaceholder("${escapeString(text, '"')}", new Page.GetByPlaceholderOptions().setExact(${options.exact}))`;
        }
        return `${prefix}getByPlaceholder("${escapeString(text, '"')}")`;
      }
      if (method === 'getByText') {
        const text = args[0];
        const options = args[1];
        if (options?.exact !== undefined) {
          return `${prefix}getByText("${escapeString(text, '"')}", new Page.GetByTextOptions().setExact(${options.exact}))`;
        }
        return `${prefix}getByText("${escapeString(text, '"')}")`;
      }
      if (method === 'getByAltText') {
        const text = args[0];
        const options = args[1];
        if (options?.exact !== undefined) {
          return `${prefix}getByAltText("${escapeString(text, '"')}", new Page.GetByAltTextOptions().setExact(${options.exact}))`;
        }
        return `${prefix}getByAltText("${escapeString(text, '"')}")`;
      }
      if (method === 'getByTitle') {
        const text = args[0];
        const options = args[1];
        if (options?.exact !== undefined) {
          return `${prefix}getByTitle("${escapeString(text, '"')}", new Page.GetByTitleOptions().setExact(${options.exact}))`;
        }
        return `${prefix}getByTitle("${escapeString(text, '"')}")`;
      }
      return `${prefix}locator("${escapeString(args[0], '"')}")`;
    }

    case 'typescript':
    case 'javascript':
    default: {
      if (method === 'getByTestId') {
        return `${prefix}getByTestId('${escapeString(args[0], "'")}')`;
      }
      if (method === 'getByRole') {
        const role = args[0];
        const options = args[1];
        if (options) {
          const parts: string[] = [];
          if (options.name !== undefined) {
            parts.push(`name: '${escapeString(options.name, "'")}'`);
          }
          if (options.exact !== undefined) {
            parts.push(`exact: ${options.exact}`);
          }
          if (parts.length > 0) {
            return `${prefix}getByRole('${escapeString(role, "'")}', { ${parts.join(', ')} })`;
          }
        }
        return `${prefix}getByRole('${escapeString(role, "'")}')`;
      }
      if (
        method === 'getByLabel' ||
        method === 'getByPlaceholder' ||
        method === 'getByText' ||
        method === 'getByAltText' ||
        method === 'getByTitle'
      ) {
        const text = args[0];
        const options = args[1];
        if (options?.exact !== undefined) {
          return `${prefix}${method}('${escapeString(text, "'")}', { exact: ${options.exact} })`;
        }
        return `${prefix}${method}('${escapeString(text, "'")}')`;
      }
      return `${prefix}locator('${escapeString(args[0], "'")}')`;
    }
  }
}

export function formatCandidateCode(steps: ChainedStep[]): Record<SupportedLanguage, string> {
  const languages: SupportedLanguage[] = ['typescript', 'javascript', 'python', 'java'];
  const result: Partial<Record<SupportedLanguage, string>> = {};

  for (const lang of languages) {
    result[lang] = steps.map((s, idx) => formatStepForLanguage(s, lang, idx === 0)).join('');
  }

  return result as Record<SupportedLanguage, string>;
}
