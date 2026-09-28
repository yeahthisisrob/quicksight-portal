/**
 * Themes the portal makes: from a draft someone checked (create), or from a
 * picture of a brand's colors or a layout (propose, through a model that
 * reads images; the answer is checked like any draft and nothing is written
 * until someone creates it).
 */
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../../../shared/auth';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { keepCatalogFresh } from '../../../shared/services/catalog/assetFreshness';
import { quickSightUserFor } from '../../../shared/services/identity/IdentityResolver';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import {
  normaliseThemeDraft,
  THEME_DRAFT_SCHEMA,
  type ThemeDraft,
  themeConfiguration,
  UI_COLOR_ROLES,
} from '../lib/themeDraft';
import type { PlannerModel } from './planner/PlannerModel';

/** What the creator of a theme can do with it. */
const THEME_OWNER_ACTIONS = [
  'quicksight:DescribeTheme',
  'quicksight:DescribeThemeAlias',
  'quicksight:ListThemeAliases',
  'quicksight:ListThemeVersions',
  'quicksight:UpdateTheme',
  'quicksight:CreateThemeAlias',
  'quicksight:UpdateThemeAlias',
  'quicksight:DeleteThemeAlias',
  'quicksight:DeleteTheme',
  'quicksight:UpdateThemePermissions',
  'quicksight:DescribeThemePermissions',
];

const ID_SUFFIX = 6;
const SLUG_MAX = 40;
const PROPOSAL_TOKENS = 1500;

const SYSTEM = [
  'You design Amazon QuickSight themes from a picture: a brand palette, a logo, a style guide or a screenshot of a layout.',
  'Take the colors the picture actually uses. Data colors come first by prominence and must be told apart side by side in a chart; add harmonious ones only to reach at least six.',
  'Interface colors follow the picture: its background, its text, its accent. Keep text readable on its background.',
  'Choose MIDNIGHT as the base when the picture is dark, CLASSIC otherwise.',
].join(' ');

export interface ThemeImage {
  format: 'png' | 'jpeg' | 'gif' | 'webp';
  bytes: Uint8Array;
}

export class ThemeService {
  private readonly quickSightService: QuickSightService;

  public constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  /** A draft from a picture, checked. Writes nothing. */
  public async propose(
    model: PlannerModel,
    image: ThemeImage,
    note?: string
  ): Promise<{ draft: ThemeDraft; rationale?: string; model: string }> {
    const result = await model.complete({
      label: 'theme-from-image',
      system: SYSTEM,
      user: note?.trim()
        ? `Make a theme from this picture. Also: ${note.trim()}`
        : 'Make a theme from this picture.',
      images: [image],
      schemaName: 'theme_draft',
      schemaDescription: 'A QuickSight theme drawn from the picture',
      schema: THEME_DRAFT_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: PROPOSAL_TOKENS,
    });
    const output = (result.output ?? {}) as Record<string, unknown>;
    // A role the model invented is dropped rather than failing the whole proposal.
    const uiColors = Object.fromEntries(
      Object.entries((output.uiColors ?? {}) as Record<string, unknown>).filter(([role]) =>
        (UI_COLOR_ROLES as readonly string[]).includes(role)
      )
    );
    const draft = normaliseThemeDraft({ ...output, uiColors });
    return {
      draft,
      ...(typeof output.rationale === 'string' ? { rationale: output.rationale } : {}),
      model: result.model,
    };
  }

  /** Create the theme in QuickSight, owned by whoever asked. */
  public async create(
    raw: unknown,
    auth?: AuthContext
  ): Promise<{ themeId: string; arn: string; warnings: string[] }> {
    const draft = normaliseThemeDraft(raw);
    const slug = draft.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, SLUG_MAX);
    const themeId = `${slug || 'theme'}-${randomUUID().slice(0, ID_SUFFIX)}`;
    const owner = await quickSightUserFor(auth?.email);
    const warnings = owner
      ? []
      : [
          'No QuickSight user matched your sign-in, so the theme has no owner yet; share it from Permissions.',
        ];
    const created = await this.quickSightService.createTheme({
      themeId,
      name: draft.name,
      baseThemeId: draft.baseThemeId,
      configuration: themeConfiguration(draft),
      ...(owner ? { permissions: [{ Principal: owner.arn, Actions: THEME_OWNER_ACTIONS }] } : {}),
    });
    logger.info('Created a theme', { themeId, name: draft.name, owner: owner?.userName });
    await keepCatalogFresh([{ assetType: ASSET_TYPES.theme, assetId: themeId, name: draft.name }]);
    return { themeId, arn: created.arn, warnings };
  }
}
