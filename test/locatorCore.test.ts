import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  generateLocators,
  DEFAULT_CONFIG,
  evaluateLocatorSteps,
  formatCandidateCode,
} from '../src/locator-core';

describe('locator-core generator & uniqueness guard', () => {
  beforeEach(() => {
    const html = readFileSync(resolve(__dirname, 'fixture.html'), 'utf-8');
    document.body.innerHTML = html;

    // Attach open shadow DOM to #shadow-host
    const host = document.getElementById('shadow-host');
    if (host && !host.shadowRoot) {
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <div class="shadow-inner" data-testid="shadow-card">
          <button data-testid="shadow-btn">Shadow Action</button>
        </div>
      `;
    }
  });

  it('generates getByTestId candidate with top priority', () => {
    const btn = document.querySelector('[data-testid="angular-submit-btn"]')!;
    expect(btn).not.toBeNull();

    const candidates = generateLocators(btn);
    const top = candidates[0];

    expect(top.kind).toBe('getByTestId');
    expect(top.isUnique).toBe(true);
    expect(top.code.typescript).toBe("page.getByTestId('angular-submit-btn')");
    expect(top.code.python).toBe('page.get_by_test_id("angular-submit-btn")');
    expect(top.code.java).toBe('page.getByTestId("angular-submit-btn")');
  });

  it('supports configurable test-id attribute name', () => {
    const el = document.createElement('button');
    el.setAttribute('data-cy', 'cypress-submit');
    el.textContent = 'Custom Test ID';
    document.body.appendChild(el);

    const candidates = generateLocators(el, { testIdAttribute: 'data-cy' });
    const top = candidates[0];

    expect(top.kind).toBe('getByTestId');
    expect(top.code.typescript).toBe("page.getByTestId('cypress-submit')");
    expect(top.code.python).toBe('page.get_by_test_id("cypress-submit")');
  });

  it('generates getByRole with accessible name for button and heading', () => {
    const heading = document.querySelector('h1')!;
    const candidates = generateLocators(heading);
    const roleCandidate = candidates.find(c => c.kind === 'getByRole');

    expect(roleCandidate).toBeDefined();
    expect(roleCandidate?.isUnique).toBe(true);
    expect(roleCandidate?.code.typescript).toBe(
      "page.getByRole('heading', { name: 'Dashboard Overview', exact: true })"
    );
    expect(roleCandidate?.code.python).toBe(
      'page.get_by_role("heading", name="Dashboard Overview", exact=True)'
    );
    expect(roleCandidate?.code.java).toBe(
      'page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Dashboard Overview").setExact(true))'
    );
  });

  it('generates getByLabel for input associated via for-id and wrapped label', () => {
    const emailInput = document.getElementById('angular-email')!;
    const emailCandidates = generateLocators(emailInput);
    const labelCandidate = emailCandidates.find(c => c.kind === 'getByLabel');

    expect(labelCandidate).toBeDefined();
    expect(labelCandidate?.code.typescript).toBe("page.getByLabel('Email Address', { exact: true })");

    const passwordInput = document.querySelector('input[type="password"]')!;
    const pwCandidates = generateLocators(passwordInput);
    const pwLabelCandidate = pwCandidates.find(c => c.kind === 'getByLabel');

    expect(pwLabelCandidate).toBeDefined();
    expect(pwLabelCandidate?.code.typescript).toBe("page.getByLabel('Password', { exact: true })");
  });

  it('generates getByPlaceholder and getByTitle', () => {
    const emailInput = document.getElementById('angular-email')!;
    const candidates = generateLocators(emailInput);
    const phCandidate = candidates.find(c => c.kind === 'getByPlaceholder');

    expect(phCandidate).toBeDefined();
    expect(phCandidate?.code.typescript).toBe("page.getByPlaceholder('name@example.com')");

    const submitBtn = document.querySelector('button[title="Submit Form Tooltip"]')!;
    const submitCandidates = generateLocators(submitBtn);
    const titleCandidate = submitCandidates.find(c => c.kind === 'getByTitle');

    expect(titleCandidate).toBeDefined();
    expect(titleCandidate?.code.typescript).toBe("page.getByTitle('Submit Form Tooltip')");
  });

  it('generates getByAltText for images', () => {
    const img = document.querySelector('img[alt="Alpha Avatar"]')!;
    const candidates = generateLocators(img);
    const altCandidate = candidates.find(c => c.kind === 'getByAltText');

    expect(altCandidate).toBeDefined();
    expect(altCandidate?.code.typescript).toBe("page.getByAltText('Alpha Avatar')");
    expect(altCandidate?.code.python).toBe('page.get_by_alt_text("Alpha Avatar")');
  });

  it('scopes duplicate buttons under a unique parent card', () => {
    // Both cards have a "Save Changes" button
    const buttons = Array.from(document.querySelectorAll('button')).filter(
      b => b.textContent?.trim() === 'Save Changes'
    );
    expect(buttons.length).toBe(2);

    const alphaBtn = buttons[0];
    const candidates = generateLocators(alphaBtn);

    const roleCandidate = candidates.find(c => c.kind === 'getByRole');
    expect(roleCandidate).toBeDefined();
    expect(roleCandidate?.isUnique).toBe(true);
    expect(roleCandidate?.strategy).toBe('scoped');
    expect(roleCandidate?.code.typescript).toContain("getByTestId('user-card-alpha')");
    expect(roleCandidate?.code.typescript).toContain("getByRole('button', { name: 'Save Changes', exact: true })");
  });

  it('uses .nth() fallback when identical elements cannot be scoped', () => {
    const listItems = Array.from(document.querySelectorAll('.notification-item'));
    expect(listItems.length).toBe(3);

    const secondItem = listItems[1];
    const candidates = generateLocators(secondItem);
    const textCandidate = candidates.find(c => c.kind === 'getByText');

    expect(textCandidate).toBeDefined();
    expect(textCandidate?.strategy).toBe('nth');
    expect(textCandidate?.code.typescript).toBe("page.getByText('Dismiss', { exact: true }).nth(1)");
    expect(textCandidate?.code.python).toBe('page.get_by_text("Dismiss", exact=True).nth(1)');
    expect(textCandidate?.code.java).toBe('page.getByText("Dismiss", new Page.GetByTextOptions().setExact(true)).nth(1)');
  });

  it('supports elements inside open Shadow Root', () => {
    const host = document.getElementById('shadow-host')!;
    const shadowBtn = host.shadowRoot!.querySelector('[data-testid="shadow-btn"]')!;
    expect(shadowBtn).not.toBeNull();

    const candidates = generateLocators(shadowBtn);
    const top = candidates[0];

    expect(top.kind).toBe('getByTestId');
    expect(top.isUnique).toBe(true);
    expect(top.code.typescript).toBe("page.getByTestId('shadow-btn')");
  });
});
