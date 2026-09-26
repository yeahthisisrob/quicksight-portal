/**
 * What the assistant can do, as tools. Three groups:
 * - context: search the portal's knowledge, get an entity, follow its
 *   relationships (the same shape as AWS Context);
 * - the API: read and preview through any route, and describe one;
 * - showing and preparing: draw the plan, show an asset or a lineage,
 *   prepare a write for the person to run.
 */
import type { ChatTool } from './ChatModel';

const ENTITY_TYPES = [
  'project',
  'listing',
  'listing-column',
  'glossary-term',
  'datasource',
  'dataset',
  'calculated-field',
  'analysis',
  'dashboard',
  'visual',
  'template',
  'folder',
];

const RELATIONS = [
  'in-project',
  'has-column',
  'tagged',
  'reads-listing',
  'through-datasource',
  'exposes',
  'uses-dataset',
  'defined-in',
  'reads-column',
  'in-asset',
  'in-folder',
];

export const ASSISTANT_TOOLS: ChatTool[] = [
  {
    name: 'context_search',
    description:
      'Search everything the portal knows, ranked, in plain words: SMUS projects, listings and their columns (with types, descriptions and glossary terms), datasets, data sources, calculated fields (matched on the expression too), analyses, dashboards, visuals and templates. Returns entity ids to get or follow. Start here.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Plain words: a table, a column, a business term, a dashboard name.',
        },
        types: { type: 'array', items: { type: 'string', enum: ENTITY_TYPES } },
        projectId: {
          type: 'string',
          description: 'Keep to one SMUS project (ids are in the brief).',
        },
        limit: { type: 'integer' },
      },
      required: ['query'],
    },
  },
  {
    name: 'context_get',
    description:
      'One entity by id: what it is, its facts (column types, import mode, expression, project), and every kind of relationship it has, with a few examples of each.',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'e.g. listing:abc, dataset:123, listing-column:abc/customer_id',
        },
      },
      required: ['entityId'],
    },
  },
  {
    name: 'context_related',
    description:
      "Follow an entity's relationships, up to three hops. Relations read subject -> object: listing in-project project; listing has-column listing-column; listing tagged glossary-term; dataset reads-listing listing; dataset through-datasource datasource; dataset exposes listing-column; analysis|dashboard uses-dataset dataset; calculated-field defined-in asset; calculated-field reads-column listing-column; visual in-asset asset; asset in-folder folder. Use direction 'in' to go the other way (the datasets that read a listing: listing, relations reads-listing, direction in).",
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        relations: { type: 'array', items: { type: 'string', enum: RELATIONS } },
        direction: { type: 'string', enum: ['out', 'in', 'both'] },
        depth: { type: 'integer', minimum: 1, maximum: 3 },
        types: { type: 'array', items: { type: 'string', enum: ENTITY_TYPES } },
        limit: { type: 'integer' },
      },
      required: ['entityId'],
    },
  },
  {
    name: 'list_templates',
    description:
      'The template library, with ids: calculated-field templates, layout standards (tagged dashboards) and filter bar templates. To add, change or remove a template, prepare the write (POST/PUT/DELETE /api/data-catalog/templates/...) with propose_action.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'call_portal_api',
    description:
      "Call the portal's API as the person you are helping. GETs and read-only POSTs (previews, plans, validations, the planner's propose) run and return the response. Anything that writes is refused here: prepare it with propose_action instead.",
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST'] },
        path: {
          type: 'string',
          description:
            'A real path with its ids filled in and any query string, e.g. /api/authoring/datasets/abc/columns',
        },
        body: { type: 'object', description: 'JSON body for a POST.' },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'describe_operation',
    description:
      "An operation's parameters, request body and response shape. Use before a POST you have not made yet.",
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        path: { type: 'string', description: 'The template path exactly as the index lists it.' },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'show_plan',
    description:
      "Draw what a change will build as a lineage, before preparing it: where the data comes from (SMUS listings, when there are any) -> datasets (existing, or new and through which data source) -> the analysis or dashboard (new, edited, or a copy). List the calculated fields it adds too: each is judged against the organisation's guidance and the verdicts come back to you. The actions you prepare next are shown under the plan.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              listing: { type: 'string' },
              project: { type: 'string' },
              table: { type: 'string' },
            },
            required: ['listing'],
          },
        },
        datasets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              id: { type: 'string', description: 'Required for an existing dataset.' },
              status: { type: 'string', enum: ['existing', 'new'] },
              dataSource: {
                type: 'string',
                description: 'For a new dataset: the data source it reads through.',
              },
            },
            required: ['name', 'status'],
          },
        },
        calculatedFields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              expression: { type: 'string' },
              status: { type: 'string', enum: ['existing', 'new'] },
              dataset: {
                type: 'string',
                description:
                  'The id of the existing dataset it is computed on, so its columns can be checked.',
              },
            },
            required: ['name', 'status'],
          },
        },
        asset: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['dashboard', 'analysis'] },
            name: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string', enum: ['new', 'edited', 'existing'] },
          },
          required: ['kind', 'name', 'status'],
        },
      },
      required: ['title', 'datasets', 'asset'],
    },
  },
  {
    name: 'show_to_person',
    description:
      "Put something in front of the person, drawn: an existing dashboard or analysis as a wireframe, or a calculated field's lineage. Previews you run are shown automatically; use this for the current state or for lineage.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['asset', 'lineage'] },
        title: { type: 'string' },
        assetType: { type: 'string', enum: ['dashboard', 'analysis'] },
        assetId: { type: 'string' },
        fieldKey: {
          type: 'string',
          description: 'A calculated field key (the part after calculated-field:).',
        },
      },
      required: ['kind', 'title'],
    },
  },
  {
    name: 'propose_action',
    description:
      "Prepare a write (apply, create, grant, tag, delete) for the person to run. The body is checked against the operation's schema (use describe_operation first), and a write with a /preview twin is previewed with the same body; either failing comes back to you to fix. It is not run until they click it.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, e.g. "Publish the gold copy".' },
        why: { type: 'string', description: 'One sentence on what it does and what it changes.' },
        method: { type: 'string', enum: ['POST', 'PUT', 'DELETE'] },
        path: { type: 'string' },
        body: { type: 'object' },
        adminsOnly: {
          type: 'boolean',
          description:
            'Only for creating an asset with no permissionsFrom, template or folderId: true when the person said only admins should see it.',
        },
        personAskedForNew: {
          type: 'boolean',
          description:
            'Only for creating a dataset over a listing that already has linked datasets: true when the person explicitly asked for a new one.',
        },
      },
      required: ['title', 'why', 'method', 'path'],
    },
  },
];
