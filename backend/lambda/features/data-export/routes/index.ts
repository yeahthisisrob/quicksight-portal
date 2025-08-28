import { type RouteHandler } from '../../../api/types';
import { ExportHandler } from '../handlers/ExportHandler';

const handler = new ExportHandler();

export const dataExportRoutes: RouteHandler[] = [
  // Export endpoints matching OpenAPI spec
  {
    method: 'POST',
    path: '/export',
    handler: (event) => handler.exportAssets(event),
  },
  {
    method: 'GET',
    path: '/export/summary',
    handler: (event) => handler.getExportSummary(event),
  },
];
