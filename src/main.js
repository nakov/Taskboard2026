import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Expose Bootstrap to window for components that need it
window.bootstrap = bootstrap;

import './styles/app.css';
import './components/header/header.css';
import './components/footer/footer.css';
import './pages/index/index.css';
import './pages/dashboard/dashboard.css';
import './pages/login/login.css';
import './pages/register/register.css';
import './pages/admin/admin.css';

import { initRouter } from './router';

const appElement = document.querySelector('#app');

if (!appElement) {
  throw new Error('App root element not found.');
}

initRouter(appElement);
