import indexTemplate from './index.html?raw';
import { supabase } from '../../lib/supabaseClient';

export const renderIndexPage = () => indexTemplate;

export const initIndexPage = async () => {
	// Check authentication status
	const { data } = await supabase.auth.getSession();
	const isAuthenticated = !!data?.session;

	// Get button containers
	const guestButtons = document.querySelector('[data-guest-buttons]');
	const userButtons = document.querySelector('[data-user-buttons]');

	// Show/hide appropriate buttons
	if (isAuthenticated) {
		if (guestButtons) guestButtons.classList.add('d-none');
		if (userButtons) userButtons.classList.remove('d-none');
	} else {
		if (guestButtons) guestButtons.classList.remove('d-none');
		if (userButtons) userButtons.classList.add('d-none');
	}
};
