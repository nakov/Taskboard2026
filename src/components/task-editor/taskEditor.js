import taskEditorTemplate from './taskEditor.html?raw';
import taskEditorStyles from './taskEditor.css?raw';

const IMAGE_MIME_PREFIX = 'image/';

export const renderTaskEditor = () => {
  return `<style>${taskEditorStyles}</style>${taskEditorTemplate}`;
};

export const createTaskEditor = ({ onSubmit }) => {
  const modalElement = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const taskIdInput = document.getElementById('task-id');
  const titleInput = document.getElementById('task-title-input');
  const descriptionInput = document.getElementById('task-description-input');
  const stageInput = document.getElementById('task-stage-input');
  const statusOpenRadio = document.getElementById('task-status-open');
  const statusDoneRadio = document.getElementById('task-status-done');
  const modalTitle = document.getElementById('task-modal-title');
  const submitButton = document.getElementById('task-submit-button');
  const attachmentsInput = document.getElementById('task-attachments-input');
  const attachmentsList = document.getElementById('task-attachments-list');

  if (
    !modalElement ||
    !form ||
    !taskIdInput ||
    !titleInput ||
    !descriptionInput ||
    !stageInput ||
    !statusOpenRadio ||
    !statusDoneRadio ||
    !modalTitle ||
    !submitButton ||
    !attachmentsInput ||
    !attachmentsList
  ) {
    return null;
  }

  const modal = new window.bootstrap.Modal(modalElement);

  const state = {
    existingAttachments: [],
    pendingFiles: [],
    removedAttachmentIds: new Set(),
    localPreviewUrls: new Map(),
    submitting: false
  };

  const clearLocalPreviewUrls = () => {
    for (const url of state.localPreviewUrls.values()) {
      URL.revokeObjectURL(url);
    }
    state.localPreviewUrls.clear();
  };

  const formatBytes = (size) => {
    if (!Number.isFinite(size) || size <= 0) {
      return '—';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }

    const decimals = index === 0 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[index]}`;
  };

  const isImageAttachment = (mimeType) => {
    return typeof mimeType === 'string' && mimeType.startsWith(IMAGE_MIME_PREFIX);
  };

  const renderAttachmentItem = (attachment) => {
    const isImage = Boolean(attachment.isImage);
    const safeName = escapeHtml(attachment.name || 'Attachment');
    const safeSize = escapeHtml(formatBytes(attachment.size ?? 0));
    const removeLabel = attachment.source === 'existing' ? 'Remove attachment' : 'Remove selected file';

    const previewHtml = isImage && attachment.previewUrl
      ? `<img src="${attachment.previewUrl}" alt="${safeName}" />`
      : '<i class="bi bi-file-earmark"></i>';

    const nameHtml = attachment.downloadUrl
      ? `<a href="${attachment.downloadUrl}" target="_blank" rel="noreferrer" class="task-attachment-name">${safeName}</a>`
      : `<span class="task-attachment-name">${safeName}</span>`;

    return `
      <div class="task-attachment-item" data-attachment-source="${attachment.source}" data-attachment-id="${attachment.id}">
        <div class="task-attachment-preview">${previewHtml}</div>
        <div class="task-attachment-meta">
          ${nameHtml}
          <span class="task-attachment-size">${safeSize}</span>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          data-action="remove-attachment"
          data-attachment-source="${attachment.source}"
          data-attachment-id="${attachment.id}"
          aria-label="${removeLabel}"
        >
          Remove
        </button>
      </div>
    `;
  };

  const renderAttachments = () => {
    const visibleExisting = state.existingAttachments.filter(
      (attachment) => !state.removedAttachmentIds.has(attachment.id)
    );

    const pending = state.pendingFiles.map((entry) => ({
      id: entry.id,
      source: 'pending',
      name: entry.file.name,
      size: entry.file.size,
      isImage: isImageAttachment(entry.file.type),
      previewUrl: state.localPreviewUrls.get(entry.id),
      downloadUrl: null
    }));

    const allAttachments = [...visibleExisting, ...pending];

    if (allAttachments.length === 0) {
      attachmentsList.innerHTML = '<div class="task-attachments-empty">No attachments</div>';
      return;
    }

    attachmentsList.innerHTML = allAttachments.map(renderAttachmentItem).join('');
  };

  const resetAttachmentState = () => {
    clearLocalPreviewUrls();
    state.existingAttachments = [];
    state.pendingFiles = [];
    state.removedAttachmentIds = new Set();
    attachmentsInput.value = '';
  };

  const setSubmitting = (isSubmitting) => {
    state.submitting = isSubmitting;
    submitButton.disabled = isSubmitting;
  };

  const updateStageOptions = (stages) => {
    stageInput.innerHTML = stages
      .map((stage) => `<option value="${stage.id}">${escapeHtml(stage.name)}</option>`)
      .join('');
  };

  const openCreate = ({ stageId = '', stages = [] }) => {
    updateStageOptions(stages);
    resetAttachmentState();
    taskIdInput.value = '';
    titleInput.value = '';
    descriptionInput.value = '';
    stageInput.value = stageId || stages[0]?.id || '';
    statusOpenRadio.checked = true;
    modalTitle.textContent = 'Create Task';
    submitButton.textContent = 'Create Task';
    renderAttachments();
    modal.show();
  };

  const openEdit = ({ task, stages = [], attachments = [] }) => {
    updateStageOptions(stages);
    resetAttachmentState();
    taskIdInput.value = task.id;
    titleInput.value = task.title ?? '';
    descriptionInput.value = task.description ?? '';
    stageInput.value = task.stage_id ?? stages[0]?.id ?? '';
    if (task.done) {
      statusDoneRadio.checked = true;
    } else {
      statusOpenRadio.checked = true;
    }
    modalTitle.textContent = 'Edit Task';
    submitButton.textContent = 'Save Changes';
    state.existingAttachments = attachments;
    renderAttachments();
    modal.show();
  };

  const close = () => {
    modal.hide();
  };

  const handleAttachmentsInputChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.files) {
      return;
    }

    const selected = Array.from(target.files);
    for (const file of selected) {
      const id = crypto.randomUUID();
      state.pendingFiles.push({ id, file });

      if (isImageAttachment(file.type)) {
        const objectUrl = URL.createObjectURL(file);
        state.localPreviewUrls.set(id, objectUrl);
      }
    }

    attachmentsInput.value = '';
    renderAttachments();
  };

  const handleAttachmentsListClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const removeButton = target.closest('[data-action="remove-attachment"]');
    if (!removeButton) {
      return;
    }

    const source = removeButton.getAttribute('data-attachment-source');
    const attachmentId = removeButton.getAttribute('data-attachment-id');
    if (!source || !attachmentId) {
      return;
    }

    if (source === 'existing') {
      state.removedAttachmentIds.add(attachmentId);
    }

    if (source === 'pending') {
      state.pendingFiles = state.pendingFiles.filter((entry) => entry.id !== attachmentId);
      const objectUrl = state.localPreviewUrls.get(attachmentId);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      state.localPreviewUrls.delete(attachmentId);
    }

    renderAttachments();
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (state.submitting) {
      return;
    }

    const taskId = taskIdInput.value.trim();
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const stageId = stageInput.value;
    const done = statusDoneRadio.checked;

    if (!title || !stageId || typeof onSubmit !== 'function') {
      return;
    }

    setSubmitting(true);

    try {
      const success = await onSubmit({
        taskId,
        title,
        description,
        stageId,
        done,
        newFiles: state.pendingFiles.map((entry) => entry.file),
        removeAttachmentIds: Array.from(state.removedAttachmentIds)
      });

      if (success) {
        close();
      }
    } finally {
      setSubmitting(false);
    }
  };

  attachmentsInput.addEventListener('change', handleAttachmentsInputChange);
  attachmentsList.addEventListener('click', handleAttachmentsListClick);
  form.addEventListener('submit', handleFormSubmit);

  modalElement.addEventListener('hidden.bs.modal', () => {
    resetAttachmentState();
    renderAttachments();
  });

  renderAttachments();

  return {
    openCreate,
    openEdit,
    close,
    updateStageOptions,
    setSubmitting,
    destroy: () => {
      clearLocalPreviewUrls();
      attachmentsInput.removeEventListener('change', handleAttachmentsInputChange);
      attachmentsList.removeEventListener('click', handleAttachmentsListClick);
      form.removeEventListener('submit', handleFormSubmit);
    }
  };
};

function escapeHtml(text) {
  if (!text) {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}