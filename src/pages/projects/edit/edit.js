import editTemplate from './edit.html?raw';
import editStyles from './edit.css?raw';
import { supabase } from '../../../lib/supabaseClient';

const redirectTo = (path, { replace = false } = {}) => {
	if (replace) {
		window.history.replaceState({}, '', path);
	} else {
		window.history.pushState({}, '', path);
	}

	window.dispatchEvent(new PopStateEvent('popstate'));
};

const getQueryParam = (param) => {
	const params = new URLSearchParams(window.location.search);
	return params.get(param);
};

export const renderEditProjectPage = () => {
	return `<style>${editStyles}</style>${editTemplate}`;
};

export const initEditProjectPage = async () => {
	const { data } = await supabase.auth.getSession();
	if (!data?.session) {
		redirectTo('/login', { replace: true });
		return;
	}

	const projectId = getQueryParam('id');
	if (!projectId) {
		showErrorMessage('Project ID not provided');
		return;
	}

	await loadProject(projectId, data.session.user.id);
};

async function loadProject(projectId, userId) {
	try {
		const { data: project, error } = await supabase
			.from('projects')
			.select('id, title, description, owner_id')
			.eq('id', projectId)
			.single();

		if (error) throw error;

		if (!project) {
			showErrorMessage('Project not found');
			return;
		}

		// Check if user is the owner
		if (project.owner_id !== userId) {
			showErrorMessage('You do not have permission to edit this project');
			return;
		}

		// Show form and populate fields
		showForm(project, userId);
	} catch (error) {
		console.error('Error loading project:', error);
		showErrorMessage('Failed to load project');
	}
}

function showErrorMessage(message) {
	const loadingDiv = document.querySelector('#edit-loading');
	const formContent = document.querySelector('#edit-form-content');
	const errorDiv = document.querySelector('#edit-error-message');

	if (loadingDiv) loadingDiv.classList.add('d-none');
	if (formContent) formContent.classList.add('d-none');
	if (errorDiv) {
		errorDiv.textContent = message;
		errorDiv.classList.remove('d-none');
	}
}

function showForm(project, userId) {
	const loadingDiv = document.querySelector('#edit-loading');
	const formContent = document.querySelector('#edit-form-content');
	const titleInput = document.querySelector('#project-title');
	const descriptionInput = document.querySelector('#project-description');

	if (loadingDiv) loadingDiv.classList.add('d-none');
	if (formContent) formContent.classList.remove('d-none');

	if (titleInput) titleInput.value = project.title;
	if (descriptionInput) descriptionInput.value = project.description || '';

	const form = document.querySelector('#edit-project-form');
	const errorAlert = document.querySelector('#edit-project-error');
	const successAlert = document.querySelector('#edit-project-success');
	const submitBtn = document.querySelector('#edit-submit-btn');

	if (!form) return;

	const setAlert = (element, message, isDanger = true) => {
		if (!message) {
			element.textContent = '';
			element.classList.add('d-none');
			return;
		}

		element.textContent = message;
		element.classList.remove('d-none');
		if (isDanger) {
			element.classList.remove('alert-success');
			element.classList.add('alert-danger');
		} else {
			element.classList.remove('alert-danger');
			element.classList.add('alert-success');
		}
	};

	form.addEventListener('submit', async (event) => {
		event.preventDefault();

		setAlert(errorAlert, '');
		setAlert(successAlert, '');

		const title = titleInput?.value.trim() || '';
		const description = descriptionInput?.value.trim() || '';

		// Validation
		if (!title) {
			setAlert(errorAlert, 'Project title is required');
			titleInput?.focus();
			return;
		}

		if (title.length > 255) {
			setAlert(errorAlert, 'Project title must be 255 characters or less');
			return;
		}

		// Disable submit button
		if (submitBtn) {
			submitBtn.disabled = true;
			submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';
		}

		try {
			const { error } = await supabase
				.from('projects')
				.update({
					title,
					description: description || null
				})
				.eq('id', project.id);

			if (error) throw error;

			setAlert(successAlert, 'Project updated successfully!', false);

			// Redirect after a brief delay
			setTimeout(() => {
				redirectTo('/projects');
			}, 800);
		} catch (error) {
			console.error('Error updating project:', error);
			setAlert(errorAlert, error.message || 'Failed to update project');

			// Re-enable submit button
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> Update Project';
			}
		}
	});
}
