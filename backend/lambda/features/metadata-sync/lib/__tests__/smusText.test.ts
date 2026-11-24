import { describe, expect, it } from 'vitest';

import type { CatalogAsset } from '../../../../adapters/aws/DataZoneAdapter';
import { TABLE_KEY } from '../../types';
import { COLUMN_FORM, COLUMN_FORM_TYPE, smusRevision, smusShown } from '../smusText';

const columns = (entries: unknown[]) => JSON.stringify({ columnsBusinessMetadata: entries });

const asset: CatalogAsset = {
  assetId: 'asset-1',
  name: 'orders',
  description: 'Every order.',
  glossaryTerms: ['term-1'],
  listingId: 'listing-1',
  forms: [
    {
      formName: 'GlueTableForm',
      typeName: 'amazon.datazone.GlueTableFormType',
      typeRevision: '3',
      content: '{"tableName":"orders"}',
    },
    {
      formName: COLUMN_FORM,
      typeName: COLUMN_FORM_TYPE,
      typeRevision: '2',
      content: columns([
        { columnIdentifier: 'order_id', name: 'Order number', description: 'The order.' },
        { columnIdentifier: 'internal', description: 'Not ours to touch.', custom: 1 },
      ]),
    },
  ],
};

describe('smusShown', () => {
  it('reads each column entry and the asset description; a name equal to the table is not a business name', () => {
    expect(smusShown(asset, 'orders')).toEqual({
      order_id: { description: 'The order.', businessName: 'Order number' },
      internal: { description: 'Not ours to touch.' },
      [TABLE_KEY]: { description: 'Every order.' },
    });
    expect(smusShown({ ...asset, name: 'Orders' }, 'orders')[TABLE_KEY]).toEqual({
      description: 'Every order.',
      businessName: 'Orders',
    });
  });

  it('shows nothing for a form that is not JSON', () => {
    const broken = { ...asset, forms: [{ formName: COLUMN_FORM, content: 'not json' }] };
    expect(smusShown(broken, 'orders')).toEqual({ [TABLE_KEY]: { description: 'Every order.' } });
  });
});

describe('smusRevision', () => {
  it('sends every other form back as read and replaces only the column form, keeping untouched entries', () => {
    const revision = smusRevision(asset, [
      { key: 'order_id', field: 'description', value: 'The order, once.' },
      { key: 'placed_at', field: 'description', value: 'When it was placed.' },
      { key: TABLE_KEY, field: 'businessName', value: 'Orders' },
    ]);
    expect(revision.name).toBe('Orders');
    expect(revision.description).toBe('Every order.');
    expect(revision.glossaryTerms).toEqual(['term-1']);
    expect(revision.forms[0]).toEqual({
      formName: 'GlueTableForm',
      typeIdentifier: 'amazon.datazone.GlueTableFormType',
      typeRevision: '3',
      content: '{"tableName":"orders"}',
    });
    const form = revision.forms[1];
    expect(form).toMatchObject({
      formName: COLUMN_FORM,
      typeIdentifier: COLUMN_FORM_TYPE,
      typeRevision: '2',
    });
    expect(JSON.parse(form?.content ?? '{}').columnsBusinessMetadata).toEqual([
      { columnIdentifier: 'order_id', name: 'Order number', description: 'The order, once.' },
      { columnIdentifier: 'internal', description: 'Not ours to touch.', custom: 1 },
      { columnIdentifier: 'placed_at', description: 'When it was placed.' },
    ]);
  });

  it('adds the column form to an asset that has none', () => {
    const bare = { ...asset, forms: [], glossaryTerms: [] };
    const revision = smusRevision(bare, [{ key: 'order_id', field: 'description', value: 'New.' }]);
    expect(revision.forms).toHaveLength(1);
    expect(revision.forms[0]?.typeIdentifier).toBe(COLUMN_FORM_TYPE);
    expect(revision).not.toHaveProperty('glossaryTerms');
  });
});
