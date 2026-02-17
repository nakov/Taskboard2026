import taskboardTemplate from './taskboard.html?raw';
import taskboardStyles from './taskboard.css?raw';
import { supabase } from '../../lib/supabaseClient';

const state = {
	projectId: null,
	stages: [],
	tasks: [],
	taskModal: null,
	deleteModal: null,
	pendingDeleteTaskId: null,
	handlersBound: false
};

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
	state.projectId = projectId;
	state.stages = [];
	state.tasks = [];
	state.pendingDeleteTaskId = null;
	state.handlersBound = false;
	state.taskModal = null;
	state.deleteModal = null;

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

		await loadTaskboard(projectId);
		setupTaskInteractions();

		document.getElementById('loading-indicator').classList.add('d-none');
	} catch (error) {
		console.error('Error loading taskboard:', error);
		showError('Failed to load taskboard');
	}
};

async function loadTaskboard(projectId) {
	try {
		const { data: stages, error: stagesError } = await supabase
			.from('project_stages')
			.select('id, name, position')
			.eq('project_id', projectId)
			.order('position', { ascending: true });

		if (stagesError) throw stagesError;
		state.stages = stages ?? [];

		if (!state.stages || state.stages.length === 0) {
			document.getElementById('taskboard-stages').innerHTML = `
				<div class="alert alert-info">
					<i class="bi bi-info-circle"></i>
					No stages created yet. Create a stage to get started.
				</div>
			`;
			populateStageSelect();
			return;
		}

		const { data: tasks, error: tasksError } = await supabase
			.from('tasks')
			.select('id, title, description, stage_id, position, done, created_at')
			.eq('project_id', projectId)
			.order('position', { ascending: true });

		if (tasksError) throw tasksError;
		state.tasks = tasks ?? [];

		const boardHtml = state.stages.map(stage => {
			const stageTasks = state.tasks.filter(task => task.stage_id === stage.id);
			return renderStage(stage, stageTasks);
		}).join('');

		document.getElementById('taskboard-stages').innerHTML = boardHtml;
		populateStageSelect();
	} catch (error) {
		console.error('Error loading taskboard:', error);
		showError('Failed to load taskboard');
	}
}

