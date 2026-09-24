export type { ApiTabProps } from './ui/ApiTab';

/** The tab is heavy (it carries the contract); pages load it lazily. */
export const loadApiTab = () => import('./ui/ApiTab');

export {
  type ApiOperation,
  curlFor,
  groupByArea,
  parseOperations,
  searchOperations,
} from './model/operations';
