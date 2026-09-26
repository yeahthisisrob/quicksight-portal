import { Box } from '@mui/material';
import type { ReactNode } from 'react';

import { PageHeader } from '@/shared/design-system/components/PageHeader';

interface PageLayoutProps {
  title: string;
  description?: ReactNode;
  /** @deprecated Use `counter`. */
  totalRows?: number;
  counter?: number;
  /** @deprecated Use `actions`. */
  extraActions?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Standard page layout: a PageHeader followed by page content.
 */
function PageLayout({
  title,
  description,
  totalRows,
  counter,
  extraActions,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <Box>
      <PageHeader
        title={title}
        description={description}
        counter={counter ?? totalRows}
        actions={actions ?? extraActions}
      />
      {children}
    </Box>
  );
}

export default PageLayout;
