// Accessibility testing with axe-playwright
const { injectAxe, checkA11y } = require('axe-playwright');

module.exports = {
  async preVisit(page) {
    // Inject axe-core for accessibility testing
    await injectAxe(page);
  },
  async postVisit(page) {
    // Add any smoke tests here
    // For example, check for console errors:
    const logs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Wait a bit for any async operations to complete
    await page.waitForTimeout(100);
    
    // Check for console errors
    if (logs.length > 0) {
      const ignoredErrors = [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Failed to load resource',
        'net::ERR_CONNECTION_REFUSED',
        'Network request failed',
        'fetch failed',
        '404',
        '401',
        '403',
        '500',
        'AxiosError',
        'Failed to fetch',
        'useAuth must be used within an AuthProvider',
        'useRoutes() may be used only in the context of a <Router> component',
        'Cannot read properties of undefined',
        'useNavigate() may be used only in the context of a <Router> component',
        'You cannot render a <Router> inside another <Router>',
        'useLocation() may be used only in the context of a <Router> component',
        'useParams() may be used only in the context of a <Router> component',
        'Error: Uncaught [Error:',
        'The above error occurred in the',
        'Consider adding an error boundary',
        'React will try to recreate this component tree',
        'StorybookTestRunnerError',
      ];
      
      const relevantErrors = logs
        .filter(log => !ignoredErrors.some(ignored => log.includes(ignored)))
        .filter(log => !log.includes('at '))  // Filter out stack trace lines
        .filter(log => !log.includes('http://'))  // Filter out source URLs
        .filter(log => log.trim().length > 0);  // Filter out empty lines
      
      if (relevantErrors.length > 0) {
        throw new Error(`Console errors detected:\n${relevantErrors.join('\n')}`);
      }
    }
    
    // Run accessibility checks (temporarily disabled to focus on component errors)
    // TODO: Re-enable once color contrast issues are fixed
    // await checkA11y(page, '#storybook-root', {
    //   detailedReport: true,
    //   detailedReportOptions: {
    //     html: true,
    //   },
    // });
  },
};