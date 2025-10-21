// Content/Gallery JavaScript
// Handles video gallery interactions

// Upload dropdown toggle
function toggleUploadDropdown() {
  const dropdown = document.getElementById('uploadDropdown');
  dropdown.classList.toggle('hidden');
}

function closeUploadDropdown() {
  const dropdown = document.getElementById('uploadDropdown');
  dropdown.classList.add('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const container = document.getElementById('uploadDropdownContainer');
  const dropdown = document.getElementById('uploadDropdown');
  
  if (container && dropdown && !container.contains(event.target)) {
    dropdown.classList.add('hidden');
  }
});

// Modal functions
function openUploadModal() {
  document.getElementById('uploadModal').classList.remove('hidden');
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.add('hidden');
  document.getElementById('uploadForm').reset();
  document.getElementById('fileInfo').classList.add('hidden');
  document.getElementById('uploadProgress').classList.add('hidden');
}

function openImportDriveModal() {
  showNotification('Google Drive import feature coming soon!', 'info');
}

// File upload handling
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('videoFileInput');

dropZone?.addEventListener('click', () => {
  fileInput.click();
});

dropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-blue-500', 'bg-gray-700');
});

dropZone?.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-blue-500', 'bg-gray-700');
});

dropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-blue-500', 'bg-gray-700');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fileInput.files = files;
    showFileInfo(files[0]);
  }
});

fileInput?.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    showFileInfo(e.target.files[0]);
  }
});

function showFileInfo(file) {
  const fileInfo = document.getElementById('fileInfo');
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  fileInfo.textContent = `Selected: ${file.name} (${sizeMB} MB)`;
  fileInfo.classList.remove('hidden');
}

// Handle upload form submission
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const progressBar = document.getElementById('uploadProgressBar');
  const progressPercent = document.getElementById('uploadPercent');
  const progressContainer = document.getElementById('uploadProgress');
  const uploadButton = document.getElementById('uploadButton');
  
  // Show progress
  progressContainer.classList.remove('hidden');
  uploadButton.disabled = true;
  uploadButton.textContent = 'Uploading...';
  
  try {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = percent + '%';
        progressPercent.textContent = percent;
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        if (result.success) {
          showNotification('Video uploaded successfully!', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          showNotification(result.message || 'Upload failed', 'error');
          uploadButton.disabled = false;
          uploadButton.textContent = 'Upload';
        }
      } else {
        showNotification('Upload failed', 'error');
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload';
      }
    });
    
    xhr.addEventListener('error', () => {
      showNotification('Upload failed', 'error');
      uploadButton.disabled = false;
      uploadButton.textContent = 'Upload';
    });
    
    xhr.open('POST', '/api/content/upload');
    xhr.send(formData);
    
  } catch (error) {
    console.error('Error:', error);
    showNotification('Upload failed', 'error');
    uploadButton.disabled = false;
    uploadButton.textContent = 'Upload';
  }
});

// Video actions
async function playVideo(contentId) {
  try {
    const response = await fetch(`/api/content/${contentId}`);
    const result = await response.json();
    
    if (result.success && result.content) {
      const content = result.content;
      
      // Get video element
      const video = document.getElementById('previewVideo');
      const source = document.getElementById('previewSource');
      
      // Reset video first
      video.pause();
      video.currentTime = 0;
      video.muted = false; // Ensure not muted
      
      // Update source
      source.src = `/storage/uploads/${content.filename}`;
      source.type = 'video/mp4';
      
      // Update modal content
      document.getElementById('previewTitle').textContent = content.title;
      document.getElementById('previewDuration').textContent = formatDuration(content.duration_seconds);
      document.getElementById('previewSize').textContent = formatFileSize(content.filesize);
      document.getElementById('previewResolution').textContent = content.resolution || 'N/A';
      document.getElementById('previewFormat').textContent = content.filename.split('.').pop().toUpperCase();
      
      // Show modal first
      document.getElementById('previewModal').classList.remove('hidden');
      
      // Load and autoplay video
      video.load();
      
      // Wait for enough data to play
      video.addEventListener('canplay', function autoplayHandler() {
        // Remove this event listener after first trigger
        video.removeEventListener('canplay', autoplayHandler);
        
        // Try to autoplay
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('Video autoplay started successfully');
          }).catch(err => {
            console.log('Autoplay prevented:', err.message);
            // If autoplay fails, user can still click play button
          });
        }
      }, { once: true });
    } else {
      showNotification('Failed to load video', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to load video', 'error');
  }
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  const video = document.getElementById('previewVideo');
  
  // Pause and reset video
  video.pause();
  video.currentTime = 0;
  
  // Hide modal
  modal.classList.add('hidden');
}

function useForStream(contentId) {
  // Redirect to dashboard with content selected
  window.location.href = `/dashboard?selectContent=${contentId}`;
}

