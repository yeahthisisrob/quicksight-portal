/** Every playbook the portal offers. A new one is a file here and a line below. */
import type { Playbook } from '../types';
import { consolidateAthena } from './consolidateAthena';
import { demoCleanup } from './demoCleanup';
import { repairErrors } from './repairErrors';

const PLAYBOOKS: Playbook[] = [repairErrors, consolidateAthena, demoCleanup];

export function listPlaybooks(): Playbook[] {
  return PLAYBOOKS;
}

export function findPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}
