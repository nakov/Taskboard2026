import taskboardTemplate from './taskboard.html?raw';
import taskboardStyles from './taskboard.css?raw';
import { supabase } from '../../lib/supabaseClient';

const redirectTo = (path, { replace = false } = {}) => {
	if (replace) {
		window.history.replaceState({}, '', path);
	} else {
		window.history.pushState({}, '', path);
	}

	window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderTaskboardPage = () => {
	return `<style>${taskboardStyles}</style>${taskboardTemplate}`;
};

export const initTaskboardPage = async (projectId) => {
	const { data } = await supabase.auth.getSession();
	if (!data?.session) {
		redirectTo('/login', { replace: true });
		return;
	}

	try {
		// Load project details
		const { data: project, error: projectError } = await supabase
			.from('projects')
			.select('id, title, description, owner_id, created_at')
			.eq('id', projectId)
			.single();

		if (projectError || !project) {
			showError('Project not found');
			return;
		}

		// Check if user is the project owner
		if (project.owner_id !== data.session.user.id) {
			showError('You do not have permission to view this project');
			return;
		}

		// Display project info
		document.getElementById('project-title').textContent = project.title;
		const descriptionElement = document.getElementById('project-description');
		if (project.description) {
			descriptionElement.textContent = project.description;
		} else {
			descriptionElement.textContent = '—';
		}

		// Load and display stages and tasks
		await loadTaskboard(projectId);

		// Hide loading indicator
		document.getElementById('loading-indicator').classList.add('d-none');
	} catch (error) {
		console.error('Error loading taskboard:', error);
		showError('Failed to load taskboard');
	}
};

async function loadTaskboard(projectId) {
	try {
		// Fetch project stages
		const { data: stages, error: stagesError } = await supabase
			.from('project_stages')
			.select('id, name, position')
			.eq('project_id', projectId)
			.order('position', { ascending: true });

		if (stagesError) throw stagesError;

		if (!stages || stages.length === 0) {
			document.getElementById('taskboard-stages').innerHTML = `
				<div class="alert alert-info">
					<i class="bi bi-info-circle"></i>
					No stages created yet. Create a stage to get started.
				</div>
			`;
			return;
		}

		// Fetch all tasks for this project
		const { data: tasks, error: tasksError } = await supabase
			.from('tasks')
			.select('id, title, description, stage_id, position, done, created_at')
			.eq('project_id', projectId)
			.order('position', { ascending: true });

		if (tasksError) throw tasksError;

		// Render stages
		const boardHtml = stages.map(stage => {
			const stageTasks = tasks.filter(task => task.stage_id === stage.id);
			return renderStage(stage, stageTasks);
		}).join('');

		document.getElementById('taskboard-stages').innerHTML = boardHtml;
	} catch (error) {
		console.error('Error loading taskboard:', error);
		showError('Failed to load taskboard');
	}
}

function renderStage(stage, tasks) {
	const tasksHtml = tasks.length > 0
		? tasks.map(task => `
			<div class="task-card" data-task-id="${task.id}">
				<p class="task-title">${escapeHtml(task.title)}</p>
				${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
				<div class="task-meta">
					<span>${task.done ? '✓ Done' : 'To Do'}</span>
					<span>${formatDate(task.created_at)}</span>
				</div>
			</div>
		`).join('')
		: `<div class="empty-state"><i class="bi bi-inbox"></i> No tasks</div>`;

	return `
		<div class="taskboard-stage">
			<div class="taskboard-stage-header">
				<h5 class="taskboard-stage-title">${escapeHtml(stage.name)}</h5>
				<span class="taskboard-stage-count">${tasks.length}</span>
			</div>
			<div class="taskboard-tasks">
				${tasksHtml}
			</div>
		</div>
	`;
}

function showError(message) {
	document.getElementById('loading-indicator').classList.add('d-none');
	const errorDiv = document.getElementById('error-message');
	document.getElementById('error-text').textContent = message;
	errorDiv.classList.remove('d-none');
}

function escapeHtml(text) {
	if (!text) return '';
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
