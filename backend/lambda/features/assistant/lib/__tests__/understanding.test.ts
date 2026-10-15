import { describe, expect, it } from 'vitest';

import type { ChatModel, ChatTurnOptions } from '../../services/ChatModel';
import {
  parseUnderstanding,
  UNDERSTAND_TOOL,
  understandSystem,
  understandWith,
} from '../understanding';

describe('parseUnderstanding', () => {
  it('keeps a visual change with its asset, title, brief and filters', () => {
    expect(
      parseUnderstanding({
        understanding: 'Adding a results table at the bottom of Sales review; planning it now.',
        change: 'visual',
        asset: { kind: 'analysis', name: 'Sales review', id: '' },
        title: 'Results table',
        brief: 'A table of every result at the bottom of the first sheet.',
        filters: [{ column: 'region', dataset: '', control: 'dropdown', placement: '' }],
      })
    ).toEqual({
      understanding: 'Adding a results table at the bottom of Sales review; planning it now.',
      change: 'visual',
      asset: { kind: 'analysis', name: 'Sales review' },
      title: 'Results table',
      brief: 'A table of every result at the bottom of the first sheet.',
      filters: [{ column: 'region', control: 'dropdown' }],
    });
  });

  it('keeps a filter-only ask with its scope and bounds, and reads one with no filter as a visual change', () => {
    expect(
      parseUnderstanding({
        understanding: 'Adding a Region filter to Sales review.',
        change: 'filter',
        asset: { kind: 'analysis', name: 'Sales review', id: '' },
        title: 'Region filter',
        brief: '',
        filters: [
          { column: 'region', dataset: '', control: '', placement: '', min: '', max: '' },
          { column: 'amount', dataset: '', control: 'slider', placement: '', min: '0', max: '1e3' },
        ],
        scope: { sheets: 'named', sheetNames: ['Overview'], visuals: 'all', visualNames: [] },
        editMode: '',
      })
    ).toEqual({
      understanding: 'Adding a Region filter to Sales review.',
      change: 'filter',
      asset: { kind: 'analysis', name: 'Sales review' },
      title: 'Region filter',
      filters: [{ column: 'region' }, { column: 'amount', control: 'slider', min: 0, max: 1000 }],
      scope: { sheets: ['Overview'], visuals: 'all' },
    });
    expect(
      parseUnderstanding({
        understanding: 'Adding a filter to Sales review.',
        change: 'filter',
        asset: { kind: 'analysis', name: 'Sales review', id: '' },
        brief: 'A filter.',
        filters: [],
        scope: { sheets: '', sheetNames: [], visuals: '', visualNames: [] },
      })
    ).toMatchObject({ change: 'visual', brief: 'A filter.' });
  });

  it('is "other" when the change is not visual or names no asset, and nothing without the sentence', () => {
    expect(
      parseUnderstanding({
        understanding: 'Looking for the margin field.',
        change: 'other',
        asset: { kind: '', name: '', id: '' },
        filters: [],
      })
    ).toEqual({ understanding: 'Looking for the margin field.', change: 'other', filters: [] });
    expect(
      parseUnderstanding({
        understanding: 'Adding a table.',
        change: 'visual',
        asset: { kind: 'analysis', name: '', id: '' },
        brief: 'A table.',
        filters: [],
      })?.change
    ).toBe('other');
    expect(parseUnderstanding({ change: 'visual' })).toBeUndefined();
  });
});

describe('understandWith', () => {
  it('asks the chat model once, with little thinking and only the understand tool', async () => {
    const seen: Array<{ tools: string[]; options?: ChatTurnOptions; context?: string }> = [];
    const chat: ChatModel = {
      async turn(system, _turns, tools, options) {
        seen.push({ tools: tools.map((t) => t.name), options, context: system.context });
        return {
          text: '',
          toolCalls: [
            {
              id: 'u',
              name: 'understand',
              input: {
                understanding: 'Adding a table to Sales review.',
                change: 'visual',
                asset: { kind: 'analysis', name: 'Sales review', id: 'a1' },
                title: 'Table',
                brief: 'A table of results.',
                filters: [],
              },
            },
          ],
          raw: undefined,
          usage: { inputTokens: 500, outputTokens: 60 },
        };
      },
    };
    const understood = await understandWith(chat)(
      [{ role: 'user', text: 'add a table to Sales review' }],
      'Plans you drew earlier: none.'
    );
    expect(seen).toEqual([
      {
        tools: ['understand'],
        options: { effort: 'low' },
        context: 'Plans you drew earlier: none.',
      },
    ]);
    expect(understood).toEqual({
      understanding: {
        understanding: 'Adding a table to Sales review.',
        change: 'visual',
        asset: { kind: 'analysis', name: 'Sales review', id: 'a1' },
        title: 'Table',
        brief: 'A table of results.',
        filters: [],
      },
      usage: { inputTokens: 500, outputTokens: 60 },
    });
  });

  it('is nothing when the model answers in prose instead', async () => {
    const chat: ChatModel = {
      async turn() {
        return {
          text: 'Sure.',
          toolCalls: [],
          raw: undefined,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    expect(await understandWith(chat)([{ role: 'user', text: 'hi' }], '')).toBeUndefined();
  });

  it('tells the model to answer through the tool and never to ask', () => {
    const system = understandSystem([{ phrases: ['detailed table'], means: 'a Table visual' }]);
    expect(system).toContain(`calling the ${UNDERSTAND_TOOL.name} tool`);
    expect(system).toContain('a question is never asked here');
    expect(system).toContain('detailed table');
  });
});
