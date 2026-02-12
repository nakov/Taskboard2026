import dashboardTemplate from './dashboard.html?raw';
import { supabase } from '../../lib/supabaseClient';

const redirectTo = (path, { replace = false } = {}) => {
	if (replace) {
		window.history.replaceState({}, '', path);
	} else {
		window.history.pushState({}, '', path);
	}

	window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderDashboardPage = () => dashboardTemplate;

export const initDashboardPage = async () => {
	const { data } = await supabase.auth.getSession();
	if (!data?.session) {
		redirectTo('/login', { replace: true });
		return;
	}

	const emailTarget = document.querySelector('[data-user-email]');
	if (emailTarget) {
		emailTarget.textContent = data.session.user.email ?? 'Unknown user';
	}

	// Load dashboard data
	await loadDashboardData();

	// Set up logout button
	const logoutBtn = document.querySelector('[data-logout]');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', async () => {
			await supabase.auth.signOut();
			redirectTo('/login', { replace: true });
		});
	}
};

async function loadDashboardData() {
	try {
		// Fetch projects
		const { data: projects, error: projectsError } = await supabase
			.from('projects')
			.select('id, title, description, created_at')
			.order('created_at', { ascending: false });

		if (projectsError) throw projectsError;

		// Fetch tasks with counts
		const { data: tasks, error: tasksError } = await supabase
			.from('tasks')
			.select('id, done, project_id');

		if (tasksError) throw tasksError;

		// Calculate statistics
		const projectCount = projects?.length || 0;
		const totalTasks = tasks?.length || 0;
		const pendingTasks = tasks?.filter(t => !t.done).length || 0;
		const doneTasks = tasks?.filter(t => t.done).length || 0;

		// Update statistics
		updateStatistic('[data-stat-projects]', projectCount);
		updateStatistic('[data-stat-tasks-total]', totalTasks);
		updateStatistic('[data-stat-tasks-pending]', pendingTasks);
		updateStatistic('[data-stat-tasks-done]', doneTasks);

		// Render projects list
		renderProjectsList(projects || []);
	} catch (error) {
		console.error('Error loading dashboard data:', error);
		showError('Failed to load dashboard data');
	}
}

function updateStatistic(selector, value) {
	const element = document.querySelector(selector);
	if (element) {
		element.textContent = value;
	}
}

function renderProjectsList(projects) {
	const container = document.querySelector('[data-projects-list]');
	if (!container) return;

	if (projects.length === 0) {
		container.innerHTML = `
			<div class="alert alert-light border text-center">
				<p class="mb-2">No projects yet.</p>
				<button class="btn btn-primary btn-sm" onclick="alert('Create project feature coming soon!')">
					Create Your First Project
				</button>
			</div>
		`;
		return;
	}

	container.innerHTML = `
		<div class="list-group">
			${projects.map(project => `
				<a href="/projects/${project.id}" 
				   class="list-group-item list-group-item-action"
				   data-project-link="${project.id}">
					<div class="d-flex w-100 justify-content-between align-items-start">
						<div>
							<h5 class="mb-1">${escapeHtml(project.title)}</h5>
							${project.description ? `<p class="mb-1 text-body-secondary small">${escapeHtml(project.description)}</p>` : ''}
						</div>
						<small class="text-body-secondary">${formatDate(project.created_at)}</small>
					</div>
				</a>
			`).join('')}
		</div>
	`;

	// Add click handlers for project links
	projects.forEach(project => {
		const link = container.querySelector(`[data-project-link="${project.id}"]`);
		if (link) {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				redirectTo(`/projects/${project.id}`);
			});
		}
	});
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

function formatDate(dateString) {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now - date;
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	if (diffDays < 7) return `${diffDays} days ago`;
	
	return date.toLocaleDateString('en-US', { 
		month: 'short', 
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
}

function showError(message) {
	const container = document.querySelector('[data-projects-list]');
	if (container) {
		container.innerHTML = `
			<div class="alert alert-danger border-danger">
				<strong>Error:</strong> ${escapeHtml(message)}
			</div>
		`;
	}
}
