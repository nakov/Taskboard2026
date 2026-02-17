import taskboardTemplate from './taskboard.html?raw';
import taskboardStyles from './taskboard.css?raw';
import { supabase } from '../../lib/supabaseClient';
import { createTaskEditor, renderTaskEditor } from '../../components/task-editor/taskEditor';

const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

const state = {
	projectId: null,
	stages: [],
	tasks: [],
	taskEditor: null,
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
	return `<style>${taskboardStyles}</style>${taskboardTemplate.replace('{{taskEditorModal}}', renderTaskEditor())}`;
};

export const initTaskboardPage = async (projectId) => {
	state.projectId = projectId;
	state.stages = [];
	state.tasks = [];
	state.pendingDeleteTaskId = null;
	state.handlersBound = false;
	state.taskEditor = null;
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
			.select('id, title, description, created_at')
			.eq('id', projectId)
			.single();

		if (projectError || !project) {
			showError('Project not found');
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

			if (state.taskEditor) {
				state.taskEditor.updateStageOptions([]);
			}
			return;
		}

		const { data: tasks, error: tasksError } = await supabase
			.from('tasks')
			.select('id, title, description, stage_id, position, done, created_at')
			.eq('project_id', projectId)
			.order('position', { ascending: true });

		if (tasksError) throw tasksError;
		state.tasks = await enrichTasksWithCoverImages(tasks ?? []);

		const boardHtml = state.stages.map(stage => {
			const stageTasks = state.tasks.filter(task => task.stage_id === stage.id);
			return renderStage(stage, stageTasks);
		}).join('');

		document.getElementById('taskboard-stages').innerHTML = boardHtml;

		if (state.taskEditor) {
			state.taskEditor.updateStageOptions(state.stages);
		}
	} catch (error) {
		console.error('Error loading taskboard:', error);
		showError('Failed to load taskboard');
	}
}

