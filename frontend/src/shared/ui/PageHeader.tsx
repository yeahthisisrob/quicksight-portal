/**
 * The page header now lives in the design system; this re-export keeps the
 * existing `@/shared/ui` import path working. Prefer
 * `@/shared/design-system` in new code.
 */
export {
  PageHeader,
  PageHeader as default,
  type PageHeaderProps,
} from '@/shared/design-system/components/PageHeader';
