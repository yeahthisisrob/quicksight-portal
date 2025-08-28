/**
 * Lazy-loaded page components
 * All pages are code-split for optimal performance
 */
import { lazy } from 'react';

// Authentication pages (no layout)
export const LoginPage = lazy(() => import('./LoginPage').then(m => ({ default: m.LoginPage })));
export const AuthCallbackPage = lazy(() => import('./AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })));

// Main application pages (with layout)
export const AssetsPage = lazy(() => import('./AssetsPage'));
export const DataCatalogPage = lazy(() => import('./DataCatalogPage'));
export const ExportPage = lazy(() => import('./ExportPage'));
export const ArchivedAssetsPage = lazy(() => import('./ArchivedAssetsPage').then(m => ({ default: m.ArchivedAssetsPage })));
export const ScriptsPage = lazy(() => import('./ScriptsPage').then(m => ({ default: m.ScriptsPage })));
export const IngestionsPage = lazy(() => import('./IngestionsPage'));