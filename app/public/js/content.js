// Content/Gallery JavaScript
// Handles video gallery interactions

// ============================================
// Gallery Pagination Variables
// ============================================
let allGalleryVideos = [];
let filteredGalleryVideos = [];
let currentGalleryPage = 1;
let totalGalleryPages = 1;
const galleryItemsPerPage = 10;

// Initialize gallery pagination on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeGalleryPagination();
});

// ============================================
// Gallery Pagination Functions
// ============================================

/**
 * Initialize gallery pagination
 */
function initializeGalleryPagination() {
  const container = document.getElementById('videoGrid');
  if (!container) {
    console.log('DEBUG: videoGrid container not found!');
    return;
  }

  console.log('DEBUG: videoGrid container found');
  console.log('DEBUG: container.children.length =', container.children.length);
  console.log('DEBUG: container.querySelectorAll("div").length =', container.querySelectorAll('div').length);

  // Collect all video cards - Get direct children that are video items
  const cards = Array.from(container.children).filter(card => {
    const hasH3 = card.querySelector('h3');
    console.log('DEBUG: Checking card, hasH3 =', hasH3 ? 'YES' : 'NO');
    return hasH3;
  });
  
  console.log('DEBUG: Total cards after filter:', cards.length);
  
  allGalleryVideos = cards;
  filteredGalleryVideos = [...allGalleryVideos];
  currentGalleryPage = 1;
  
  console.log('DEBUG: initializeGalleryPagination - Found', allGalleryVideos.length, 'videos');
  
  // Render initial pagination
  renderGalleryPagination();
}

/**
 * Render gallery pagination
 */
function renderGalleryPagination() {
  const totalVideos = filteredGalleryVideos.length;
  totalGalleryPages = Math.ceil(totalVideos / galleryItemsPerPage);

  console.log('DEBUG: renderGalleryPagination - Total videos:', totalVideos, 'Pages:', totalGalleryPages, 'Current page:', currentGalleryPage);

  // If no videos or only 1 page, hide pagination
  if (totalVideos === 0) {
    document.getElementById('videoGrid').style.display = 'block';
    return;
  }

  // Calculate start and end index
  const startIndex = (currentGalleryPage - 1) * galleryItemsPerPage;
  const endIndex = Math.min(startIndex + galleryItemsPerPage, totalVideos);

  console.log('DEBUG: Showing indices', startIndex, 'to', endIndex);

  // Hide all video cards first
  filteredGalleryVideos.forEach(card => {
    card.style.display = 'none';
  });

  // Show only current page videos
  filteredGalleryVideos.slice(startIndex, endIndex).forEach(card => {
    card.style.display = 'block';
  });

  // Render pagination buttons
  renderGalleryPageNumbers();

  // Update showing info
  const showingInfo = document.getElementById('galleryShowingInfo');
  if (showingInfo) {
    showingInfo.innerHTML = `Showing ${startIndex + 1}-${endIndex} of ${totalVideos} videos | Page ${currentGalleryPage} of ${totalGalleryPages}`;
  }

  // Update button states
  const prevBtn = document.getElementById('galleryPrevBtn');
  const nextBtn = document.getElementById('galleryNextBtn');
  
  if (prevBtn) {
    if (currentGalleryPage === 1) {
      prevBtn.disabled = true;
      prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      prevBtn.disabled = false;
      prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  if (nextBtn) {
    if (currentGalleryPage === totalGalleryPages) {
      nextBtn.disabled = true;
      nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      nextBtn.disabled = false;
      nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

/**
 * Render page numbers
 */
function renderGalleryPageNumbers() {
  const container = document.getElementById('galleryPaginationNumbers');
  if (!container) return;

  const pageRange = getGalleryPageRange(currentGalleryPage, totalGalleryPages);
  
  let html = '';
  pageRange.forEach(page => {
    if (page === '...') {
      html += `<span class="w-8 h-8 flex items-center justify-center text-gray-500">...</span>`;
    } else if (page === currentGalleryPage) {
      html += `
        <button
          class="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded font-semibold"
          disabled
        >
          ${page}
        </button>
      `;
    } else {
      html += `
        <a
          href="#"
          onclick="goToGalleryPage(${page}); return false;"
          class="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition"
        >
          ${page}
        </a>
      `;
    }
  });

  container.innerHTML = html;
}

/**
 * Get page range for pagination
 */
function getGalleryPageRange(current, total, range = 2) {
  const pages = [];
  const start = Math.max(1, current - range);
  const end = Math.min(total, current + range);
  
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  if (end < total) {
    if (end < total - 1) pages.push('...');
    pages.push(total);
  }
  
  return pages;
}

/**
 * Go to specific gallery page
 */
function goToGalleryPage(page) {
  currentGalleryPage = Math.max(1, Math.min(page, totalGalleryPages));
  renderGalleryPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// End Gallery Pagination
// ============================================

// Upload dropdown toggle
function toggleUploadDropdown() {
  const dropdown = document.getElementById("uploadDropdown");
  dropdown.classList.toggle("hidden");
}

function closeUploadDropdown() {
  const dropdown = document.getElementById("uploadDropdown");
  dropdown.classList.add("hidden");
}

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
  const container = document.getElementById("uploadDropdownContainer");
  const dropdown = document.getElementById("uploadDropdown");

  if (container && dropdown && !container.contains(event.target)) {
    dropdown.classList.add("hidden");
  }
});

// Modal functions
function openUploadModal() {
  document.getElementById("uploadModal").classList.remove("hidden");
}

function closeUploadModal() {
  document.getElementById("uploadModal").classList.add("hidden");
  document.getElementById("uploadForm").reset();
  document.getElementById("filesList").classList.add("hidden");
  document.getElementById("filesListContainer").innerHTML = "";

  // Reset progress display
  const progressContainer = document.getElementById("progressContentContainer");
  const formContainer = document.getElementById("formContentContainer");
  const uploadButton = document.getElementById("uploadButton");
  const cancelButton = document.querySelector(
    'button[onclick="closeUploadModal()"]'
  );

  progressContainer.classList.add("hidden");
  formContainer.classList.remove("hidden");
  uploadButton.disabled = false;
  uploadButton.textContent = "Upload";

  // Reset progress bars
  document.getElementById("overallProgressBar").style.width = "0%";
  document.getElementById("overallPercent").textContent = "0%";
  document.getElementById("filesProgressContainer").innerHTML = "";
}

function openImportDriveModal() {
  showNotification("Google Drive import feature coming soon!", "info");
}

// File upload handling
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("videoFileInput");

dropZone?.addEventListener("click", () => {
  fileInput.click();
});

dropZone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("border-blue-500", "bg-gray-700");
});

dropZone?.addEventListener("dragleave", () => {
  dropZone.classList.remove("border-blue-500", "bg-gray-700");
});

dropZone?.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("border-blue-500", "bg-gray-700");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fileInput.files = files;
    updateFilesList(files);
  }
});

