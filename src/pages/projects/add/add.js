import addTemplate from './add.html?raw';
import addStyles from './add.css?raw';
import { supabase } from '../../../lib/supabaseClient';
import { createProjectMembersManager } from '../projectMembers';

const redirectTo = (path, { replace = false } = {}) => {
	if (replace) {
		window.history.replaceState({}, '', path);
	} else {
		window.history.pushState({}, '', path);
	}

	window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderAddProjectPage = () => {
	return `<style>${addStyles}</style>${addTemplate}`;
};

export const initAddProjectPage = async () => {
	const { data } = await supabase.auth.getSession();
	if (!data?.session) {
		redirectTo('/login', { replace: true });
		return;
	}

	setupForm(data.session.user.id);
};

function setupForm(currentUserId) {
	const form = document.querySelector('#add-project-form');
	const titleInput = document.querySelector('#project-title');
	const descriptionInput = document.querySelector('#project-description');
	const errorAlert = document.querySelector('#add-project-error');
	const successAlert = document.querySelector('#add-project-success');
	const submitBtn = document.querySelector('#add-submit-btn');
	const membersManager = createProjectMembersManager({
		rootSelector: '#project-members-section',
		currentUserId
	});

	if (!form) return;

	// Focus on title input
	if (titleInput) {
		titleInput.focus();
	}

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
			submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
		}

		try {
			// Get the current user
			const { data: { user } } = await supabase.auth.getUser();
			
			if (!user) {
				throw new Error('User not authenticated');
			}

			const projectId = crypto.randomUUID();

			const { error } = await supabase
				.from('projects')
				.insert([
					{
						id: projectId,
						title,
						description: description || null,
						owner_id: user.id
					}
				]);

			if (error) throw error;

			const memberIds = membersManager?.getSelectedUserIds() || [];

			if (memberIds.length > 0) {
				const { error: membersError } = await supabase
					.from('project_members')
					.insert(memberIds.map((memberId) => ({
						project_id: projectId,
						user_id: memberId
					})));

				if (membersError) throw membersError;
			}

			setAlert(successAlert, 'Project created successfully!', false);
			
			// Redirect after a brief delay
			setTimeout(() => {
				redirectTo('/projects');
			}, 800);
		} catch (error) {
			console.error('Error creating project:', error);
			setAlert(errorAlert, error.message || 'Failed to create project');
			
			// Re-enable submit button
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> Create Project';
			}
		}
	});
}