function renderStage(stage, tasks) {
	const tasksHtml = tasks.length > 0
		? tasks.map(task => `
			<div class="task-card" data-task-id="${task.id}">
				<div class="task-card-actions">
					<button class="btn btn-light border task-action-btn" type="button" data-action="edit-task" data-task-id="${task.id}" aria-label="Edit task" title="Edit">
						<i class="bi bi-pencil"></i>
					</button>
					<button class="btn btn-light border task-action-btn" type="button" data-action="delete-task" data-task-id="${task.id}" aria-label="Delete task" title="Delete">
						<i class="bi bi-trash"></i>
					</button>
				</div>
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
		<div class="taskboard-stage" data-stage-id="${stage.id}">
			<div class="taskboard-stage-header">
				<h5 class="taskboard-stage-title">${escapeHtml(stage.name)}</h5>
				<span class="taskboard-stage-count">${tasks.length}</span>
			</div>
			<div class="taskboard-tasks">
				${tasksHtml}
				<button class="btn btn-outline-primary w-100 taskboard-create-task" type="button" data-action="create-task" data-stage-id="${stage.id}">
					<i class="bi bi-plus-lg"></i> Create New Task
				</button>
			</div>
		</div>
	`;
}

function setupTaskInteractions() {
	const board = document.getElementById('taskboard-stages');
	const taskForm = document.getElementById('task-form');
	const deleteConfirmButton = document.getElementById('confirm-delete-task');

	if (!board || !taskForm || !deleteConfirmButton || state.handlersBound) {
		return;
	}

	state.taskModal = new window.bootstrap.Modal(document.getElementById('task-modal'));
	state.deleteModal = new window.bootstrap.Modal(document.getElementById('delete-task-modal'));

	board.addEventListener('click', handleBoardClick);
	taskForm.addEventListener('submit', handleTaskSubmit);
	deleteConfirmButton.addEventListener('click', handleTaskDeleteConfirm);

	state.handlersBound = true;
}

function handleBoardClick(event) {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const actionButton = target.closest('[data-action]');
	if (actionButton) {
		event.preventDefault();
		const action = actionButton.getAttribute('data-action');

		if (action === 'create-task') {
			const stageId = actionButton.getAttribute('data-stage-id');
			openTaskModal({ stageId });
		}

		if (action === 'edit-task') {
			const taskId = actionButton.getAttribute('data-task-id');
			if (taskId) {
				openTaskModal({ taskId });
			}
		}

		if (action === 'delete-task') {
			const taskId = actionButton.getAttribute('data-task-id');
			if (taskId) {
				openDeleteModal(taskId);
			}
		}

		return;
	}

	const card = target.closest('.task-card[data-task-id]');
	if (card) {
		const taskId = card.getAttribute('data-task-id');
		if (taskId) {
			openTaskModal({ taskId });
		}
	}
}

function openTaskModal({ stageId = null, taskId = null } = {}) {
	const taskIdInput = document.getElementById('task-id');
	const titleInput = document.getElementById('task-title-input');
	const descriptionInput = document.getElementById('task-description-input');
	const stageInput = document.getElementById('task-stage-input');
	const modalTitle = document.getElementById('task-modal-title');
	const submitButton = document.getElementById('task-submit-button');

	if (!taskIdInput || !titleInput || !descriptionInput || !stageInput || !modalTitle || !submitButton || !state.taskModal) {
		return;
	}

	if (taskId) {
		const task = state.tasks.find(item => item.id === taskId);
		if (!task) {
			return;
		}

		taskIdInput.value = task.id;
		titleInput.value = task.title ?? '';
		descriptionInput.value = task.description ?? '';
		stageInput.value = task.stage_id ?? '';
		modalTitle.textContent = 'Edit Task';
		submitButton.textContent = 'Save Changes';
	} else {
		taskIdInput.value = '';
		titleInput.value = '';
		descriptionInput.value = '';
		stageInput.value = stageId ?? state.stages[0]?.id ?? '';
		modalTitle.textContent = 'Create Task';
		submitButton.textContent = 'Create Task';
	}

	state.taskModal.show();
}

function openDeleteModal(taskId) {
	state.pendingDeleteTaskId = taskId;
	if (state.deleteModal) {
		state.deleteModal.show();
	}
}

async function handleTaskSubmit(event) {
	event.preventDefault();

	const taskIdInput = document.getElementById('task-id');
	const titleInput = document.getElementById('task-title-input');
	const descriptionInput = document.getElementById('task-description-input');
	const stageInput = document.getElementById('task-stage-input');
	const submitButton = document.getElementById('task-submit-button');

	if (!taskIdInput || !titleInput || !descriptionInput || !stageInput || !submitButton) {
		return;
	}

	const taskId = taskIdInput.value.trim();
	const title = titleInput.value.trim();
	const description = descriptionInput.value.trim();
	const stageId = stageInput.value;

	if (!title || !stageId || !state.projectId) {
		return;
	}

	submitButton.disabled = true;

	try {
		if (taskId) {
			await updateTask(taskId, { title, description, stageId });
		} else {
			await createTask({ title, description, stageId });
		}

		if (state.taskModal) {
			state.taskModal.hide();
		}

		await loadTaskboard(state.projectId);
	} catch (error) {
		console.error('Error saving task:', error);
		window.alert('Failed to save task. Please try again.');
	} finally {
		submitButton.disabled = false;
	}
}

async function createTask({ title, description, stageId }) {
	const stageTaskCount = state.tasks.filter(task => task.stage_id === stageId).length;
	const { error } = await supabase
		.from('tasks')
		.insert({
			project_id: state.projectId,
			stage_id: stageId,
			title,
			description: description || null,
			position: stageTaskCount,
			done: false
		});

	if (error) {
		throw error;
	}
}

async function updateTask(taskId, { title, description, stageId }) {
	const existingTask = state.tasks.find(task => task.id === taskId);
	if (!existingTask) {
		throw new Error('Task not found');
	}

	let nextPosition = existingTask.position;
	if (existingTask.stage_id !== stageId) {
		nextPosition = state.tasks.filter(task => task.stage_id === stageId).length;
	}

	const { error } = await supabase
		.from('tasks')
		.update({
			title,
			description: description || null,
			stage_id: stageId,
			position: nextPosition
		})
		.eq('id', taskId)
		.eq('project_id', state.projectId);

	if (error) {
		throw error;
	}
}

async function handleTaskDeleteConfirm() {
	if (!state.pendingDeleteTaskId || !state.projectId) {
		return;
	}

	const taskId = state.pendingDeleteTaskId;
	const deleteButton = document.getElementById('confirm-delete-task');
	if (deleteButton) {
		deleteButton.disabled = true;
	}

	try {
		const { error } = await supabase
			.from('tasks')
			.delete()
			.eq('id', taskId)
			.eq('project_id', state.projectId);

		if (error) {
			throw error;
		}

		state.pendingDeleteTaskId = null;
		if (state.deleteModal) {
			state.deleteModal.hide();
		}
		await loadTaskboard(state.projectId);
	} catch (error) {
		console.error('Error deleting task:', error);
		window.alert('Failed to delete task. Please try again.');
	} finally {
		if (deleteButton) {
			deleteButton.disabled = false;
		}
	}
}

function populateStageSelect() {
	const stageInput = document.getElementById('task-stage-input');
	if (!stageInput) {
		return;
	}

	stageInput.innerHTML = state.stages
		.map(stage => `<option value="${stage.id}">${escapeHtml(stage.name)}</option>`)
		.join('');
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