fileInput?.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    updateFilesList(e.target.files);
  }
});

function updateFilesList(files) {
  const filesListContainer = document.getElementById("filesListContainer");
  const filesList = document.getElementById("filesList");

  filesListContainer.innerHTML = "";

  if (files.length === 0) {
    filesList.classList.add("hidden");
    return;
  }

  let totalSize = 0;
  Array.from(files).forEach((file, index) => {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    totalSize += file.size;

    const fileItem = document.createElement("div");
    fileItem.className =
      "flex items-center justify-between p-2 bg-gray-700 rounded text-gray-300";
    fileItem.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <i class="ti ti-video text-blue-400 flex-shrink-0"></i>
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">${file.name}</div>
          <div class="text-xs text-gray-400">${sizeMB} MB</div>
        </div>
      </div>
      <button
        type="button"
        onclick="removeFileFromList(${index})"
        class="text-gray-400 hover:text-red-400 ml-2 flex-shrink-0"
      >
        <i class="ti ti-x"></i>
      </button>
    `;
    filesListContainer.appendChild(fileItem);
  });

  // Show total
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
  const totalDiv = document.createElement("div");
  totalDiv.className =
    "text-xs text-gray-400 mt-2 pt-2 border-t border-gray-600";
  totalDiv.textContent = `Total: ${files.length} file(s) - ${totalMB} MB`;
  filesListContainer.appendChild(totalDiv);

  filesList.classList.remove("hidden");
}

function removeFileFromList(index) {
  const fileInput = document.getElementById("videoFileInput");
  const dataTransfer = new DataTransfer();

  Array.from(fileInput.files).forEach((file, i) => {
    if (i !== index) {
      dataTransfer.items.add(file);
    }
  });

  fileInput.files = dataTransfer.files;
  updateFilesList(fileInput.files);
}

function clearFilesList() {
  const fileInput = document.getElementById("videoFileInput");
  fileInput.value = "";
  updateFilesList(fileInput.files);
}

// Handle upload form submission
document.getElementById("uploadForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("videoFileInput");
  const files = fileInput.files;

  if (!files || files.length === 0) {
    showNotification("Please select at least one video file", "error");
    return;
  }

  const description =
    document.querySelector('input[name="description"]')?.value || "";
  const uploadButton = document.getElementById("uploadButton");

  // Hide form and show progress
  const formContainer = document.getElementById("formContentContainer");
  const progressContainer = document.getElementById("progressContentContainer");
  formContainer.classList.add("hidden");
  progressContainer.classList.remove("hidden");

  const overallProgressBar = document.getElementById("overallProgressBar");
  const overallPercent = document.getElementById("overallPercent");
  const filesProgressContainer = document.getElementById(
    "filesProgressContainer"
  );
  filesProgressContainer.innerHTML = "";

  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";

  try {
    // Create progress tracking for each file
    const fileProgresses = {};
    Array.from(files).forEach((file, index) => {
      fileProgresses[file.name] = { loaded: 0, total: file.size };

      const progressItem = document.createElement("div");
      progressItem.id = `progress-${index}`;
      progressItem.className = "bg-gray-700 rounded p-3";
      progressItem.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm text-gray-300 truncate flex-1">${file.name}</div>
          <span class="text-sm text-gray-400 ml-2"><span class="filePercent">0</span>%</span>
        </div>
        <div class="w-full bg-gray-600 rounded-full h-2">
          <div class="fileBar bg-green-500 h-2 rounded-full transition-all" style="width: 0%"></div>
        </div>
      `;
      filesProgressContainer.appendChild(progressItem);
    });

    let completed = 0;
    let failed = 0;

    // Upload each file sequentially or in parallel
    const uploadPromises = Array.from(files).map((file, index) => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("videoFiles", file);
        formData.append(
          "title",
          file.name.substring(0, file.name.lastIndexOf(".")) || file.name
        );
        formData.append("description", description);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const filePercent = Math.round((e.loaded / e.total) * 100);
            const progressItem = document.getElementById(`progress-${index}`);
            if (progressItem) {
              progressItem.querySelector(".filePercent").textContent =
                filePercent;
              progressItem.querySelector(".fileBar").style.width =
                filePercent + "%";
            }

            // Update overall progress
            const totalLoaded =
              Object.values(fileProgresses).reduce(
                (sum, p) => sum + p.loaded,
                0
              ) + e.loaded;
            const totalSize = Object.values(fileProgresses).reduce(
              (sum, p) => sum + p.total,
              0
            );
            const overallPercent2 = Math.round((totalLoaded / totalSize) * 100);
            overallProgressBar.style.width = overallPercent2 + "%";
            overallPercent.textContent = overallPercent2 + "%";
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            if (result.success) {
              completed++;
              const progressItem = document.getElementById(`progress-${index}`);
              if (progressItem) {
                progressItem
                  .querySelector(".fileBar")
                  .classList.add("bg-blue-500");
                progressItem
                  .querySelector(".fileBar")
                  .classList.remove("bg-green-500");
                progressItem.querySelector(".filePercent").textContent = "100";
              }
            } else {
              failed++;
              console.warn(
                `File ${file.name} upload failed: ${result.message}`
              );
              const progressItem = document.getElementById(`progress-${index}`);
              if (progressItem) {
                progressItem
                  .querySelector(".fileBar")
                  .classList.add("bg-red-500");
                progressItem
                  .querySelector(".fileBar")
                  .classList.remove("bg-green-500");
              }
            }
          } else {
            failed++;
            console.warn(
              `File ${file.name} upload failed with status ${xhr.status}`
            );
            const progressItem = document.getElementById(`progress-${index}`);
            if (progressItem) {
              progressItem
                .querySelector(".fileBar")
                .classList.add("bg-red-500");
              progressItem
                .querySelector(".fileBar")
                .classList.remove("bg-green-500");
            }
          }
          resolve();
        });

        xhr.addEventListener("error", () => {
          failed++;
          const progressItem = document.getElementById(`progress-${index}`);
          if (progressItem) {
            progressItem.querySelector(".fileBar").classList.add("bg-red-500");
            progressItem
              .querySelector(".fileBar")
              .classList.remove("bg-green-500");
          }
          reject(new Error(`Upload failed for ${file.name}`));
        });

        xhr.open("POST", "/api/content/upload");
        xhr.send(formData);
      });
    });

    // Wait for all uploads to complete
    await Promise.allSettled(uploadPromises);

    // Show final message
    if (completed > 0 && failed === 0) {
      showNotification(
        `${completed} video(s) uploaded successfully!`,
        "success"
      );
      setTimeout(() => location.reload(), 1500);
    } else if (completed > 0 && failed > 0) {
      // Show form again on partial failure
      formContainer.classList.remove("hidden");
      progressContainer.classList.add("hidden");
      uploadButton.disabled = false;
      uploadButton.textContent = "Upload";
      showNotification(
        `${completed} uploaded, ${failed} failed. You can retry or close.`,
        "warning"
      );
    } else {
      // All failed - show form again
      formContainer.classList.remove("hidden");
      progressContainer.classList.add("hidden");
      uploadButton.disabled = false;
      uploadButton.textContent = "Upload";
      showNotification("All uploads failed. Please try again.", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    // Show form again on error
    formContainer.classList.remove("hidden");
    progressContainer.classList.add("hidden");
    uploadButton.disabled = false;
    uploadButton.textContent = "Upload";
    showNotification("Upload failed: " + error.message, "error");
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
      const video = document.getElementById("previewVideo");
      const source = document.getElementById("previewSource");

      // Reset video first
      video.pause();
      video.currentTime = 0;
      video.muted = false; // Ensure not muted

      // Update source
      source.src = `/storage/uploads/${content.filename}`;
      source.type = "video/mp4";

      // Update modal content
      document.getElementById("previewTitle").textContent = content.title;
      document.getElementById("previewDuration").textContent = formatDuration(
        content.duration_seconds
      );
      document.getElementById("previewSize").textContent = formatFileSize(
        content.filesize
      );
      document.getElementById("previewResolution").textContent =
        content.resolution || "N/A";
      document.getElementById("previewFormat").textContent = content.filename
        .split(".")
        .pop()
        .toUpperCase();

      // Show modal first
      document.getElementById("previewModal").classList.remove("hidden");

      // Load and autoplay video
      video.load();

      // Wait for enough data to play
      video.addEventListener(
        "canplay",
        function autoplayHandler() {
          // Remove this event listener after first trigger
          video.removeEventListener("canplay", autoplayHandler);

          // Try to autoplay
          const playPromise = video.play();

          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("Video autoplay started successfully");
              })
              .catch((err) => {
                console.log("Autoplay prevented:", err.message);
                // If autoplay fails, user can still click play button
              });
          }
        },
        { once: true }
      );
    } else {
      showNotification("Failed to load video", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to load video", "error");
  }
}

