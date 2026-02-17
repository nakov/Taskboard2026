import { supabase } from '../../lib/supabaseClient';

const escapeHtml = (text) => {
	const div = document.createElement('div');
	div.textContent = text || '';
	return div.innerHTML;
};

const formatUserLabel = (user) => {
	const name = user.full_name?.trim();
	if (!name) {
		return user.email;
	}

	return `${name} (${user.email})`;
};

export function createProjectMembersManager({
	rootSelector,
	currentUserId,
	excludedUserIds = [],
	initialSelectedUserIds = []
}) {
	const root = document.querySelector(rootSelector);
	if (!root) {
		return null;
	}

	const searchInput = root.querySelector('#project-member-search');
	const addButton = root.querySelector('#project-member-add-btn');
	const resultsContainer = root.querySelector('#project-member-results');
	const selectedContainer = root.querySelector('#project-members-selected');
	const emptyState = root.querySelector('#project-members-empty');
	const errorAlert = root.querySelector('#project-members-error');

	if (!searchInput || !addButton || !resultsContainer || !selectedContainer || !emptyState || !errorAlert) {
		return null;
	}

	const selectedUsers = new Map();
	let currentResults = [];
	let selectedCandidate = null;
	let searchTimeoutId = null;
	const blockedUserIds = new Set([currentUserId, ...excludedUserIds].filter(Boolean));

	const setError = (message) => {
		errorAlert.textContent = message || '';
		errorAlert.classList.toggle('d-none', !message);
	};

	const canAddCandidate = (candidate) => {
		if (!candidate?.id) return false;
		if (blockedUserIds.has(candidate.id)) return false;
		if (selectedUsers.has(candidate.id)) return false;
		return true;
	};

	const updateAddButtonState = () => {
		addButton.disabled = !canAddCandidate(selectedCandidate);
	};

	const resetCandidate = () => {
		selectedCandidate = null;
		updateAddButtonState();
	};

	const renderSelected = () => {
		const users = Array.from(selectedUsers.values());

		emptyState.classList.toggle('d-none', users.length > 0);
		selectedContainer.innerHTML = users.map((user) => `
			<div class="list-group-item d-flex justify-content-between align-items-center">
				<div>
					<div class="fw-semibold">${escapeHtml(user.full_name || user.email)}</div>
					<div class="small text-body-secondary">${escapeHtml(user.email)}</div>
				</div>
				<button
					type="button"
					class="btn btn-sm btn-outline-danger"
					data-remove-member-id="${user.id}"
				>
					<i class="bi bi-x-lg"></i>
				</button>
			</div>
		`).join('');
	};

	const renderResults = () => {
		if (!searchInput.value.trim()) {
			resultsContainer.classList.add('d-none');
			resultsContainer.innerHTML = '';
			resetCandidate();
			return;
		}

		if (!currentResults.length) {
			resultsContainer.classList.remove('d-none');
			resultsContainer.innerHTML = '<div class="list-group-item text-body-secondary">No users found</div>';
			resetCandidate();
			return;
		}

		resultsContainer.classList.remove('d-none');
		resultsContainer.innerHTML = currentResults.map((user) => {
			const isBlocked = blockedUserIds.has(user.id);
			const isSelected = selectedUsers.has(user.id);
			const disabled = isBlocked || isSelected;
			const stateLabel = isBlocked
				? 'You cannot add this user'
				: isSelected
					? 'Already selected'
					: '';

			return `
				<button
					type="button"
					class="list-group-item list-group-item-action d-flex justify-content-between align-items-start"
					data-member-result-id="${user.id}"
					${disabled ? 'disabled' : ''}
				>
					<span>${escapeHtml(formatUserLabel(user))}</span>
					${stateLabel ? `<small class="text-body-secondary ms-2">${escapeHtml(stateLabel)}</small>` : ''}
				</button>
			`;
		}).join('');
		resetCandidate();
	};

	const searchUsers = async (searchTerm) => {
		setError('');

		const { data, error } = await supabase.rpc('search_project_users', {
			search_term: searchTerm,
			max_results: 20
		});

		if (error) {
			console.error('Error searching users:', error);
			setError('Failed to search users');
			currentResults = [];
			renderResults();
			return;
		}

		currentResults = data || [];
		renderResults();
	};

	const preloadSelectedUsers = async (userIds) => {
		const uniqueUserIds = Array.from(new Set((userIds || []).filter(Boolean)));
		if (!uniqueUserIds.length) {
			renderSelected();
			return;
		}

		const { data, error } = await supabase.rpc('get_project_users_by_ids', {
			user_ids: uniqueUserIds
		});

		if (error) {
			console.error('Error loading selected members:', error);
			setError('Failed to load members');
			renderSelected();
			return;
		}

		for (const user of data || []) {
			if (!blockedUserIds.has(user.id)) {
				selectedUsers.set(user.id, user);
			}
		}

		renderSelected();
	};

	searchInput.addEventListener('input', () => {
		window.clearTimeout(searchTimeoutId);
		searchTimeoutId = window.setTimeout(() => {
			searchUsers(searchInput.value.trim());
		}, 250);
	});

	searchInput.addEventListener('focus', () => {
		if (searchInput.value.trim()) {
			searchUsers(searchInput.value.trim());
		}
	});

	resultsContainer.addEventListener('click', (event) => {
		const button = event.target.closest('[data-member-result-id]');
		if (!button) return;

		const userId = button.getAttribute('data-member-result-id');
		const user = currentResults.find(item => item.id === userId);
		if (!user || !canAddCandidate(user)) return;

		selectedCandidate = user;
		searchInput.value = formatUserLabel(user);
		resultsContainer.classList.add('d-none');
		updateAddButtonState();
	});

	addButton.addEventListener('click', () => {
		if (!canAddCandidate(selectedCandidate)) return;

		selectedUsers.set(selectedCandidate.id, selectedCandidate);
		searchInput.value = '';
		currentResults = [];
		resultsContainer.innerHTML = '';
		resultsContainer.classList.add('d-none');
		resetCandidate();
		renderSelected();
	});

	selectedContainer.addEventListener('click', (event) => {
		const button = event.target.closest('[data-remove-member-id]');
		if (!button) return;

		const userId = button.getAttribute('data-remove-member-id');
		selectedUsers.delete(userId);
		renderSelected();
		updateAddButtonState();
	});

	void preloadSelectedUsers(initialSelectedUserIds);
	updateAddButtonState();

	return {
		getSelectedUserIds() {
			return Array.from(selectedUsers.keys());
		}
	};
}
