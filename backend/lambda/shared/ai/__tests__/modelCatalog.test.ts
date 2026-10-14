import { describe, expect, it } from 'vitest';

import { aiEffort, aiModel } from '../modelCatalog';

describe('aiEffort', () => {
  it('is what Settings name, medium when they name nothing or something else', () => {
    expect(aiEffort(() => 'low')).toBe('low');
    expect(aiEffort(() => 'high')).toBe('high');
    expect(aiEffort(() => '')).toBe('medium');
    expect(aiEffort(() => 'max')).toBe('medium');
  });

  it('is only sent to the models that take it', () => {
    expect(aiModel('opus-5').capabilities.effort).toBe(true);
    expect(aiModel('sonnet-5').capabilities.effort).toBe(true);
    expect(aiModel('sonnet-4-6').capabilities.effort).toBeUndefined();
    expect(aiModel('haiku-4-5').capabilities.effort).toBeUndefined();
  });
});
