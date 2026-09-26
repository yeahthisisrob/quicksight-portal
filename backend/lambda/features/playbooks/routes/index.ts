import type { RouteHandler } from '../../../api/types';
import { PlaybooksHandler } from '../handlers/PlaybooksHandler';

const handler = new PlaybooksHandler();

export const playbookRoutes: RouteHandler[] = [
  { method: 'GET', path: '/playbooks', handler: (event) => handler.list(event) },
  { method: 'POST', path: '/playbooks/custom', handler: (event) => handler.createCustom(event) },
  {
    method: 'GET',
    // A saved playbook's spec, or a shipped one's, to edit or copy.
    path: /^\/playbooks\/custom\/([a-z0-9-]+)$/,
    handler: (event) => handler.getCustom(event),
  },
  {
    method: 'PUT',
    path: /^\/playbooks\/custom\/([a-z0-9-]+)$/,
    handler: (event) => handler.updateCustom(event),
  },
  {
    method: 'DELETE',
    path: /^\/playbooks\/custom\/([a-z0-9-]+)$/,
    handler: (event) => handler.deleteCustom(event),
  },
  { method: 'GET', path: '/playbooks/reports', handler: (event) => handler.listReports(event) },
  {
    method: 'GET',
    path: /^\/playbooks\/reports\/([^/]+)$/,
    handler: (event) => handler.getReport(event),
  },
  {
    method: 'GET',
    path: /^\/playbooks\/runs\/([^/]+)\/report$/,
    handler: (event) => handler.report(event),
  },
  {
    method: 'POST',
    path: /^\/playbooks\/runs\/([^/]+)\/report$/,
    handler: (event) => handler.saveReport(event),
  },
  {
    method: 'GET',
    path: /^\/playbooks\/runs\/([^/]+)\/items$/,
    handler: (event) => handler.items(event),
  },
  {
    method: 'POST',
    path: /^\/playbooks\/([a-z0-9-]+)\/preview$/,
    handler: (event) => handler.preview(event),
  },
  {
    method: 'POST',
    path: /^\/playbooks\/([a-z0-9-]+)\/run$/,
    handler: (event) => handler.run(event),
  },
];
