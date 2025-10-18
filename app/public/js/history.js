// History page JavaScript

// Search functionality
document.getElementById('searchHistory').addEventListener('input', function(e) {
  const searchTerm = e.target.value.toLowerCase();
  filterHistory();
});

// Filter history based on all criteria
function filterHistory() {
  const searchTerm = document.getElementById('searchHistory').value.toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;
  const platformFilter = document.getElementById('filterPlatform').value;
  const dateFilter = document.getElementById('filterDate').value;

  const rows = document.querySelectorAll('.broadcast-row');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const status = row.dataset.status;
    const platform = row.dataset.platform;
    const rowDate = row.dataset.date.split('T')[0];

    let showRow = true;

    // Search filter
    if (searchTerm && !text.includes(searchTerm)) {
      showRow = false;
    }

    // Status filter
    if (statusFilter !== 'all' && status !== statusFilter) {
      showRow = false;
    }

    // Platform filter
    if (platformFilter !== 'all' && platform !== platformFilter) {
      showRow = false;
    }

    // Date filter
    if (dateFilter && rowDate !== dateFilter) {
      showRow = false;
    }

    row.style.display = showRow ? '' : 'none';
  });
}

// View broadcast details
async function viewBroadcastDetails(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`);
    const data = await response.json();

    if (data.success) {
      const broadcast = data.broadcast;
      
      // Create modal with broadcast details
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold text-white">Broadcast Details</h3>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
              <i class="ti ti-x text-2xl"></i>
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm text-gray-400">Broadcast ID</label>
                <p class="text-white font-medium">${broadcast.broadcast_id}</p>
              </div>
              <div>
                <label class="text-sm text-gray-400">Status</label>
                <p class="text-white font-medium capitalize">${broadcast.broadcast_status}</p>
              </div>
            </div>

            <div>
              <label class="text-sm text-gray-400">Stream Name</label>
              <p class="text-white font-medium">${broadcast.broadcast_name || 'Untitled'}</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm text-gray-400">Platform</label>
                <p class="text-white font-medium capitalize">${broadcast.platform_name}</p>
              </div>
              <div>
                <label class="text-sm text-gray-400">Duration</label>
                <p class="text-white font-medium">${broadcast.duration_seconds ? Math.floor(broadcast.duration_seconds / 60) + ' minutes' : 'N/A'}</p>
              </div>
            </div>

            <div>
              <label class="text-sm text-gray-400">Destination URL</label>
              <p class="text-white font-mono text-sm bg-gray-900 p-2 rounded break-all">${broadcast.destination_url}</p>
            </div>

            ${broadcast.stream_key ? `
              <div>
                <label class="text-sm text-gray-400">Stream Key</label>
                <p class="text-white font-mono text-sm bg-gray-900 p-2 rounded">••••••••</p>
              </div>
            ` : ''}

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm text-gray-400">Start Time</label>
                <p class="text-white">${new Date(broadcast.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label class="text-sm text-gray-400">End Time</label>
                <p class="text-white">${broadcast.updated_at ? new Date(broadcast.updated_at).toLocaleString() : 'N/A'}</p>
              </div>
            </div>

            ${broadcast.scheduled_time ? `
              <div>
                <label class="text-sm text-gray-400">Scheduled Time</label>
                <p class="text-white">${new Date(broadcast.scheduled_time).toLocaleString()}</p>
              </div>
            ` : ''}

            ${broadcast.error_message ? `
              <div>
                <label class="text-sm text-gray-400 text-red-400">Error Message</label>
                <p class="text-red-300 bg-red-900 bg-opacity-20 p-2 rounded">${broadcast.error_message}</p>
              </div>
            ` : ''}
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button onclick="this.closest('.fixed').remove()" 
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    } else {
      showNotification(data.message || 'Failed to load broadcast details', 'error');
    }
  } catch (error) {
    console.error('Error fetching broadcast details:', error);
    showNotification('Failed to load broadcast details', 'error');
  }
}

// Delete broadcast
async function deleteBroadcast(broadcastId) {
  if (!confirm('Are you sure you want to delete this broadcast from history?')) {
    return;
  }

  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Broadcast deleted successfully', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(data.message || 'Failed to delete broadcast', 'error');
    }
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    showNotification('Failed to delete broadcast', 'error');
  }
}

// Export history to CSV
function exportHistory() {
  const rows = Array.from(document.querySelectorAll('.broadcast-row:not([style*="display: none"])'));
  
  if (rows.length === 0) {
    showNotification('No data to export', 'warning');
    return;
  }

  const csvContent = [
    ['ID', 'Name', 'Platform', 'Start Time', 'End Time', 'Duration', 'Status'].join(','),
    ...rows.map(row => {
      const cells = row.querySelectorAll('td');
      const id = cells[0].querySelector('p:last-child').textContent.replace('ID: ', '');
      const name = cells[0].querySelector('p:first-child').textContent;
      const platform = cells[1].textContent.trim();
      const startTime = cells[2].textContent.trim();
      const endTime = cells[3].textContent.trim();
      const duration = cells[4].textContent.trim();
      const status = cells[5].textContent.trim();
      
      return [id, `"${name}"`, platform, startTime, endTime, duration, status].join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broadcast-history-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);

  showNotification('History exported successfully', 'success');
}

// Clear all history (completed and failed only)
async function clearHistory() {
  const count = document.querySelectorAll('.broadcast-row').length;
  
  if (count === 0) {
    showNotification('No history to clear', 'warning');
    return;
  }

  const confirmed = confirm(`This will delete all ${count} broadcast records from history. This action cannot be undone. Continue?`);
  
  if (!confirmed) return;

  try {
    const rows = document.querySelectorAll('.broadcast-row');
    const deletePromises = [];

    for (const row of rows) {
      const status = row.dataset.status;
      if (status === 'completed' || status === 'failed') {
        const id = row.querySelector('p:last-child').textContent.replace('ID: ', '');
        deletePromises.push(
          fetch(`/api/broadcast/${id}`, { method: 'DELETE' })
        );
      }
    }

    await Promise.all(deletePromises);
    showNotification('History cleared successfully', 'success');
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    console.error('Error clearing history:', error);
    showNotification('Failed to clear history', 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600'
  };

  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
