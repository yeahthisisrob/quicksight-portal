/**
 * Stands in for `@/shared/lib/auth` (aliased in main.ts), so it must export
 * what the real module does: AuthProvider and useAuth.
 */
import { MockAuthProvider, useAuth } from './auth';

export { useAuth };
export const AuthProvider = MockAuthProvider;