function closePreviewModal() {
  const modal = document.getElementById("previewModal");
  const video = document.getElementById("previewVideo");

  // Pause and reset video
  video.pause();
  video.currentTime = 0;

  // Hide modal
  modal.classList.add("hidden");
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
      document.getElementById("editContentId").value = content.content_id;
      document.getElementById("editTitle").value = content.title;
      document.getElementById("editDescription").value =
        content.description || "";
      document.getElementById("editDuration").value = formatDuration(
        content.duration_seconds
      );
      document.getElementById("editResolution").value =
        content.resolution || "N/A";
      document.getElementById("editFileSize").value = formatFileSize(
        content.filesize
      );

      // Set video preview instead of thumbnail
      const videoPreview = document.getElementById("editVideoPreview");
      const videoSource = document.getElementById("editVideoSource");
      const videoPath = `/storage/uploads/${content.filename}`;

      videoSource.src = videoPath;
      videoPreview.load();

      console.log("Edit modal - Video path:", videoPath);
      console.log("Edit modal - Resolution:", content.resolution);

      // Show modal
      document.getElementById("editModal").classList.remove("hidden");
    } else {
      showNotification("Failed to load video details", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to load video details", "error");
  }
}

function closeEditModal() {
  // Stop video playback
  const videoPreview = document.getElementById("editVideoPreview");
  if (videoPreview) {
    videoPreview.pause();
    videoPreview.currentTime = 0;
  }

  document.getElementById("editModal").classList.add("hidden");
  document.getElementById("editForm").reset();
}

