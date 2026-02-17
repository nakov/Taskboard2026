import headerTemplate from './header.html?raw';

export const renderHeader = (path, session) => {
  const isHome = path === '/';
  const isDashboard = path === '/dashboard';
  const isLogin = path === '/login';
  const isRegister = path === '/register';

  const dashboardLink = session
    ? `
        <li class="nav-item">
          <a class="nav-link ${isDashboard ? 'active fw-semibold' : ''}" href="/dashboard" data-link>Dashboard</a>
        </li>
      `
    : '';

  const authLinks = session
    ? `
        <li class="nav-item">
          <button class="btn btn-outline-secondary btn-sm ms-lg-2" type="button" data-logout>Logout</button>
        </li>
      `
    : `
        <li class="nav-item">
          <a class="nav-link ${isLogin ? 'active fw-semibold' : ''}" href="/login" data-link>Login</a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${isRegister ? 'active fw-semibold' : ''}" href="/register" data-link>Register</a>
        </li>
      `;

  return headerTemplate
    .replace('{{homeActive}}', isHome ? 'active fw-semibold' : '')
    .replace('{{dashboardLink}}', dashboardLink.trim())
    .replace('{{authLinks}}', authLinks.trim());
};
