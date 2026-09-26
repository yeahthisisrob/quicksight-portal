import type { Decorator } from '@storybook/react-vite';

import { MockedApi, type MockRoute } from '../../../../../.storybook/mocks/api';

/** What `GET /activity/{type}/{id}` answers in a story; `pending` never answers. */
export type ActivityResponse = { body: unknown; status?: number } | 'pending';

const activityRoute = (response: ActivityResponse): MockRoute => ({
  method: 'get',
  url: /^\/activity\//,
  respond: () =>
    response === 'pending'
      ? new Promise<never>(() => {})
      : { status: response.status, body: response.body },
});

/** Answers the activity request with `parameters.activityResponse`. */
export const withActivityResponse: Decorator = (Story, { parameters }) => (
  <MockedApi routes={[activityRoute(parameters.activityResponse)]}>
    <Story />
  </MockedApi>
);

export const activityOk = (data: unknown): ActivityResponse => ({
  body: { success: true, data },
});
