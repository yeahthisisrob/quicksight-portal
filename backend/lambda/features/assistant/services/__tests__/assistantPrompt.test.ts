import { describe, expect, it } from 'vitest';

import { NO_GUIDANCE, systemPrompt } from '../assistantPrompt';

describe('the assistant prompt and tags', () => {
  it("carries the organisation's tag standards and how to tag many things at once", () => {
    const prompt = systemPrompt({
      smus: false,
      guidance: NO_GUIDANCE,
      tagStandards: [
        { key: 'environment', values: ['dev', 'test', 'prod'] },
        { key: 'lifecycle', values: ['draft', 'active', 'deprecated'] },
      ],
    });
    expect(prompt).toContain('environment: one of dev, test, prod');
    expect(prompt).toContain('POST /api/tags/bulk with assets');
    expect(prompt).toContain('create.tags');
  });

  it('says nothing about standards when none are set', () => {
    expect(systemPrompt({ smus: false, guidance: NO_GUIDANCE })).not.toContain(
      "The organisation's tags."
    );
  });
});
