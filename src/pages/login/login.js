import loginTemplate from './login.html?raw';
import { supabase } from '../../lib/supabaseClient';

const redirectTo = (path, { replace = false } = {}) => {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderLoginPage = () => loginTemplate;

export const initLoginPage = async () => {
  const form = document.querySelector('#login-form');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const errorAlert = document.querySelector('#login-error');
  const successAlert = document.querySelector('#login-success');
  const submitButton = document.querySelector('#login-submit');

  if (!form || !emailInput || !passwordInput || !errorAlert || !successAlert || !submitButton) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    redirectTo('/dashboard', { replace: true });
    return;
  }

  const setAlert = (element, message) => {
    if (!message) {
      element.textContent = '';
      element.classList.add('d-none');
      return;
    }

    element.textContent = message;
    element.classList.remove('d-none');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    setAlert(errorAlert, '');
    setAlert(successAlert, '');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setAlert(errorAlert, 'Email and password are required.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitButton.disabled = false;
    submitButton.textContent = 'Login';

    if (error) {
      setAlert(errorAlert, error.message);
      return;
    }

    setAlert(successAlert, 'Login successful. Redirecting to your dashboard...');
    redirectTo('/dashboard');
  });
};
