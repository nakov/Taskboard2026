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
	handlersBound: false,
	draggedTaskId: null,
	suppressCardClick: false,
	isPersistingDrag: false
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
	state.draggedTaskId = null;
	state.suppressCardClick = false;
	state.isPersistingDrag = false;

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
			<div class="task-card" data-task-id="${task.id}" draggable="true">
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
	board.addEventListener('dragstart', handleDragStart);
	board.addEventListener('dragover', handleDragOver);
	board.addEventListener('dragleave', handleDragLeave);
	board.addEventListener('drop', handleDrop);
	board.addEventListener('dragend', handleDragEnd);
	taskForm.addEventListener('submit', handleTaskSubmit);
	deleteConfirmButton.addEventListener('click', handleTaskDeleteConfirm);

	state.handlersBound = true;
}

function handleBoardClick(event) {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	if (state.suppressCardClick && target.closest('.task-card[data-task-id]')) {
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

function handleDragStart(event) {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const card = target.closest('.task-card[data-task-id]');
	if (!card) {
		return;
	}

	state.draggedTaskId = card.getAttribute('data-task-id');
	state.suppressCardClick = true;
	card.classList.add('dragging');

	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', state.draggedTaskId ?? '');
	}
}

function handleDragOver(event) {
	if (!state.draggedTaskId || state.isPersistingDrag) {
		return;
	}

	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const stage = target.closest('.taskboard-stage');
	const taskContainer = getTaskContainerFromElement(target);
	if (!stage || !taskContainer) {
		return;
	}

	event.preventDefault();
	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = 'move';
	}

	highlightDropStage(stage);
	clearEmptyState(taskContainer);

	const draggingCard = document.querySelector(`.task-card[data-task-id="${state.draggedTaskId}"]`);
	if (!draggingCard) {
		return;
	}

	const afterElement = getTaskInsertReference(taskContainer, event.clientY);
	const createTaskButton = taskContainer.querySelector('.taskboard-create-task');

	if (afterElement) {
		taskContainer.insertBefore(draggingCard, afterElement);
	} else if (createTaskButton) {
		taskContainer.insertBefore(draggingCard, createTaskButton);
	} else {
		taskContainer.appendChild(draggingCard);
	}
}

function handleDragLeave(event) {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const stage = target.closest('.taskboard-stage');
	if (!stage || stage.contains(event.relatedTarget)) {
		return;
	}

	stage.classList.remove('drag-over');
}

async function handleDrop(event) {
	if (!state.draggedTaskId || state.isPersistingDrag || !state.projectId) {
		return;
	}

	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}

	const stage = target.closest('.taskboard-stage');
	const taskContainer = getTaskContainerFromElement(target);
	if (!stage || !taskContainer) {
		return;
	}

	event.preventDefault();

	try {
		state.isPersistingDrag = true;
		await persistTaskOrderFromDom();
		await loadTaskboard(state.projectId);
	} catch (error) {
		console.error('Error moving task:', error);
		window.alert('Failed to move task. Please try again.');
		await loadTaskboard(state.projectId);
	} finally {
		state.isPersistingDrag = false;
		clearDragVisuals();
	}
}

function handleDragEnd() {
	clearDragVisuals();
	window.setTimeout(() => {
		state.suppressCardClick = false;
	}, 0);
}

function getTaskContainerFromElement(element) {
	const directContainer = element.closest('.taskboard-tasks');
	if (directContainer) {
		return directContainer;
	}

	const stage = element.closest('.taskboard-stage');
	if (!stage) {
		return null;
	}

	return stage.querySelector('.taskboard-tasks');
}

function getTaskInsertReference(container, cursorY) {
	const cards = Array.from(container.querySelectorAll('.task-card:not(.dragging)'));
	let closestOffset = Number.NEGATIVE_INFINITY;
	let closestElement = null;

	for (const card of cards) {
		const box = card.getBoundingClientRect();
		const offset = cursorY - box.top - box.height / 2;
		if (offset < 0 && offset > closestOffset) {
			closestOffset = offset;
			closestElement = card;
		}
	}

	return closestElement;
}

