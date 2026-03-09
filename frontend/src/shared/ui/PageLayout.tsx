import { Box } from '@mui/material';

import { PageHeader } from './PageHeader';

interface PageLayoutProps {
  title: string;
  totalRows?: number;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard page layout used by all pages.
 * Renders a PageHeader followed by page content.
 */
export function PageLayout({ title, totalRows, extraActions, children }: PageLayoutProps) {
  return (
    <Box>
      <PageHeader title={title} totalRows={totalRows} extraActions={extraActions} />
      {children}
    </Box>
  );
}

export default PageLayout;
