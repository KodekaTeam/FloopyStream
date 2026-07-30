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
  let visibleCount = 0;

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
    if (showRow) visibleCount++;
  });

  // Handle empty search results visually
  const tbody = document.getElementById('historyTableBody');
  const noResultsRow = document.getElementById('noResultsRow');

  if (visibleCount === 0 && rows.length > 0) {
    if (!noResultsRow) {
      const row = document.createElement('tr');
      row.id = 'noResultsRow';
      row.innerHTML = `
        <td colspan="6" class="px-6 py-20 text-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center border border-gray-700/50 mb-2">
              <i class="ti ti-search-off text-3xl text-gray-600"></i>
            </div>
            <p class="text-gray-500 font-medium">No archived streams match your active filters</p>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    }
  } else if (noResultsRow) {
    noResultsRow.remove();
  }
}

/**
 * View broadcast details in a modern modal
 */
async function viewBroadcastDetails(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`);
    const data = await response.json();

    if (data.success) {
      const broadcast = data.broadcast;
      const statusColors = { active: 'bg-green-500', completed: 'bg-blue-500', scheduled: 'bg-orange-500', failed: 'bg-red-500' };
      const statusColor = statusColors[broadcast.broadcast_status] || 'bg-gray-500';

      // Create modern modal
      const modal = document.createElement('div');
      modal.id = 'detailsModal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md';
      modal.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl scale-95 opacity-0 transition-all duration-300 transform" id="modalContent">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                <i class="ti ti-file-analytics text-2xl"></i>
              </div>
              <div>
                <h3 class="text-xl font-bold text-white">Stream Diagnostics</h3>
                <p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Transaction ID: ${broadcast.broadcast_uuid.substring(0, 8)}...</p>
              </div>
            </div>
            <button onclick="closeDetailsModal()" class="w-10 h-10 flex items-center justify-center bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white rounded-xl transition-all">
              <i class="ti ti-x text-xl"></i>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <!-- Row 1: Status & Platform -->
            <div class="grid grid-cols-2 gap-4">
               <div class="p-5 bg-gray-800/40 rounded-2xl border border-gray-700/50">
                  <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3 text-center">Session Status</p>
                  <div class="flex items-center justify-center gap-3">
                    <div class="w-2.5 h-2.5 rounded-full ${statusColor} shadow-lg shadow-${statusColor.split('-')[1]}-500/40"></div>
                    <span class="text-white font-bold uppercase text-xs tracking-widest">${broadcast.broadcast_status}</span>
                  </div>
               </div>
               <div class="p-5 bg-gray-800/40 rounded-2xl border border-gray-700/50">
                  <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3 text-center">Destination</p>
                  <div class="flex items-center justify-center gap-3">
                    <i class="ti ti-broadcast text-blue-500 text-lg"></i>
                    <span class="text-white font-bold uppercase text-xs tracking-widest">${broadcast.platform_name}</span>
                  </div>
               </div>
            </div>

            <!-- Broadcast Meta -->
            <div class="space-y-3">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Archive Identity</label>
              <div class="p-5 bg-gray-800/60 rounded-2xl border border-gray-700/50 group">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-gray-900 border border-gray-700/50 flex items-center justify-center text-gray-500">
                    <i class="ti ti-template text-xl"></i>
                  </div>
                  <div>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Content Label</p>
                    <p class="text-white font-bold text-sm">${broadcast.broadcast_name || 'Untitled Content'}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Endpoints -->
            <div class="space-y-3">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Network Endpoints</label>
              <div class="space-y-2">
                <div class="group relative">
                  <p class="text-[9px] text-gray-500 mb-1.5 ml-1">Ingest URL</p>
                  <div class="p-4 bg-gray-950/80 border border-gray-800 rounded-xl font-mono text-[11px] text-blue-400 break-all select-all flex items-center gap-3">
                    <i class="ti ti-link text-blue-500/50"></i>
                    ${broadcast.destination_url}
                  </div>
                </div>
                ${broadcast.stream_key ? `
                <div class="group relative">
                  <p class="text-[9px] text-gray-500 mb-1.5 ml-1">Stream Token</p>
                  <div class="p-4 bg-gray-950/80 border border-gray-800 rounded-xl font-mono text-[11px] text-gray-500 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                      <i class="ti ti-key text-gray-600"></i>
                      <span>••••••••••••••••••••••••</span>
                    </div>
                    <i class="ti ti-lock text-gray-700"></i>
                  </div>
                </div>` : ''}
              </div>
            </div>

            <!-- Timeline -->
            <div class="space-y-3">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Temporal Data</label>
              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-gray-800/30 rounded-2xl border border-gray-700/30 flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
                    <i class="ti ti-clock-play text-xl"></i>
                  </div>
                  <div>
                    <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Initialized</p>
                    <p class="text-xs text-white font-bold mt-0.5">${new Date(broadcast.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div class="p-4 bg-gray-800/30 rounded-2xl border border-gray-700/30 flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                    <i class="ti ti-clock-stop text-xl"></i>
                  </div>
                  <div>
                    <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Concluded</p>
                    <p class="text-xs text-white font-bold mt-0.5">${broadcast.updated_at ? new Date(broadcast.updated_at).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Errors -->
            ${broadcast.error_message ? `
            <div class="space-y-3 pt-2">
              <label class="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1">Diagnostic Report</label>
              <div class="p-5 bg-red-500/10 rounded-2xl border border-red-500/20 flex gap-4">
                <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
                   <i class="ti ti-alert-triangle text-xl"></i>
                </div>
                <div class="min-w-0">
                  <p class="text-red-400 text-xs leading-relaxed font-bold mb-1">Session Error</p>
                  <p class="text-red-300 text-xs leading-relaxed opacity-80">${broadcast.error_message}</p>
                </div>
              </div>
            </div>` : ''}
          </div>

          <!-- Footer -->
          <div class="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-end">
            <button onclick="closeDetailsModal()" class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95">
              Confirm & Return
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Trigger animation
      setTimeout(() => {
        const content = document.getElementById('modalContent');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
      }, 10);

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDetailsModal();
      });

    } else {
      showToast(data.message || 'Unable to fetch analytics', 'error');
    }
  } catch (error) {
    console.error('Analytics error:', error);
    showToast('Failed to connect to server', 'error');
  }
}

