import { describe, expect, it } from 'vitest';

import {
  type AuthorFlowState,
  authorFlowReducer,
  initialAuthorFlowState,
  stepStatus,
} from '../authorFlow';
import {
  defaultParts,
  describeParts,
  describeTypeRules,
  hasStandard,
  NO_TYPE_RULES,
  type StandardTemplate,
  templateRequest,
  typeRulesRequest,
  withChartRule,
  withoutChartRule,
} from '../standard';

const source = { type: 'dashboard' as const, id: 'd1', name: 'Sales' };
const template: StandardTemplate = {
  assetType: 'dashboard',
  assetId: 'tpl',
  name: 'Standard',
  parts: defaultParts(),
};

function withSource(): AuthorFlowState {
  return authorFlowReducer(initialAuthorFlowState, { type: 'selectSource', source });
}

describe('standard requests', () => {
  it('sends every template part, and nothing when no template is chosen', () => {
    expect(templateRequest(null)).toBeUndefined();
    expect(templateRequest(template)).toEqual({
      assetType: 'dashboard',
      assetId: 'tpl',
      textBoxes: true,
      controls: true,
      sheetNames: true,
      kpisFirst: true,
      theme: true,
    });
    expect(
      templateRequest({ ...template, parts: { ...template.parts, theme: false } })?.theme
    ).toBe(false);
  });

  it('sends only the type rules that are set', () => {
    expect(typeRulesRequest(NO_TYPE_RULES)).toBeUndefined();
    expect(typeRulesRequest({ ...NO_TYPE_RULES, kpi: true })).toEqual({ kpi: true });
    expect(
      typeRulesRequest({
        chartFamily: [{ from: 'Table', to: 'PivotTable' }],
        kpi: false,
        casts: true,
      })
    ).toEqual({ chartFamily: [{ from: 'Table', to: 'PivotTable' }], casts: true });
  });

  it('keeps one rule per source type and ignores a no-op swap', () => {
    let rules = withChartRule(NO_TYPE_RULES, { from: 'Table', to: 'PivotTable' });
    rules = withChartRule(rules, { from: 'Table', to: 'Table' });
    rules = withChartRule(rules, { from: 'Table', to: 'BarChart' });
    rules = withChartRule(rules, { from: 'PieChart', to: 'DonutChart' });
    expect(rules.chartFamily).toEqual([
      { from: 'Table', to: 'BarChart' },
      { from: 'PieChart', to: 'DonutChart' },
    ]);
    expect(withoutChartRule(rules, 'Table').chartFamily).toEqual([
      { from: 'PieChart', to: 'DonutChart' },
    ]);
  });

  it('describes the choice in words', () => {
    expect(describeParts(defaultParts())).toBe('everything');
    expect(describeParts({ ...defaultParts(), controls: false, theme: false })).toBe(
      'text boxes and title band, sheet names, kpis first'
    );
    expect(describeTypeRules(NO_TYPE_RULES)).toBe('None');
    expect(
      describeTypeRules({
        chartFamily: [{ from: 'BarChart', to: 'ColumnChart' }],
        kpi: true,
        casts: false,
      })
    ).toBe('bar chart → column chart, KPIs standardised');
    expect(hasStandard(null, NO_TYPE_RULES)).toBe(false);
    expect(hasStandard(template, NO_TYPE_RULES)).toBe(true);
    expect(hasStandard(null, { ...NO_TYPE_RULES, casts: true })).toBe(true);
  });
});

describe('authorFlowReducer with a standard', () => {
  it('holds the template, its parts and the rules, and drops them with the source', () => {
    let state = withSource();
    state = authorFlowReducer(state, { type: 'setTemplate', template });
    state = authorFlowReducer(state, { type: 'setTemplatePart', part: 'controls', on: false });
    state = authorFlowReducer(state, {
      type: 'addChartRule',
      rule: { from: 'Table', to: 'PivotTable' },
    });
    state = authorFlowReducer(state, { type: 'setTypeRules', rules: { casts: true } });
    expect(state.template?.parts.controls).toBe(false);
    expect(state.typeRules).toEqual({
      chartFamily: [{ from: 'Table', to: 'PivotTable' }],
      kpi: false,
      casts: true,
    });

    state = authorFlowReducer(state, { type: 'removeChartRule', from: 'Table' });
    expect(state.typeRules.chartFamily).toEqual([]);

    const other = authorFlowReducer(state, {
      type: 'selectSource',
      source: { type: 'analysis', id: 'a1', name: 'Draft' },
    });
    expect(other.template).toBeNull();
    expect(other.typeRules).toEqual(NO_TYPE_RULES);
  });

  it('ignores a part toggle when no template is chosen', () => {
    const state = authorFlowReducer(withSource(), {
      type: 'setTemplatePart',
      part: 'theme',
      on: false,
    });
    expect(state.template).toBeNull();
  });
});

describe('stepStatus with a standard', () => {
  const facts = { hasTargets: false, canApply: true };

  it('offers the standard once there is a source, and a rule alone opens the mockup', () => {
    const state = withSource();
    expect(stepStatus(state, facts).standard).toBe('available');
    expect(stepStatus(state, facts).mockup).toBe('locked');
    const withRule = stepStatus(state, { ...facts, hasStandard: true });
    expect(withRule.standard).toBe('done');
    expect(withRule.mockup).toBe('available');
    expect(withRule.publish).toBe('available');
  });

  it('keeps the standard optional: skipping it leaves the mockup open when something else changed', () => {
    const state = withSource();
    const status = stepStatus(state, { ...facts, hasTargets: true });
    expect(status.standard).toBe('available');
    expect(status.mockup).toBe('available');
  });
});
