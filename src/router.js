import { renderHeader } from './components/header/header';
import { renderFooter } from './components/footer/footer';
import { renderIndexPage } from './pages/index/index';
import { renderDashboardPage, initDashboardPage } from './pages/dashboard/dashboard';
import { renderLoginPage, initLoginPage } from './pages/login/login';
import { renderRegisterPage, initRegisterPage } from './pages/register/register';
import { renderNotFoundPage } from './pages/notfound/notfound';
import { supabase } from './lib/supabaseClient';

const routes = {
  '/': {
    title: 'Taskboard | Home',
    render: renderIndexPage
  },
  '/dashboard': {
    title: 'Taskboard | Dashboard',
    render: renderDashboardPage,
    init: initDashboardPage,
    requiresAuth: true
  },
  '/login': {
    title: 'Taskboard | Login',
    render: renderLoginPage,
    init: initLoginPage,
    requiresGuest: true
  },
  '/register': {
    title: 'Taskboard | Register',
    render: renderRegisterPage,
    init: initRegisterPage,
    requiresGuest: true
  }
};

const resolvePath = (path) => {
  if (path === '') {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
};

const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.warn('Unable to read auth session.', error);
  }

  return data?.session ?? null;
};

const navigateTo = async (appElement, path, { replace = false } = {}) => {
  const normalizedPath = resolvePath(path);

  if (replace) {
    window.history.replaceState({}, '', normalizedPath);
  } else {
    window.history.pushState({}, '', normalizedPath);
  }

  await renderLayout(appElement, normalizedPath);
};

const renderLayout = async (appElement, path) => {
  const route = routes[path];
  const session = await getSession();

  // Handle 404 - unknown route
  if (!route) {
    document.title = 'Taskboard | 404 Not Found';
    appElement.innerHTML = `
      ${renderHeader(path, session)}
      <main class="container py-4" id="route-content">
        ${renderNotFoundPage()}
      </main>
      ${renderFooter()}
    `;
    return;
  }

  if (route.requiresAuth && !session) {
    await navigateTo(appElement, '/login', { replace: true });
    return;
  }

  if (route.requiresGuest && session) {
    await navigateTo(appElement, '/dashboard', { replace: true });
    return;
  }

  document.title = route.title;

  appElement.innerHTML = `
    ${renderHeader(path, session)}
    <main class="container py-4" id="route-content">
      ${route.render()}
    </main>
    ${renderFooter()}
  `;

  if (route.init) {
    await route.init(session);
  }
};

const handleLinkNavigation = async (event, appElement) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const logoutButton = target.closest('[data-logout]');

  if (logoutButton) {
    event.preventDefault();
    await supabase.auth.signOut();
    await navigateTo(appElement, '/', { replace: true });
    return;
  }

  const link = target.closest('[data-link]');

  if (!link) {
    return;
  }

  event.preventDefault();
  const nextPath = link.getAttribute('href') ?? '/';
  await navigateTo(appElement, nextPath);
};

export const initRouter = (appElement) => {
  void renderLayout(appElement, resolvePath(window.location.pathname));

  window.addEventListener('popstate', () => {
    void renderLayout(appElement, resolvePath(window.location.pathname));
  });

  document.addEventListener('click', (event) => {
    void handleLinkNavigation(event, appElement);
  });
};
