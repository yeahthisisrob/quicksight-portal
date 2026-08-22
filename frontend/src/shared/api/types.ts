// Shared API types
// Domain types (Tag, Permission, asset shapes) come from the generated
// OpenAPI schema in @shared/generated - do not re-declare them here.
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