async function editVideo(contentId) {
  try {
    const response = await fetch(`/api/content/${contentId}`);
    const result = await response.json();
    
    if (result.success && result.content) {
      const content = result.content;
      
      // Populate form
      document.getElementById('editContentId').value = content.content_id;
      document.getElementById('editTitle').value = content.title;
      document.getElementById('editDescription').value = content.description || '';
      document.getElementById('editDuration').value = formatDuration(content.duration_seconds);
      document.getElementById('editResolution').value = content.resolution || 'N/A';
      document.getElementById('editFileSize').value = formatFileSize(content.filesize);
      
      // Set video preview instead of thumbnail
      const videoPreview = document.getElementById('editVideoPreview');
      const videoSource = document.getElementById('editVideoSource');
      const videoPath = `/storage/uploads/${content.filename}`;
      
      videoSource.src = videoPath;
      videoPreview.load();
      
      console.log('Edit modal - Video path:', videoPath);
      console.log('Edit modal - Resolution:', content.resolution);
      
      // Show modal
      document.getElementById('editModal').classList.remove('hidden');
    } else {
      showNotification('Failed to load video details', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to load video details', 'error');
  }
}

function closeEditModal() {
  // Stop video playback
  const videoPreview = document.getElementById('editVideoPreview');
  if (videoPreview) {
    videoPreview.pause();
    videoPreview.currentTime = 0;
  }
  
  document.getElementById('editModal').classList.add('hidden');
  document.getElementById('editForm').reset();
}

async function deleteVideo(contentId) {
  if (!confirm('Delete this video? This action cannot be undone.')) return;
  
  try {
    const response = await fetch(`/api/content/${contentId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Video deleted', 'success');
      setTimeout(() => location.reload(), 500);
    } else {
      showNotification(result.message || 'Failed to delete video', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to delete video', 'error');
  }
}

// Search videos
document.getElementById('searchVideos')?.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const videoCards = document.querySelectorAll('#videoGrid > div');
  
  videoCards.forEach(card => {
    const title = card.querySelector('h3').textContent.toLowerCase();
    card.style.display = title.includes(searchTerm) ? '' : 'none';
  });
});

// Sort videos
document.getElementById('sortSelect')?.addEventListener('change', (e) => {
  const sortBy = e.target.value;
  const videoGrid = document.getElementById('videoGrid');
  const videos = Array.from(videoGrid?.children || []);
  
  videos.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.dataset.date - a.dataset.date;
      case 'oldest':
        return a.dataset.date - b.dataset.date;
      case 'name':
        const titleA = a.querySelector('h3').textContent;
        const titleB = b.querySelector('h3').textContent;
        return titleA.localeCompare(titleB);
      case 'size':
        return b.dataset.size - a.dataset.size;
      default:
        return 0;
    }
  });
  
  videos.forEach(video => videoGrid.appendChild(video));
});

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform translate-x-0 ${
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' :
    type === 'info' ? 'bg-blue-600' : 'bg-gray-600'
  } text-white`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Handle edit form submission
document.getElementById('editForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const contentId = document.getElementById('editContentId').value;
  const title = document.getElementById('editTitle').value;
  const description = document.getElementById('editDescription').value;
  
  try {
    const response = await fetch(`/api/content/${contentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, description })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Video updated successfully!', 'success');
      setTimeout(() => location.reload(), 500);
    } else {
      showNotification(result.message || 'Failed to update video', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to update video', 'error');
  }
});

// Google Drive Functions
function openImportDriveModal() {
  document.getElementById('importDriveModal').classList.remove('hidden');
}

function closeImportDriveModal() {
  document.getElementById('importDriveModal').classList.add('hidden');
  document.getElementById('importDriveForm').reset();
  document.getElementById('driveImportProgress').classList.add('hidden');
}

// Handle import drive form submission
document.getElementById('importDriveForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const driveUrl = document.getElementById('driveUrl').value.trim();
  const title = document.getElementById('driveVideoTitle').value.trim();
  const description = document.getElementById('driveVideoDescription').value.trim();
  
  if (!driveUrl) {
    showNotification('Please enter Google Drive link', 'error');
    return;
  }
  
  const progressContainer = document.getElementById('driveImportProgress');
  const progressBar = document.getElementById('driveProgressBar');
  const progressText = document.getElementById('driveProgressText');
  const importBtn = document.getElementById('importDriveBtn');
  
  // Show progress
  progressContainer.classList.remove('hidden');
  importBtn.disabled = true;
  importBtn.querySelector('span').textContent = 'Importing...';
  
  try {
    const response = await fetch('/api/content/drive/import-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        driveUrl,
        title,
        description
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      progressBar.style.width = '100%';
      progressText.textContent = 'Import successful!';
      showNotification('Video imported successfully!', 'success');
      setTimeout(() => {
        closeImportDriveModal();
        location.reload();
      }, 1000);
    } else {
      showNotification(result.message || 'Import failed', 'error');
      progressContainer.classList.add('hidden');
      importBtn.disabled = false;
      importBtn.querySelector('span').textContent = 'Import Video';
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Import failed', 'error');
    progressContainer.classList.add('hidden');
    importBtn.disabled = false;
    importBtn.querySelector('span').textContent = 'Import Video';
  }
});

// Helper function for formatting
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Close modals on outside click
document.getElementById('uploadModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'uploadModal') {
    closeUploadModal();
  }
});

document.getElementById('previewModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'previewModal') {
    closePreviewModal();
  }
});

document.getElementById('editModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'editModal') {
    closeEditModal();
  }
});

document.getElementById('importDriveModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'importDriveModal') {
    closeImportDriveModal();
  }
});

console.log('Content gallery initialized');
