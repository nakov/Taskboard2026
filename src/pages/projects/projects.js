import projectsTemplate from './projects.html?raw';
import projectsStyles from './projects.css?raw';
import { supabase } from '../../lib/supabaseClient';

const redirectTo = (path, { replace = false } = {}) => {
	if (replace) {
		window.history.replaceState({}, '', path);
	} else {
		window.history.pushState({}, '', path);
	}

	window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderProjectsPage = () => {
	return `<style>${projectsStyles}</style>${projectsTemplate}`;
};

export const initProjectsPage = async () => {
	const { data } = await supabase.auth.getSession();
	if (!data?.session) {
		redirectTo('/login', { replace: true });
		return;
	}

	// Load and display projects
	await loadProjects();

	// Set up delete confirmation modal
	setupDeleteConfirmation();
};

async function loadProjects() {
	try {
		const container = document.querySelector('[data-projects-container]');
		if (!container) return;

		// Fetch projects with task and stage counts
		const { data: projects, error } = await supabase
			.from('projects')
			.select(`
				id,
				title,
				description,
				owner_id,
				created_at,
				project_stages(count),
				tasks!tasks_project_id_fkey(done)
			`)

		if (!projects || projects.length === 0) {
			container.innerHTML = `
				<div class="alert alert-light border text-center py-5">
					<i class="bi bi-inbox display-4"></i>
					<p class="mb-2 mt-3">No projects yet.</p>
					<a href="/projects/add" class="btn btn-primary btn-sm" data-link>
						Create Your First Project
					</a>
				</div>
			`;
			return;
		}

		// Get current user for owner display
		const { data: sessionData } = await supabase.auth.getSession();
		const currentUserId = sessionData?.session?.user?.id;

		// Process projects to add computed counts
		const processedProjects = projects.map(project => {
			const tasks = project.tasks || [];
			const openTasks = tasks.filter(t => !t.done).length;
			const tasksDone = tasks.filter(t => t.done).length;
			const stageCount = project.project_stages?.[0]?.count || 0;

			return {
				...project,
				openTasks,
				tasksDone,
				stageCount
			};
		});

		// Render projects table
		renderProjectsTable(processedProjects, currentUserId);
	} catch (error) {
		console.error('Error loading projects:', error);
		const container = document.querySelector('[data-projects-container]');
		if (container) {
			container.innerHTML = `
				<div class="alert alert-danger border-danger">
					<strong>Error:</strong> Failed to load projects
				</div>
			`;
		}
	}
}

function renderProjectsTable(projects, currentUserId) {
	const container = document.querySelector('[data-projects-container]');
	if (!container) return;

	const tableHtml = `
		<div class="table-responsive">
			<table class="table table-hover mb-0">
				<thead class="table-light">
					<tr>
						<th>Title</th>
						<th>Description</th>
						<th class="text-center">Stages</th>
						<th class="text-center">Open Tasks</th>
						<th class="text-center">Tasks Done</th>
						<th class="text-end">Actions</th>
					</tr>
				</thead>
				<tbody>
					${projects.map(project => `
						<tr data-project-row="${project.id}">
							<td>
								<a href="/projects/${project.id}" class="project-title-link" data-link>
									<strong>${escapeHtml(project.title)}</strong>
								</a>
							</td>
							<td>
								<span class="text-body-secondary small">
									${project.description ? escapeHtml(project.description) : '—'}
								</span>
							</td>
							<td class="text-center">
								<span class="badge bg-secondary">${project.stageCount || 0}</span>
							</td>
							<td class="text-center">
								<span class="badge bg-primary">${project.openTasks || 0}</span>
							</td>
							<td class="text-center">
								<span class="badge bg-success">${project.tasksDone || 0}</span>
							</td>
							<td class="text-end">
								<div class="btn-group btn-group-sm" role="group">
									<a href="/projects/${project.id}" 
									   class="btn btn-outline-primary" 
									   title="View project"
									   data-link>
										<i class="bi bi-eye"></i>
									</a>
									${project.owner_id === currentUserId ? `
										<a href="/projects/${project.id}/edit" 
										   class="btn btn-outline-secondary" 
										   title="Edit project"
										   data-link>
											<i class="bi bi-pencil"></i>
										</a>
									` : ''}
									${project.owner_id === currentUserId ? `
										<button class="btn btn-outline-danger" 
										        title="Delete project"
										        data-delete-project="${project.id}">
											<i class="bi bi-trash"></i>
										</button>
									` : ''}
								</div>
							</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
		</div>
	`;

	container.innerHTML = tableHtml;

	// Add delete button listeners
	projects.forEach(project => {
		const deleteBtn = container.querySelector(`[data-delete-project="${project.id}"]`);
		if (deleteBtn) {
			deleteBtn.addEventListener('click', () => {
				showDeleteConfirmation(project);
			});
		}
	});
}

function showDeleteConfirmation(project) {
	const modal = new window.bootstrap.Modal(
		document.getElementById('deleteConfirmModal')
	);

	const confirmBtn = document.getElementById('confirmDeleteBtn');
	
	// Clear previous listeners by cloning
	const newConfirmBtn = confirmBtn.cloneNode(true);
	confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

	// Add new listener
	newConfirmBtn.addEventListener('click', async () => {
		await deleteProject(project.id);
		modal.hide();
	});

	modal.show();
}

async function deleteProject(projectId) {
	try {
		const { error } = await supabase
			.from('projects')
			.delete()
			.eq('id', projectId);

		if (error) throw error;

		// Show success toast
		showSuccessToast();

		// Reload projects
		await loadProjects();
	} catch (error) {
		console.error('Error deleting project:', error);
		alert('Failed to delete project');
	}
}

function showSuccessToast() {
	const toastElement = document.getElementById('deleteSuccessToast');
	if (toastElement) {
		const toast = new window.bootstrap.Toast(toastElement, {
			autohide: true,
			delay: 3000
		});
		toast.show();
	}
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

function setupDeleteConfirmation() {
	// Bootstrap Modal is now available on window.bootstrap
}
