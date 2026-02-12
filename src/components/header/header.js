import headerTemplate from './header.html?raw';

export const renderHeader = (path) => {
  const isHome = path === '/';
  const isDashboard = path === '/dashboard';

  return headerTemplate
    .replace('{{homeActive}}', isHome ? 'active fw-semibold' : '')
    .replace('{{dashboardActive}}', isDashboard ? 'active fw-semibold' : '');
};