async function deleteVideo(contentId) {
  if (!confirm("Delete this video? This action cannot be undone.")) return;

  try {
    const response = await fetch(`/api/content/${contentId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.success) {
      showNotification("Video deleted", "success");
      setTimeout(() => location.reload(), 500);
    } else {
      showNotification(result.message || "Failed to delete video", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to delete video", "error");
  }
}

// Search videos
document.getElementById("searchVideos")?.addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const videoCards = document.querySelectorAll("#videoGrid > div");

  videoCards.forEach((card) => {
    const title = card.querySelector("h3").textContent.toLowerCase();
    card.style.display = title.includes(searchTerm) ? "" : "none";
  });
});

// Sort videos
document.getElementById("sortSelect")?.addEventListener("change", (e) => {
  const sortBy = e.target.value;
  const videoGrid = document.getElementById("videoGrid");
  const videos = Array.from(videoGrid?.children || []);

  videos.sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return b.dataset.date - a.dataset.date;
      case "oldest":
        return a.dataset.date - b.dataset.date;
      case "name":
        const titleA = a.querySelector("h3").textContent;
        const titleB = b.querySelector("h3").textContent;
        return titleA.localeCompare(titleB);
      case "size":
        return b.dataset.size - a.dataset.size;
      default:
        return 0;
    }
  });

  videos.forEach((video) => videoGrid.appendChild(video));
});

// Show notification
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform translate-x-0 ${
    type === "success"
      ? "bg-green-600"
      : type === "error"
      ? "bg-red-600"
      : type === "info"
      ? "bg-blue-600"
      : "bg-gray-600"
  } text-white`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transform = "translateX(400px)";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Handle edit form submission
document.getElementById("editForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const contentId = document.getElementById("editContentId").value;
  const title = document.getElementById("editTitle").value;
  const description = document.getElementById("editDescription").value;

  try {
    const response = await fetch(`/api/content/${contentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification("Video updated successfully!", "success");
      setTimeout(() => location.reload(), 500);
    } else {
      showNotification(result.message || "Failed to update video", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to update video", "error");
  }
});

// Google Drive Functions
function openImportDriveModal() {
  document.getElementById("importDriveModal").classList.remove("hidden");
}

function closeImportDriveModal() {
  document.getElementById("importDriveModal").classList.add("hidden");
  document.getElementById("importDriveForm").reset();
  document.getElementById("driveImportProgress").classList.add("hidden");
}

// Handle import drive form submission
document
  .getElementById("importDriveForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const driveUrl = document.getElementById("driveUrl").value.trim();
    const title = document.getElementById("driveVideoTitle").value.trim();
    const description = document
      .getElementById("driveVideoDescription")
      .value.trim();

    if (!driveUrl) {
      showNotification("Please enter Google Drive link", "error");
      return;
    }

    const progressContainer = document.getElementById("driveImportProgress");
    const progressBar = document.getElementById("driveProgressBar");
    const progressText = document.getElementById("driveProgressText");
    const importBtn = document.getElementById("importDriveBtn");

    // Show progress
    progressContainer.classList.remove("hidden");
    importBtn.disabled = true;
    importBtn.querySelector("span").textContent = "Importing...";

    try {
      const response = await fetch("/api/content/drive/import-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driveUrl,
          title,
          description,
        }),
      });

      const result = await response.json();

      if (result.success) {
        progressBar.style.width = "100%";
        progressText.textContent = "Import successful!";
        showNotification("Video imported successfully!", "success");
        setTimeout(() => {
          closeImportDriveModal();
          location.reload();
        }, 1000);
      } else {
        showNotification(result.message || "Import failed", "error");
        progressContainer.classList.add("hidden");
        importBtn.disabled = false;
        importBtn.querySelector("span").textContent = "Import Video";
      }
    } catch (error) {
      console.error("Error:", error);
      showNotification("Import failed", "error");
      progressContainer.classList.add("hidden");
      importBtn.disabled = false;
      importBtn.querySelector("span").textContent = "Import Video";
    }
  });

// Helper function for formatting
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Close modals on outside click
document.getElementById("uploadModal")?.addEventListener("click", (e) => {
  if (e.target.id === "uploadModal") {
    closeUploadModal();
  }
});

document.getElementById("previewModal")?.addEventListener("click", (e) => {
  if (e.target.id === "previewModal") {
    closePreviewModal();
  }
});

document.getElementById("editModal")?.addEventListener("click", (e) => {
  if (e.target.id === "editModal") {
    closeEditModal();
  }
});

document.getElementById("importDriveModal")?.addEventListener("click", (e) => {
  if (e.target.id === "importDriveModal") {
    closeImportDriveModal();
  }
});

console.log("Content gallery initialized");
