/**
 * Which model a person picked, per kind of work, kept in their browser.
 * The model pills in the assistant's composer write it; the Studio's planner
 * and the assistant chat read it, so one choice follows the person across
 * the page.
 */
import { useCallback, useEffect, useState } from 'react';

import type { AiModelKey } from '@/shared/api/modules/assistant';

type AiWork = 'authoring' | 'chat';

const DEFAULT_AI_MODEL: Record<AiWork, AiModelKey> = {
  authoring: 'sonnet-4-6',
  chat: 'haiku-4-5',
};

const KEYS = ['haiku-4-5', 'sonnet-4-6', 'sonnet-5', 'opus-5', 'openai'] as const;
const STORAGE_PREFIX = 'qsp.aiModel.';
const CHANGE_EVENT = 'qsp:ai-model-change';

function isKey(value: unknown): value is AiModelKey {
  return typeof value === 'string' && (KEYS as readonly string[]).includes(value);
}

export function readAiModel(work: AiWork): AiModelKey {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${work}`);
    return isKey(stored) ? stored : DEFAULT_AI_MODEL[work];
  } catch {
    return DEFAULT_AI_MODEL[work];
  }
}

function writeAiModel(work: AiWork, key: AiModelKey): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${work}`, key);
  } catch {
    // Private windows and blocked storage: the choice lasts this page view.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { work, key } }));
}

/** The person's choice for this kind of work, and a setter every reader hears. */
export function useAiModel(work: AiWork): [AiModelKey, (key: AiModelKey) => void] {
  const [key, setKey] = useState<AiModelKey>(() => readAiModel(work));
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ work: AiWork; key: AiModelKey }>).detail;
      if (detail?.work === work) {
        setKey(detail.key);
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [work]);
  const set = useCallback((next: AiModelKey) => writeAiModel(work, next), [work]);
  return [key, set];
}