/**
 * Close modern modal with animation
 */
function closeDetailsModal() {
  const content = document.getElementById('modalContent');
  const modal = document.getElementById('detailsModal');
  if (content && modal) {
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.remove(), 300);
  }
}

/**
 * Delete a single broadcast entry with SweetAlert2
 */
async function deleteBroadcast(broadcastId) {
  const result = await Swal.fire({
    title: 'Purge Archive?',
    text: "This removal is permanent and cannot be recovered.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#1f2937',
    confirmButtonText: 'Yes, Purge Record',
    background: '#111827',
    color: '#fff',
    customClass: {
      popup: 'rounded-3xl border border-gray-800',
      confirmButton: 'rounded-xl px-6 py-3 font-bold',
      cancelButton: 'rounded-xl px-6 py-3 font-bold'
    }
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showToast('Record purged from archive', 'success');
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.message || 'Failed to purge record', 'error');
    }
  } catch (error) {
    console.error('Purge error:', error);
    showToast('Internal connection failure', 'error');
  }
}

/**
 * Export current visible history to CSV
 */
function exportHistory() {
  const rows = Array.from(document.querySelectorAll('.broadcast-row:not([style*="display: none"])'));

  if (rows.length === 0) {
    showToast('No filtered data to export', 'error');
    return;
  }

  const csvContent = [
    ['ID', 'Label', 'Platform', 'Start Time', 'End Time', 'Duration (Min)', 'Status'].join(','),
    ...rows.map(row => {
      // Use more specific selectors for data extraction
      const id = row.querySelector('p.font-mono').textContent.replace('#', '').trim();
      const name = row.querySelector('p.text-white.font-bold').textContent.trim();
      const platform = row.dataset.platform;

      // Extract times from the timeline column spans
      const timeSpans = row.querySelectorAll('td:nth-child(3) span');
      const startTime = timeSpans[0] ? timeSpans[0].textContent.replace('Started: ', '').trim() : '-';
      const endTime = timeSpans[1] ? timeSpans[1].textContent.replace('Ended: ', '').trim() : '-';

      // Extract duration - look for the text node after the hourglass icon
      const durationCell = row.querySelector('td:nth-child(4)');
      const duration = durationCell ? durationCell.textContent.trim().replace(' Min', '') : '0';

      const status = row.dataset.status;

      return [id, `"${name}"`, platform, `"${startTime}"`, `"${endTime}"`, parseInt(duration) || 0, status].join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stream-archive-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  showToast('Archive exported successfully', 'success');
}

/**
 * Clear all past history (completed/failed) with SweetAlert2
 */
async function clearHistory() {
  const rows = Array.from(document.querySelectorAll('.broadcast-row'));
  const targetRows = rows.filter(row => ['completed', 'failed'].includes(row.dataset.status));

  if (targetRows.length === 0) {
    showToast('No archived records found to clear', 'error');
    return;
  }

  const result = await Swal.fire({
    title: 'Archive Cleanup',
    text: `You are about to wipe ${targetRows.length} archived stream(s). Only 'Completed' and 'Failed' streams will be removed. Trace active ones first.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#1f2937',
    confirmButtonText: 'Initiate Cleanup',
    background: '#111827',
    color: '#fff',
    customClass: {
      popup: 'rounded-3xl border border-gray-800',
      confirmButton: 'rounded-xl px-6 py-3 font-bold',
      cancelButton: 'rounded-xl px-6 py-3 font-bold'
    }
  });

  if (!result.isConfirmed) return;

  try {
    const deletePromises = targetRows.map(row => {
      const uuid = row.dataset.uuid;
      return fetch(`/api/broadcast/${uuid}`, { method: 'DELETE' });
    });

    await Promise.all(deletePromises);
    showToast('Stream archive cleared', 'success');
    setTimeout(() => location.reload(), 800);
  } catch (error) {
    console.error('Clearing fail:', error);
    showToast('System failed to clear archive', 'error');
  }
}

/**
 * Universal Toast Notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 transform transition-all duration-300 translate-y-20 opacity-0 ${
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' :
    'bg-blue-600'
  }`;

  const icon = type === 'success' ? 'ti-circle-check' :
               type === 'error' ? 'ti-alert-octagon' :
               'ti-info-circle';

  toast.innerHTML = `
    <i class="ti ${icon} text-white text-xl"></i>
    <span class="text-white font-bold text-sm tracking-wide">${message}</span>
  `;

  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-20', 'opacity-0');
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
