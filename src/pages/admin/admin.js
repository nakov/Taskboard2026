import adminTemplate from './admin.html?raw';
import { supabase } from '../../lib/supabaseClient';

const state = {
  projects: [],
  stagesByProject: new Map(),
  tasksByProject: new Map(),
  selectedStagesProjectId: null,
  selectedTasksProjectId: null
};

const redirectTo = (path, { replace = false } = {}) => {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const renderAdminPage = () => adminTemplate;

export const initAdminPage = async () => {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    redirectTo('/login', { replace: true });
    return;
  }

  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || !isAdmin) {
    redirectTo('/dashboard', { replace: true });
    return;
  }

  bindEvents();
  await loadProjects();
};

const dom = {
  projects: {
    refresh: () => document.querySelector('[data-projects-refresh]'),
    table: () => document.querySelector('[data-projects-table]'),
    error: () => document.querySelector('[data-projects-error]'),
    form: () => document.querySelector('[data-projects-form]'),
    id: () => document.querySelector('[data-project-id]'),
    title: () => document.querySelector('[data-project-title]'),
    description: () => document.querySelector('[data-project-description]'),
    status: () => document.querySelector('[data-projects-status]'),
    clear: () => document.querySelector('[data-project-clear]')
  },
  stages: {
    refresh: () => document.querySelector('[data-stages-refresh]'),
    projectSelect: () => document.querySelector('[data-stages-project-select]'),
    table: () => document.querySelector('[data-stages-table]'),
    error: () => document.querySelector('[data-stages-error]'),
    form: () => document.querySelector('[data-stages-form]'),
    id: () => document.querySelector('[data-stage-id]'),
    name: () => document.querySelector('[data-stage-name]'),
    position: () => document.querySelector('[data-stage-position]'),
    status: () => document.querySelector('[data-stages-status]'),
    clear: () => document.querySelector('[data-stage-clear]')
  },
  tasks: {
    refresh: () => document.querySelector('[data-tasks-refresh]'),
    projectSelect: () => document.querySelector('[data-tasks-project-select]'),
    table: () => document.querySelector('[data-tasks-table]'),
    error: () => document.querySelector('[data-tasks-error]'),
    form: () => document.querySelector('[data-tasks-form]'),
    id: () => document.querySelector('[data-task-id]'),
    title: () => document.querySelector('[data-task-title]'),
    description: () => document.querySelector('[data-task-description]'),
    stage: () => document.querySelector('[data-task-stage]'),
    position: () => document.querySelector('[data-task-position]'),
    done: () => document.querySelector('[data-task-done]'),
    status: () => document.querySelector('[data-tasks-status]'),
    clear: () => document.querySelector('[data-task-clear]')
  }
};

const bindEvents = () => {
  dom.projects.refresh()?.addEventListener('click', () => loadProjects());
  dom.projects.form()?.addEventListener('submit', handleProjectSave);
  dom.projects.clear()?.addEventListener('click', clearProjectForm);
  dom.projects.table()?.addEventListener('click', handleProjectTableClick);

  dom.stages.refresh()?.addEventListener('click', () => {
    const projectId = dom.stages.projectSelect()?.value;
    if (projectId) {
      loadStages(projectId);
    }
  });
  dom.stages.projectSelect()?.addEventListener('change', (event) => {
    const projectId = event.target.value;
    if (projectId) {
      loadStages(projectId);
    }
  });
  dom.stages.form()?.addEventListener('submit', handleStageSave);
  dom.stages.clear()?.addEventListener('click', clearStageForm);
  dom.stages.table()?.addEventListener('click', handleStageTableClick);

  dom.tasks.refresh()?.addEventListener('click', () => {
    const projectId = dom.tasks.projectSelect()?.value;
    if (projectId) {
      loadTasks(projectId);
    }
  });
  dom.tasks.projectSelect()?.addEventListener('change', (event) => {
    const projectId = event.target.value;
    if (projectId) {
      loadTasks(projectId);
    }
  });
  dom.tasks.form()?.addEventListener('submit', handleTaskSave);
  dom.tasks.clear()?.addEventListener('click', clearTaskForm);
  dom.tasks.table()?.addEventListener('click', handleTaskTableClick);
};

const loadProjects = async () => {
  setError(dom.projects.error(), '');
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, description, owner_id, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    state.projects = projects ?? [];
    renderProjectsTable();
    populateProjectSelects();
  } catch (error) {
    console.error('Error loading projects:', error);
    setError(dom.projects.error(), 'Failed to load projects.');
  }
};

