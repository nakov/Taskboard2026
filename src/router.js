import { renderHeader } from './components/header/header';
import { renderFooter } from './components/footer/footer';
import { renderIndexPage } from './pages/index/index';
import { renderDashboardPage } from './pages/dashboard/dashboard';

const routes = {
  '/': {
    title: 'Taskboard | Home',
    render: renderIndexPage
  },
  '/dashboard': {
    title: 'Taskboard | Dashboard',
    render: renderDashboardPage
  }
};

const resolvePath = (path) => {
  if (path === '') {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
};

const renderLayout = (appElement, path) => {
  const route = routes[path] ?? routes['/'];
  document.title = route.title;

  appElement.innerHTML = `
    ${renderHeader(path)}
    <main class="container py-4" id="route-content">
      ${route.render()}
    </main>
    ${renderFooter()}
  `;
};

const handleLinkNavigation = (event, appElement) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const link = target.closest('[data-link]');

  if (!link) {
    return;
  }

  event.preventDefault();
  const nextPath = link.getAttribute('href') ?? '/';
  const normalizedPath = resolvePath(nextPath);

  window.history.pushState({}, '', normalizedPath);
  renderLayout(appElement, normalizedPath);
};

export const initRouter = (appElement) => {
  renderLayout(appElement, resolvePath(window.location.pathname));

  window.addEventListener('popstate', () => {
    renderLayout(appElement, resolvePath(window.location.pathname));
  });

  document.addEventListener('click', (event) => {
    handleLinkNavigation(event, appElement);
  });
};