function highlightDropStage(activeStage) {
	const stages = document.querySelectorAll('.taskboard-stage');
	for (const stage of stages) {
		stage.classList.toggle('drag-over', stage === activeStage);
	}
}

function clearEmptyState(container) {
	const emptyState = container.querySelector('.empty-state');
	if (emptyState) {
		emptyState.remove();
	}
}

function clearDragVisuals() {
	state.draggedTaskId = null;
	const draggingCards = document.querySelectorAll('.task-card.dragging');
	for (const card of draggingCards) {
		card.classList.remove('dragging');
	}

	const stages = document.querySelectorAll('.taskboard-stage.drag-over');
	for (const stage of stages) {
		stage.classList.remove('drag-over');
	}
}

async function persistTaskOrderFromDom() {
	const stageElements = document.querySelectorAll('.taskboard-stage[data-stage-id]');
	if (stageElements.length === 0) {
		return;
	}

	const taskById = new Map(state.tasks.map(task => [task.id, task]));
	const updates = [];

	for (const stageElement of stageElements) {
		const stageId = stageElement.getAttribute('data-stage-id');
		const cards = stageElement.querySelectorAll('.task-card[data-task-id]');

		cards.forEach((card, index) => {
			const taskId = card.getAttribute('data-task-id');
			if (!taskId || !stageId) {
				return;
			}

			const task = taskById.get(taskId);
			if (!task) {
				return;
			}

			if (task.stage_id !== stageId || task.position !== index) {
				updates.push({ taskId, stageId, position: index });
			}
		});
	}

	if (updates.length === 0) {
		return;
	}

	const results = await Promise.all(
		updates.map(({ taskId, stageId, position }) =>
			supabase
				.from('tasks')
				.update({ stage_id: stageId, position })
				.eq('id', taskId)
				.eq('project_id', state.projectId)
		)
	);

	const failedUpdate = results.find(result => result.error);
	if (failedUpdate?.error) {
		throw failedUpdate.error;
	}
}

function openTaskModal({ stageId = null, taskId = null } = {}) {
	const taskIdInput = document.getElementById('task-id');
	const titleInput = document.getElementById('task-title-input');
	const descriptionInput = document.getElementById('task-description-input');
	const stageInput = document.getElementById('task-stage-input');
	const statusOpenRadio = document.getElementById('task-status-open');
	const statusDoneRadio = document.getElementById('task-status-done');
	const modalTitle = document.getElementById('task-modal-title');
	const submitButton = document.getElementById('task-submit-button');

	if (!taskIdInput || !titleInput || !descriptionInput || !stageInput || !statusOpenRadio || !statusDoneRadio || !modalTitle || !submitButton || !state.taskModal) {
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
		if (task.done) {
			statusDoneRadio.checked = true;
		} else {
			statusOpenRadio.checked = true;
		}
		modalTitle.textContent = 'Edit Task';
		submitButton.textContent = 'Save Changes';
	} else {
		taskIdInput.value = '';
		titleInput.value = '';
		descriptionInput.value = '';
		stageInput.value = stageId ?? state.stages[0]?.id ?? '';
		statusOpenRadio.checked = true;
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
	const statusDoneRadio = document.getElementById('task-status-done');
	const submitButton = document.getElementById('task-submit-button');

	if (!taskIdInput || !titleInput || !descriptionInput || !stageInput || !statusDoneRadio || !submitButton) {
		return;
	}

	const taskId = taskIdInput.value.trim();
	const title = titleInput.value.trim();
	const description = descriptionInput.value.trim();
	const stageId = stageInput.value;
	const done = statusDoneRadio.checked;

	if (!title || !stageId || !state.projectId) {
		return;
	}

	submitButton.disabled = true;

	try {
		if (taskId) {
			await updateTask(taskId, { title, description, stageId, done });
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

async function updateTask(taskId, { title, description, stageId, done }) {
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
			position: nextPosition,
			done: done ?? existingTask.done
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