function renderStage(stage, tasks) {
	const tasksHtml = tasks.length > 0
		? tasks.map(task => `
			<div class="task-card" data-task-id="${task.id}" draggable="true">
				${task.coverImageUrl ? `<img class="task-cover-image" src="${escapeHtml(task.coverImageUrl)}" alt="${escapeHtml(task.title || 'Task cover')}" loading="lazy">` : ''}
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

async function enrichTasksWithCoverImages(tasks) {
	if (!tasks || tasks.length === 0) {
		return [];
	}

	const taskIds = tasks.map(task => task.id).filter(Boolean);
	if (taskIds.length === 0) {
		return tasks;
	}

	const { data: imageAttachments, error } = await supabase
		.from('task_attachments')
		.select('task_id, bucket_id, storage_path, created_at')
		.in('task_id', taskIds)
		.like('mime_type', 'image/%')
		.order('created_at', { ascending: true });

	if (error) {
		if (error.code === '42P01') {
			return tasks;
		}

		throw error;
	}

	const firstImageByTaskId = new Map();
	for (const attachment of imageAttachments ?? []) {
		if (!attachment.task_id || !attachment.storage_path || firstImageByTaskId.has(attachment.task_id)) {
			continue;
		}

		firstImageByTaskId.set(attachment.task_id, attachment);
	}

	if (firstImageByTaskId.size === 0) {
		return tasks;
	}

	const signedUrlByTaskId = new Map();
	const signedUrlResults = await Promise.all(
		Array.from(firstImageByTaskId.entries()).map(async ([taskId, attachment]) => {
			const { data: signedUrlData } = await supabase.storage
				.from(attachment.bucket_id || TASK_ATTACHMENTS_BUCKET)
				.createSignedUrl(attachment.storage_path, 60 * 30);

			return {
				taskId,
				signedUrl: signedUrlData?.signedUrl ?? null
			};
		})
	);

	for (const { taskId, signedUrl } of signedUrlResults) {
		signedUrlByTaskId.set(taskId, signedUrl);
	}

	return tasks.map(task => ({
		...task,
		coverImageUrl: signedUrlByTaskId.get(task.id) ?? null
	}));
}

function setupTaskInteractions() {
	const board = document.getElementById('taskboard-stages');
	const deleteConfirmButton = document.getElementById('confirm-delete-task');

	if (!board || !deleteConfirmButton || state.handlersBound) {
		return;
	}

	state.taskEditor = createTaskEditor({
		onSubmit: handleTaskEditorSubmit
	});

	if (!state.taskEditor) {
		showError('Task editor could not be initialized');
		return;
	}

	state.deleteModal = new window.bootstrap.Modal(document.getElementById('delete-task-modal'));

	board.addEventListener('click', handleBoardClick);
	board.addEventListener('dragstart', handleDragStart);
	board.addEventListener('dragover', handleDragOver);
	board.addEventListener('dragleave', handleDragLeave);
	board.addEventListener('drop', handleDrop);
	board.addEventListener('dragend', handleDragEnd);
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
			void openTaskModal({ stageId });
		}

		if (action === 'edit-task') {
			const taskId = actionButton.getAttribute('data-task-id');
			if (taskId) {
				void openTaskModal({ taskId });
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
			void openTaskModal({ taskId });
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

async function openTaskModal({ stageId = null, taskId = null } = {}) {
	if (!state.taskEditor) {
		return;
	}

	if (taskId) {
		const task = state.tasks.find(item => item.id === taskId);
		if (!task) {
			return;
		}

		const attachments = await loadTaskAttachments(taskId);
		state.taskEditor.openEdit({
			task,
			stages: state.stages,
			attachments
		});
	} else {
		state.taskEditor.openCreate({
			stageId: stageId ?? state.stages[0]?.id ?? '',
			stages: state.stages
		});
	}
}

function openDeleteModal(taskId) {
	state.pendingDeleteTaskId = taskId;
	if (state.deleteModal) {
		state.deleteModal.show();
	}
}

async function handleTaskEditorSubmit({ taskId, title, description, stageId, done, newFiles, removeAttachmentIds }) {
	if (!title || !stageId || !state.projectId) {
		return false;
	}

	try {
		let persistedTaskId = taskId;

		if (taskId) {
			await updateTask(taskId, { title, description, stageId, done });
		} else {
			persistedTaskId = await createTask({ title, description, stageId });
		}

		if (persistedTaskId) {
			await processTaskAttachments(persistedTaskId, {
				removeAttachmentIds,
				newFiles
			});
		}

		await loadTaskboard(state.projectId);
		return true;
	} catch (error) {
		console.error('Error saving task:', error);
		window.alert('Failed to save task. Please try again.');
		return false;
	}
}

async function createTask({ title, description, stageId }) {
	const stageTaskCount = state.tasks.filter(task => task.stage_id === stageId).length;
	const { data: createdTask, error } = await supabase
		.from('tasks')
		.insert({
			project_id: state.projectId,
			stage_id: stageId,
			title,
			description: description || null,
			position: stageTaskCount,
			done: false
		})
		.select('id')
		.single();

	if (error) {
		throw error;
	}

	return createdTask?.id ?? null;
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
		await removeAllTaskAttachments(taskId);

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

async function loadTaskAttachments(taskId) {
	if (!taskId) {
		return [];
	}

	const { data, error } = await supabase
		.from('task_attachments')
		.select('id, task_id, bucket_id, storage_path, file_name, mime_type, size_bytes, created_at')
		.eq('task_id', taskId)
		.order('created_at', { ascending: true });

	if (error) {
		if (error.code === '42P01') {
			return [];
		}

		throw error;
	}

	const attachments = data ?? [];
	if (attachments.length === 0) {
		return [];
	}

	const signedUrlsByPath = new Map();
	const createUrlResults = await Promise.all(
		attachments.map(async (attachment) => {
			if (!attachment.storage_path) {
				return { path: null, signedUrl: null };
			}

			const { data: signedUrlData } = await supabase.storage
				.from(attachment.bucket_id || TASK_ATTACHMENTS_BUCKET)
				.createSignedUrl(attachment.storage_path, 60 * 30);

			return {
				path: attachment.storage_path,
				signedUrl: signedUrlData?.signedUrl ?? null
			};
		})
	);

	for (const result of createUrlResults) {
		if (result.path) {
			signedUrlsByPath.set(result.path, result.signedUrl);
		}
	}

	return attachments.map((attachment) => {
		const previewUrl = signedUrlsByPath.get(attachment.storage_path) ?? null;
		const isImage = typeof attachment.mime_type === 'string' && attachment.mime_type.startsWith('image/');

		return {
			id: attachment.id,
			source: 'existing',
			name: attachment.file_name,
			size: attachment.size_bytes,
			isImage,
			previewUrl: isImage ? previewUrl : null,
			downloadUrl: previewUrl
		};
	});
}

async function processTaskAttachments(taskId, { newFiles = [], removeAttachmentIds = [] } = {}) {
	if (!taskId) {
		return;
	}

	if (removeAttachmentIds.length > 0) {
		const { data: attachmentsToRemove, error: removeLookupError } = await supabase
			.from('task_attachments')
			.select('id, bucket_id, storage_path')
			.eq('task_id', taskId)
			.in('id', removeAttachmentIds);

		if (removeLookupError) {
			throw removeLookupError;
		}

		if (attachmentsToRemove && attachmentsToRemove.length > 0) {
			const byBucket = new Map();
			for (const attachment of attachmentsToRemove) {
				const bucket = attachment.bucket_id || TASK_ATTACHMENTS_BUCKET;
				const existing = byBucket.get(bucket) ?? [];
				if (attachment.storage_path) {
					existing.push(attachment.storage_path);
				}
				byBucket.set(bucket, existing);
			}

			for (const [bucket, paths] of byBucket.entries()) {
				if (paths.length === 0) {
					continue;
				}

				const { error: storageDeleteError } = await supabase.storage
					.from(bucket)
					.remove(paths);

				if (storageDeleteError) {
					throw storageDeleteError;
				}
			}

			const { error: deleteRowsError } = await supabase
				.from('task_attachments')
				.delete()
				.eq('task_id', taskId)
				.in('id', attachmentsToRemove.map((attachment) => attachment.id));

			if (deleteRowsError) {
				throw deleteRowsError;
			}
		}
	}

	if (newFiles.length === 0) {
		return;
	}

	for (const file of newFiles) {
		const fileName = file?.name || 'attachment';
		const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
		const storagePath = `${taskId}/${crypto.randomUUID()}_${sanitizedName}`;

		const { error: uploadError } = await supabase.storage
			.from(TASK_ATTACHMENTS_BUCKET)
			.upload(storagePath, file, {
				upsert: false,
				contentType: file.type || undefined
			});

		if (uploadError) {
			throw uploadError;
		}

		const { error: insertAttachmentError } = await supabase
			.from('task_attachments')
			.insert({
				task_id: taskId,
				bucket_id: TASK_ATTACHMENTS_BUCKET,
				storage_path: storagePath,
				file_name: fileName,
				mime_type: file.type || null,
				size_bytes: typeof file.size === 'number' ? file.size : null
			});

		if (insertAttachmentError) {
			throw insertAttachmentError;
		}
	}
}

async function removeAllTaskAttachments(taskId) {
	if (!taskId) {
		return;
	}

	const { data: attachments, error } = await supabase
		.from('task_attachments')
		.select('id, bucket_id, storage_path')
		.eq('task_id', taskId);

	if (error) {
		if (error.code === '42P01') {
			return;
		}

		throw error;
	}

	if (!attachments || attachments.length === 0) {
		return;
	}

	const byBucket = new Map();
	for (const attachment of attachments) {
		const bucket = attachment.bucket_id || TASK_ATTACHMENTS_BUCKET;
		const existing = byBucket.get(bucket) ?? [];
		if (attachment.storage_path) {
			existing.push(attachment.storage_path);
		}
		byBucket.set(bucket, existing);
	}

	for (const [bucket, paths] of byBucket.entries()) {
		if (paths.length === 0) {
			continue;
		}

		const { error: removeStorageError } = await supabase.storage
			.from(bucket)
			.remove(paths);

		if (removeStorageError) {
			throw removeStorageError;
		}
	}

	const { error: deleteRowsError } = await supabase
		.from('task_attachments')
		.delete()
		.eq('task_id', taskId);

	if (deleteRowsError) {
		throw deleteRowsError;
	}
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
