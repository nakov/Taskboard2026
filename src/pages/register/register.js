import registerTemplate from './register.html?raw';
import { supabase } from '../../lib/supabaseClient';

const redirectTo = (path, { replace = false } = {}) => {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderRegisterPage = () => registerTemplate;

export const initRegisterPage = async () => {
  const form = document.querySelector('#register-form');
  const nameInput = document.querySelector('#register-name');
  const emailInput = document.querySelector('#register-email');
  const passwordInput = document.querySelector('#register-password');
  const confirmInput = document.querySelector('#register-confirm');
  const errorAlert = document.querySelector('#register-error');
  const successAlert = document.querySelector('#register-success');
  const submitButton = document.querySelector('#register-submit');

  if (!form || !nameInput || !emailInput || !passwordInput || !confirmInput || !errorAlert || !successAlert || !submitButton) {
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

    const fullName = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (!fullName || !email || !password || !confirmPassword) {
      setAlert(errorAlert, 'All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setAlert(errorAlert, 'Passwords do not match.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Creating account...';

    const { data: signupData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    submitButton.disabled = false;
    submitButton.textContent = 'Create account';

    if (error) {
      setAlert(errorAlert, error.message);
      return;
    }

    if (signupData?.session) {
      setAlert(successAlert, 'Account created. Redirecting to your dashboard...');
      redirectTo('/dashboard');
      return;
    }

    setAlert(successAlert, 'Account created. Check your email to confirm the account.');
    form.reset();
  });
};
