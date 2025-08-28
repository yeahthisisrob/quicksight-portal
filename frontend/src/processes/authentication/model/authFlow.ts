// Authentication flow state machine
export type AuthFlowState = 
  | 'idle'
  | 'initiating'
  | 'redirecting'
  | 'processing_callback'
  | 'validating_token'
  | 'fetching_user'
  | 'complete'
  | 'error';

export interface AuthFlowContext {
  state: AuthFlowState;
  error?: string;
  redirectUrl?: string;
  token?: string;
  user?: any;
}

export const initialAuthFlowContext: AuthFlowContext = {
  state: 'idle'
};