import { renderHeader } from './components/header/header';
import { renderFooter } from './components/footer/footer';
import { renderIndexPage } from './pages/index/index';
import { renderDashboardPage, initDashboardPage } from './pages/dashboard/dashboard';
import { renderLoginPage, initLoginPage } from './pages/login/login';
import { renderRegisterPage, initRegisterPage } from './pages/register/register';
import { renderProjectsPage, initProjectsPage } from './pages/projects/projects';
import { renderAddProjectPage, initAddProjectPage } from './pages/projects/add/add';
import { renderEditProjectPage, initEditProjectPage } from './pages/projects/edit/edit';
import { renderTaskboardPage, initTaskboardPage } from './pages/taskboard/taskboard';
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
  },
  '/projects': {
    title: 'Taskboard | Projects',
    render: renderProjectsPage,
    init: initProjectsPage,
    requiresAuth: true
  },
  '/projects/add': {
    title: 'Taskboard | Create Project',
    render: renderAddProjectPage,
    init: initAddProjectPage,
    requiresAuth: true
  }
};

const dynamicRoutes = [
  {
    pattern: '/projects/:id/edit',
    title: 'Taskboard | Edit Project',
    render: renderEditProjectPage,
    init: (session, params) => initEditProjectPage(session, params.id),
    requiresAuth: true
  },
  {
    pattern: '/projects/:id',
    title: 'Taskboard | Project',
    render: renderTaskboardPage,
    init: (session, params) => initTaskboardPage(params.id),
    requiresAuth: true
  }
];

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

const matchPattern = (pattern, path) => {
  const paramNames = [];
  const regexPattern = pattern.replace(/:([^/]+)/g, (_, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);

  if (!match) {
    return null;
  }

  const params = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });

  return params;
};

const matchDynamicRoute = (path) => {
  for (const route of dynamicRoutes) {
    const params = matchPattern(route.pattern, path);
    if (params) {
      return { route, params };
    }
  }

  return null;
};

const renderLayout = async (appElement, path) => {
  // Strip query string from path for route matching
  const pathWithoutQuery = path.split('?')[0];
  let route = routes[pathWithoutQuery];
  let params = {};
  const session = await getSession();

  // Try to match dynamic routes
  if (!route) {
    const dynamicMatch = matchDynamicRoute(pathWithoutQuery);
    if (dynamicMatch) {
      route = dynamicMatch.route;
      params = dynamicMatch.params;
    }
  }

  // Handle 404 - unknown route
  if (!route) {
    document.title = 'Taskboard | 404 Not Found';
    appElement.innerHTML = `
      ${renderHeader(pathWithoutQuery, session)}
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
    ${renderHeader(pathWithoutQuery, session)}
    <main class="container py-4" id="route-content">
      ${route.render()}
    </main>
    ${renderFooter()}
  `;

  if (route.init) {
    // For dynamic routes, pass the params object to the init function
    if (Object.keys(params).length > 0) {
      await route.init(session, params);
    } else {
      await route.init(session);
    }
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
  const currentPath = window.location.pathname + window.location.search;
  void renderLayout(appElement, resolvePath(currentPath));

  window.addEventListener('popstate', () => {
    const currentPath = window.location.pathname + window.location.search;
    void renderLayout(appElement, resolvePath(currentPath));
  });

  document.addEventListener('click', (event) => {
    void handleLinkNavigation(event, appElement);
  });
};