const renderProjectsTable = () => {
  const tbody = dom.projects.table();
  if (!tbody) return;

  if (state.projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-body-secondary py-4">No projects found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.projects.map(project => `
    <tr data-project-row="${project.id}">
      <td>
        <strong>${escapeHtml(project.title)}</strong>
      </td>
      <td>${project.description ? escapeHtml(project.description) : '<span class="text-body-secondary">—</span>'}</td>
      <td><small class="text-body-secondary">${escapeHtml(project.owner_id)}</small></td>
      <td><small class="text-body-secondary">${formatDate(project.created_at)}</small></td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <a class="btn btn-outline-primary" href="/projects/${project.id}" data-link>
            <i class="bi bi-eye"></i>
          </a>
          <button class="btn btn-outline-secondary" type="button" data-project-action="edit" data-project-id="${project.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger" type="button" data-project-action="delete" data-project-id="${project.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
};

const populateProjectSelects = () => {
  const stagesSelect = dom.stages.projectSelect();
  const tasksSelect = dom.tasks.projectSelect();

  const options = state.projects.map(project => `
    <option value="${project.id}">${escapeHtml(project.title)}</option>
  `).join('');

  if (stagesSelect) {
    stagesSelect.innerHTML = options || '<option value="">No projects</option>';
  }
  if (tasksSelect) {
    tasksSelect.innerHTML = options || '<option value="">No projects</option>';
  }

  if (state.projects.length > 0) {
    const defaultProjectId = state.projects[0].id;

    if (stagesSelect) {
      stagesSelect.value = defaultProjectId;
      loadStages(defaultProjectId);
    }

    if (tasksSelect) {
      tasksSelect.value = defaultProjectId;
      loadTasks(defaultProjectId);
    }
  } else {
    clearStageForm();
    clearTaskForm();
    renderStagesTable([]);
    renderTasksTable([]);
    updateTaskStageOptions([]);
  }
};

const handleProjectTableClick = (event) => {
  const button = event.target.closest('[data-project-action]');
  if (!button) return;

  const projectId = button.getAttribute('data-project-id');
  const action = button.getAttribute('data-project-action');
  const project = state.projects.find(item => item.id === projectId);

  if (!project) return;

  if (action === 'edit') {
    fillProjectForm(project);
    return;
  }

  if (action === 'delete') {
    void deleteProject(project);
  }
};

const fillProjectForm = (project) => {
  dom.projects.id().value = project.id;
  dom.projects.title().value = project.title ?? '';
  dom.projects.description().value = project.description ?? '';
  setStatus(dom.projects.status(), `Editing project ${project.title}.`);
};

const clearProjectForm = () => {
  if (dom.projects.id()) dom.projects.id().value = '';
  if (dom.projects.title()) dom.projects.title().value = '';
  if (dom.projects.description()) dom.projects.description().value = '';
  setStatus(dom.projects.status(), '');
};

const handleProjectSave = async (event) => {
  event.preventDefault();

  const projectId = dom.projects.id().value;
  if (!projectId) {
    setStatus(dom.projects.status(), 'Select a project to edit.');
    return;
  }

  const title = dom.projects.title().value.trim();
  const description = dom.projects.description().value.trim();

  if (!title) {
    setStatus(dom.projects.status(), 'Project title is required.');
    return;
  }

  try {
    const { error } = await supabase
      .from('projects')
      .update({
        title,
        description: description || null
      })
      .eq('id', projectId);

    if (error) throw error;

    setStatus(dom.projects.status(), 'Project updated.');
    await loadProjects();
  } catch (error) {
    console.error('Error updating project:', error);
    setStatus(dom.projects.status(), 'Failed to update project.');
  }
};

const deleteProject = async (project) => {
  const confirmed = window.confirm(`Delete project "${project.title}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', project.id);

    if (error) throw error;

    setStatus(dom.projects.status(), 'Project deleted.');
    await loadProjects();
  } catch (error) {
    console.error('Error deleting project:', error);
    setStatus(dom.projects.status(), 'Failed to delete project.');
  }
};

const loadStages = async (projectId) => {
  if (!projectId) return;
  state.selectedStagesProjectId = projectId;
  setError(dom.stages.error(), '');

  try {
    const { data: stages, error } = await supabase
      .from('project_stages')
      .select('id, name, position, project_id')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) throw error;

    const list = stages ?? [];
    state.stagesByProject.set(projectId, list);
    renderStagesTable(list);
    updateTaskStageOptions(list);
  } catch (error) {
    console.error('Error loading stages:', error);
    setError(dom.stages.error(), 'Failed to load project stages.');
  }
};

const renderStagesTable = (stages) => {
  const tbody = dom.stages.table();
  if (!tbody) return;

  if (!stages || stages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-body-secondary py-4">No stages found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = stages.map(stage => `
    <tr>
      <td>${escapeHtml(stage.name)}</td>
      <td class="text-center">${stage.position}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-secondary" type="button" data-stage-action="edit" data-stage-id="${stage.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger" type="button" data-stage-action="delete" data-stage-id="${stage.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
};

const handleStageTableClick = (event) => {
  const button = event.target.closest('[data-stage-action]');
  if (!button) return;

  const stageId = button.getAttribute('data-stage-id');
  const action = button.getAttribute('data-stage-action');
  const projectId = state.selectedStagesProjectId;
  const stages = state.stagesByProject.get(projectId) ?? [];
  const stage = stages.find(item => item.id === stageId);

  if (!stage) return;

  if (action === 'edit') {
    fillStageForm(stage);
    return;
  }

  if (action === 'delete') {
    void deleteStage(stage);
  }
};

const fillStageForm = (stage) => {
  dom.stages.id().value = stage.id;
  dom.stages.name().value = stage.name ?? '';
  dom.stages.position().value = stage.position ?? 0;
  setStatus(dom.stages.status(), `Editing stage ${stage.name}.`);
};

const clearStageForm = () => {
  if (dom.stages.id()) dom.stages.id().value = '';
  if (dom.stages.name()) dom.stages.name().value = '';
  if (dom.stages.position()) dom.stages.position().value = '';
  setStatus(dom.stages.status(), '');
};

const handleStageSave = async (event) => {
  event.preventDefault();

  const stageId = dom.stages.id().value;
  if (!stageId) {
    setStatus(dom.stages.status(), 'Select a stage to edit.');
    return;
  }

  const name = dom.stages.name().value.trim();
  const positionValue = dom.stages.position().value;
  const position = Number(positionValue);

  if (!name) {
    setStatus(dom.stages.status(), 'Stage name is required.');
    return;
  }

  if (Number.isNaN(position)) {
    setStatus(dom.stages.status(), 'Stage position must be a number.');
    return;
  }

  try {
    const { error } = await supabase
      .from('project_stages')
      .update({ name, position })
      .eq('id', stageId);

    if (error) throw error;

    setStatus(dom.stages.status(), 'Stage updated.');
    await loadStages(state.selectedStagesProjectId);
  } catch (error) {
    console.error('Error updating stage:', error);
    setStatus(dom.stages.status(), 'Failed to update stage.');
  }
};

const deleteStage = async (stage) => {
  const confirmed = window.confirm(`Delete stage "${stage.name}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('project_stages')
      .delete()
      .eq('id', stage.id);

    if (error) throw error;

    setStatus(dom.stages.status(), 'Stage deleted.');
    await loadStages(state.selectedStagesProjectId);
  } catch (error) {
    console.error('Error deleting stage:', error);
    setStatus(dom.stages.status(), 'Failed to delete stage.');
  }
};

const loadTasks = async (projectId) => {
  if (!projectId) return;
  state.selectedTasksProjectId = projectId;
  setError(dom.tasks.error(), '');

  try {
    const stages = await ensureStages(projectId);
    updateTaskStageOptions(stages);

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, description, stage_id, position, done, created_at, project_id')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) throw error;

    const list = tasks ?? [];
    state.tasksByProject.set(projectId, list);
    renderTasksTable(list, stages);
  } catch (error) {
    console.error('Error loading tasks:', error);
    setError(dom.tasks.error(), 'Failed to load tasks.');
  }
};

const renderTasksTable = (tasks, stages) => {
  const tbody = dom.tasks.table();
  if (!tbody) return;

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-body-secondary py-4">No tasks found.</td>
      </tr>
    `;
    return;
  }

  const stageLookup = new Map((stages ?? []).map(stage => [stage.id, stage.name]));

  tbody.innerHTML = tasks.map(task => `
    <tr>
      <td>
        <strong>${escapeHtml(task.title)}</strong>
        ${task.description ? `<small class="text-body-secondary">${escapeHtml(task.description)}</small>` : ''}
      </td>
      <td>${escapeHtml(stageLookup.get(task.stage_id) ?? '—')}</td>
      <td class="text-center">${task.done ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
      <td class="text-center">${task.position ?? 0}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-secondary" type="button" data-task-action="edit" data-task-id="${task.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger" type="button" data-task-action="delete" data-task-id="${task.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
};

const handleTaskTableClick = (event) => {
  const button = event.target.closest('[data-task-action]');
  if (!button) return;

  const taskId = button.getAttribute('data-task-id');
  const action = button.getAttribute('data-task-action');
  const projectId = state.selectedTasksProjectId;
  const tasks = state.tasksByProject.get(projectId) ?? [];
  const task = tasks.find(item => item.id === taskId);

  if (!task) return;

  if (action === 'edit') {
    fillTaskForm(task);
    return;
  }

  if (action === 'delete') {
    void deleteTask(task);
  }
};

const fillTaskForm = (task) => {
  dom.tasks.id().value = task.id;
  dom.tasks.title().value = task.title ?? '';
  dom.tasks.description().value = task.description ?? '';
  dom.tasks.position().value = task.position ?? 0;
  dom.tasks.done().checked = Boolean(task.done);
  if (task.stage_id) {
    dom.tasks.stage().value = task.stage_id;
  }
  setStatus(dom.tasks.status(), `Editing task ${task.title}.`);
};

const clearTaskForm = () => {
  if (dom.tasks.id()) dom.tasks.id().value = '';
  if (dom.tasks.title()) dom.tasks.title().value = '';
  if (dom.tasks.description()) dom.tasks.description().value = '';
  if (dom.tasks.position()) dom.tasks.position().value = '';
  if (dom.tasks.done()) dom.tasks.done().checked = false;
  setStatus(dom.tasks.status(), '');
};

const handleTaskSave = async (event) => {
  event.preventDefault();

  const taskId = dom.tasks.id().value;
  if (!taskId) {
    setStatus(dom.tasks.status(), 'Select a task to edit.');
    return;
  }

  const title = dom.tasks.title().value.trim();
  const description = dom.tasks.description().value.trim();
  const positionValue = dom.tasks.position().value;
  const position = Number(positionValue);
  const stageId = dom.tasks.stage().value;
  const done = dom.tasks.done().checked;

  if (!title) {
    setStatus(dom.tasks.status(), 'Task title is required.');
    return;
  }

  if (!stageId) {
    setStatus(dom.tasks.status(), 'Select a stage.');
    return;
  }

  if (Number.isNaN(position)) {
    setStatus(dom.tasks.status(), 'Task position must be a number.');
    return;
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .update({
        title,
        description: description || null,
        position,
        stage_id: stageId,
        done
      })
      .eq('id', taskId);

    if (error) throw error;

    setStatus(dom.tasks.status(), 'Task updated.');
    await loadTasks(state.selectedTasksProjectId);
  } catch (error) {
    console.error('Error updating task:', error);
    setStatus(dom.tasks.status(), 'Failed to update task.');
  }
};

const deleteTask = async (task) => {
  const confirmed = window.confirm(`Delete task "${task.title}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (error) throw error;

    setStatus(dom.tasks.status(), 'Task deleted.');
    await loadTasks(state.selectedTasksProjectId);
  } catch (error) {
    console.error('Error deleting task:', error);
    setStatus(dom.tasks.status(), 'Failed to delete task.');
  }
};

const ensureStages = async (projectId) => {
  if (state.stagesByProject.has(projectId)) {
    return state.stagesByProject.get(projectId);
  }

  const { data: stages, error } = await supabase
    .from('project_stages')
    .select('id, name, position, project_id')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) throw error;

  const list = stages ?? [];
  state.stagesByProject.set(projectId, list);
  return list;
};

const updateTaskStageOptions = (stages) => {
  const stageSelect = dom.tasks.stage();
  if (!stageSelect) return;

  if (!stages || stages.length === 0) {
    stageSelect.innerHTML = '<option value="">No stages available</option>';
    return;
  }

  stageSelect.innerHTML = stages.map(stage => `
    <option value="${stage.id}">${escapeHtml(stage.name)}</option>
  `).join('');
};

const setError = (element, message) => {
  if (!element) return;
  if (!message) {
    element.textContent = '';
    element.classList.add('d-none');
    return;
  }

  element.textContent = message;
  element.classList.remove('d-none');
};

const setStatus = (element, message) => {
  if (!element) return;
  element.textContent = message || '';
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};
