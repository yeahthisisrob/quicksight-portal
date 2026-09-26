/** The playbooks people compose, one item each beside the templates. */
import { TemplateStore } from '../../../shared/services/templates/TemplateStore';
import { CUSTOM_PREFIX } from './specPlaybook';
import type { PlaybookSpec, PlaybookSpecInput } from './types';

const PARTITION = 'PLAYBOOK_SPEC';

export class PlaybookSpecStore extends TemplateStore<PlaybookSpec, PlaybookSpecInput> {
  public constructor() {
    super(PARTITION, 'Playbook', undefined, undefined, CUSTOM_PREFIX);
  }
}
