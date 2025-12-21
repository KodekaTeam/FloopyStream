// Upload Templates Management
let currentChannelUuid = null;
let currentEditingTemplate = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get channel UUID from URL
    const urlPath = window.location.pathname;
    const channelMatch = urlPath.match(/\/channels\/([a-f0-9-]+)/);
    if (channelMatch) {
        currentChannelUuid = channelMatch[1];
        loadTemplates();
    }
});

// Load templates for the current channel
async function loadTemplates() {
    if (!currentChannelUuid) {
        console.warn('Channel UUID not available yet');
        return;
    }

    try {
        const response = await fetch(`/api/channels/${currentChannelUuid}/upload-templates`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
            renderTemplates(data.data);
        } else {
            console.error('Failed to load templates:', data.message);
            showNotification('Failed to load templates: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        // console.error('Error loading templates:', error);
        // showNotification('Error loading templates: ' + error.message, 'error');
    }
}

// Render templates in the grid
function renderTemplates(templates) {
    const container = document.getElementById('templates-container');
    const emptyState = document.getElementById('empty-state');

    if (templates.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    container.innerHTML = templates.map(template => `
        <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-semibold text-white truncate mb-1">${escapeHtml(template.template_name)}</h3>
                    <p class="text-sm text-gray-400">
                        Created ${new Date(template.created_at).toLocaleDateString()}
                    </p>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <button onclick="editTemplate(${template.template_id})"
                            class="text-gray-400 hover:text-blue-400 transition-colors p-1"
                            title="Edit template">
                        <i class="ti ti-edit text-lg"></i>
                    </button>
                    <button onclick="duplicateTemplate(${template.template_id})"
                            class="text-gray-400 hover:text-green-400 transition-colors p-1"
                            title="Duplicate template">
                        <i class="ti ti-copy text-lg"></i>
                    </button>
                    <button onclick="deleteTemplate(${template.template_id}, '${escapeHtml(template.template_name)}')"
                            class="text-gray-400 hover:text-red-400 transition-colors p-1"
                            title="Delete template">
                        <i class="ti ti-trash text-lg"></i>
                    </button>
                </div>
            </div>

            <div class="space-y-3">
                ${template.template_title ? `
                    <div>
                        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Title</span>
                        <p class="text-sm text-gray-300 mt-1 truncate">${escapeHtml(template.template_title)}</p>
                    </div>
                ` : ''}

                ${template.template_description ? `
                    <div>
                        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
                        <p class="text-sm text-gray-300 mt-1 line-clamp-2">${escapeHtml(template.template_description.substring(0, 100))}${template.template_description.length > 100 ? '...' : ''}</p>
                    </div>
                ` : ''}

                ${template.template_tags && template.template_tags.length > 0 ? `
                    <div>
                        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Tags</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${template.template_tags.slice(0, 3).map(tag => `
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-300">
                                    ${escapeHtml(tag)}
                                </span>
                            `).join('')}
                            ${template.template_tags.length > 3 ? `<span class="text-xs text-gray-500">+${template.template_tags.length - 3} more</span>` : ''}
                        </div>
                    </div>
                ` : ''}

                <div class="flex items-center justify-between pt-2 border-t border-gray-700">
                    <div class="flex items-center space-x-4 text-xs text-gray-400">
                        <span class="flex items-center">
                            <i class="ti ti-eye mr-1"></i>
                            ${template.template_visibility || 'private'}
                        </span>
                        <span class="flex items-center">
                            <i class="ti ti-users mr-1"></i>
                            ${template.template_audience === 'made_for_kids' ? 'Kids' : 'Not Kids'}
                        </span>
                        ${template.auto_schedule ? `
                            <span class="flex items-center text-green-400">
                                <i class="ti ti-calendar mr-1"></i>
                                Auto
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Create new template
function createNewTemplate() {
    currentEditingTemplate = null;
    document.getElementById('modal-title').textContent = 'Create Upload Template';
    document.getElementById('submit-text').textContent = 'Create Template';
    document.getElementById('template-form').reset();
    // Reset character counter
    const templateTitleCounter = document.getElementById('templateTitleCounter');
    if (templateTitleCounter) {
        templateTitleCounter.textContent = '0/100';
        templateTitleCounter.classList.remove('text-amber-400');
        templateTitleCounter.classList.add('text-gray-400');
    }
    document.getElementById('template-modal').classList.remove('hidden');
}

// Edit existing template
async function editTemplate(templateId) {
    try {
        if (!currentChannelUuid) {
            throw new Error('Channel UUID not found. Please reload the page.');
        }

        const response = await fetch(`/api/channels/${currentChannelUuid}/upload-templates`);
        const data = await response.json();

        console.log('Edit template response:', { data, templateId });

        if (data.success && data.data) {
            const template = data.data.find(t => t.template_id === templateId);
            if (template) {
                currentEditingTemplate = template;
                populateForm(template);
                document.getElementById('modal-title').textContent = 'Edit Upload Template';
                document.getElementById('submit-text').textContent = 'Update Template';
                document.getElementById('template-modal').classList.remove('hidden');
            } else {
                throw new Error(`Template with ID ${templateId} not found in response`);
            }
        } else {
            throw new Error(data.message || 'Failed to load templates');
        }
    } catch (error) {
        console.error('Error loading template for edit:', error);
        showNotification(`Error loading template: ${error.message}`, 'error');
    }
}

// Populate form with template data
function populateForm(template) {
    document.getElementById('template-name').value = template.template_name || '';
    const titleInput = document.getElementById('template-title');
    titleInput.value = template.template_title || '';
    // Update character counter after populating
    updateTemplateTitleCounter(titleInput);
    document.getElementById('template-description').value = template.template_description || '';
    document.getElementById('template-tags').value = template.template_tags ? template.template_tags.join(', ') : '';
    document.getElementById('template-category').value = template.template_category || '';
    document.getElementById('template-license').value = template.template_license || 'youtube';
    document.getElementById('template-visibility').value = template.template_visibility || 'private';
    document.getElementById('template-audience').value = template.template_audience || 'not_for_kids';
    document.getElementById('template-comment').value = template.template_comment || 'active';
    document.getElementById('template-moderation').value = template.template_moderation || 'none';
    document.getElementById('auto-schedule').checked = template.auto_schedule === 1;
}

// Close modal
function closeTemplateModal() {
    document.getElementById('template-modal').classList.add('hidden');
    document.getElementById('template-form').reset();
    // Reset character counter
    const templateTitleCounter = document.getElementById('templateTitleCounter');
    if (templateTitleCounter) {
        templateTitleCounter.textContent = '0/100';
        templateTitleCounter.classList.remove('text-amber-400');
        templateTitleCounter.classList.add('text-gray-400');
    }
    currentEditingTemplate = null;
}

// Handle form submission
document.getElementById('template-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const templateData = {
        template_name: formData.get('template_name'),
        template_title: formData.get('template_title'),
        template_description: formData.get('template_description'),
        template_tags: formData.get('template_tags'),
        template_category: formData.get('template_category'),
        template_license: formData.get('template_license'),
        template_visibility: formData.get('template_visibility'),
        template_audience: formData.get('template_audience'),
        template_comment: formData.get('template_comment'),
        template_moderation: formData.get('template_moderation'),
        auto_schedule: formData.get('auto_schedule') === 'on'
    };

    try {
        let response;
        if (currentEditingTemplate) {
            // Update existing template
            response = await fetch(`/api/channels/${currentChannelUuid}/upload-templates/${currentEditingTemplate.template_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(templateData)
            });
        } else {
            // Create new template
            response = await fetch(`/api/channels/${currentChannelUuid}/upload-templates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(templateData)
            });
        }

        const data = await response.json();

        if (data.success) {
            showNotification(currentEditingTemplate ? 'Template updated successfully' : 'Template created successfully', 'success');
            closeTemplateModal();
            loadTemplates();
        } else {
            showNotification(data.message || 'Failed to save template', 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Error saving template', 'error');
    }
});

// Duplicate template
async function duplicateTemplate(templateId) {
    try {
        const response = await fetch(`/api/channels/${currentChannelUuid}/upload-templates`);
        const data = await response.json();

        if (data.success) {
            const template = data.data.find(t => t.template_id === templateId);
            if (template) {
                const newName = `${template.template_name} (Copy)`;
                // Create duplicate via API
                const duplicateData = {
                    template_name: newName,
                    template_title: template.template_title,
                    template_description: template.template_description,
                    template_tags: template.template_tags ? template.template_tags.join(', ') : '',
                    template_category: template.template_category,
                    template_license: template.template_license,
                    template_visibility: template.template_visibility,
                    template_audience: template.template_audience,
                    template_comment: template.template_comment,
                    template_moderation: template.template_moderation,
                    auto_schedule: template.auto_schedule === 1
                };

                const createResponse = await fetch(`/api/channels/${currentChannelUuid}/upload-templates`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(duplicateData)
                });

                const createData = await createResponse.json();
                if (createData.success) {
                    showNotification('Template duplicated successfully', 'success');
                    loadTemplates();
                } else {
                    showNotification('Failed to duplicate template', 'error');
                }
            }
        }
    } catch (error) {
        console.error('Error duplicating template:', error);
        showNotification('Error duplicating template', 'error');
    }
}

// Delete template
async function deleteTemplate(templateId, templateName) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: "top",
          title: "Delete Template?",
          html: `Are you sure you want to delete the template <strong>"${escapeHtml(
            templateName
          )}"</strong>?<br><br><small class="text-gray-400">This action cannot be undone.</small>`,
          icon: "error",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#3085d6",
          confirmButtonText: "Yes, delete it!",
          cancelButtonText: "Cancel",
        }).then((result) => {
          if (result.isConfirmed) {
            deleteTemplateProcess(templateId);
          }
        });
    } else {
        if (!confirm(`Are you sure you want to delete the template "${templateName}"? This action cannot be undone.`)) {
            return;
        }
        deleteTemplateProcess(templateId);
    }
}

