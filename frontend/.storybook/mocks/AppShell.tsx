import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import { MainLayout } from '../../src/widgets';
import { type MockRoute, mockApi } from './api';

interface AppShellProps {
  /** The route pattern the page is mounted at, e.g. 'author' or 'operations'. */
  path: string;
  /** API stubs installed before the page's first request. */
  routes?: MockRoute[];
  children: ReactNode;
}

/**
 * The whole page as a user sees it: the real top bar and sidebar around the
 * page, at its real route. Pair with `parameters.router.initialEntries` so the
 * location (and any ?query state) matches `path`.
 */
export function AppShell({ path, routes, children }: AppShellProps) {
  const [restore] = useState(() => (routes ? mockApi(routes) : () => {}));
  useEffect(() => restore, [restore]);
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route path={path} element={children} />
        <Route path="*" element={children} />
      </Route>
    </Routes>
  );
}
