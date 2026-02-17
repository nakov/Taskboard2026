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
		<div class="row g-3">
			${projects.map(project => `
				<div class="col-sm-6 col-lg-4 col-xl-3">
					<div class="card h-100 project-card shadow-sm border" data-project-link="${project.id}">
						<div class="card-body d-flex flex-column">
							<h5 class="card-title mb-2">${escapeHtml(project.title)}</h5>
							${project.description ? `<p class="card-text text-body-secondary small flex-grow-1">${escapeHtml(project.description)}</p>` : '<div class="flex-grow-1"></div>'}
							<div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
								<small class="text-body-secondary">
									<i class="bi bi-calendar3"></i> ${formatDate(project.created_at)}
								</small>
								<a href="/projects/${project.id}" class="btn btn-sm btn-outline-primary" data-project-btn="${project.id}">
									View <i class="bi bi-arrow-right"></i>
								</a>
							</div>
						</div>
					</div>
				</div>
			`).join('')}
		</div>
	`;

	// Add click handlers for project cards
	projects.forEach(project => {
		const card = container.querySelector(`[data-project-link="${project.id}"]`);
		const btn = container.querySelector(`[data-project-btn="${project.id}"]`);
		
		if (card) {
			card.style.cursor = 'pointer';
			card.addEventListener('click', (e) => {
				// Don't navigate if clicking the button
				if (e.target.closest('[data-project-btn]')) return;
				e.preventDefault();
				redirectTo(`/projects/${project.id}`);
			});
		}
		
		if (btn) {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
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