async function deleteTemplateProcess(templateId) {
    try {
        if (!currentChannelUuid) {
            throw new Error('Channel UUID not found. Please reload the page.');
        }

        const response = await fetch(`/api/channels/${currentChannelUuid}/upload-templates/${templateId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top',
                    icon: 'success',
                    title: 'Template deleted successfully',
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true
                }).then(() => {
                    loadTemplates();
                });
            } else {
                showNotification('Template deleted successfully', 'success');
                loadTemplates();
            }
        } else {
            throw new Error(data.message || 'Failed to delete template');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'error',
                title: 'Error deleting template',
                html: error.message,
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } else {
            showNotification('Error: ' + error.message, 'error');
        }
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Character counter functions for template title
function updateTemplateTitleCounter(input) {
  const counter = document.getElementById('templateTitleCounter');
  if (counter) {
    const length = input.value.length;
    counter.textContent = `${length}/100`;
    
    // Change color when nearing limit (80+ characters)
    if (length >= 80) {
      counter.classList.remove('text-gray-400');
      counter.classList.add('text-amber-400');
    } else {
      counter.classList.remove('text-amber-400');
      counter.classList.add('text-gray-400');
    }
  }
}

function updateEditTemplateTitleCounter(input) {
  const counter = document.getElementById('editTemplateTitleCounter');
  if (counter) {
    const length = input.value.length;
    counter.textContent = `${length}/100`;
    
    // Change color when nearing limit (80+ characters)
    if (length >= 80) {
      counter.classList.remove('text-gray-400');
      counter.classList.add('text-amber-400');
    } else {
      counter.classList.remove('text-amber-400');
      counter.classList.add('text-gray-400');
    }
  }
}

// Edit template modal functions (for separate edit modal if needed)
function closeEditTemplateModal() {
    const modal = document.getElementById('edit-template-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    const form = document.getElementById('edit-template-form');
    if (form) {
        form.reset();
    }
    // Reset character counter
    const editTemplateTitleCounter = document.getElementById('editTemplateTitleCounter');
    if (editTemplateTitleCounter) {
        editTemplateTitleCounter.textContent = '0/100';
        editTemplateTitleCounter.classList.remove('text-amber-400');
        editTemplateTitleCounter.classList.add('text-gray-400');
    }
}

function populateEditForm(template) {
    document.getElementById('edit-template-uuid').value = template.template_uuid || '';
    document.getElementById('edit-template-name').value = template.template_name || '';
    const titleInput = document.getElementById('edit-template-title');
    titleInput.value = template.template_title || '';
    // Update character counter after populating
    updateEditTemplateTitleCounter(titleInput);
    document.getElementById('edit-template-description').value = template.template_description || '';
    document.getElementById('edit-template-tags').value = template.template_tags ? template.template_tags.join(', ') : '';
    document.getElementById('edit-template-category').value = template.template_category || '';
    document.getElementById('edit-template-license').value = template.template_license || 'youtube';
    document.getElementById('edit-template-visibility').value = template.template_visibility || 'private';
    document.getElementById('edit-template-audience').value = template.template_audience || 'not_for_kids';
    document.getElementById('edit-template-comment').value = template.template_comment || 'active';
    document.getElementById('edit-template-moderation').value = template.template_moderation || 'none';
    document.getElementById('edit-auto-schedule').checked = template.auto_schedule === 1;
}

function showNotification(message, type = 'info') {
    // Simple notification - you might want to use a more sophisticated notification system
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 ${
        type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        'bg-blue-600'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}