// Projects JavaScript
// Handles pagination and search functionality

// Pagination variables
let currentPage = 1;
const itemsPerPage = 8; // 2x4 grid for better display
let allProjects = [];
let filteredProjects = [];
let currentSearchTerm = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Projects page loaded');

  // Get all project cards
  const projectCards = document.querySelectorAll('a[href^="/projects/detail/"]');
  console.log('Found project cards:', projectCards.length);

  allProjects = Array.from(projectCards);
  filteredProjects = [...allProjects];

  // Initialize pagination
  updatePagination();
  filterAndDisplayCards();
});

// Filter projects based on search input
function filterProjects(query) {
  currentSearchTerm = query.toLowerCase().trim();
  currentPage = 1; // Reset to first page on new search

  // Get the project container and cards
  const projectGrid = document.getElementById('projectGrid');
  if (!projectGrid) {
    console.log('filterProjects: projectGrid not found');
    return;
  }

  const projectCards = projectGrid.querySelectorAll('a[href^="/projects/detail/"]');

  if (currentSearchTerm === '') {
    // No search term, show all
    filteredProjects = Array.from(projectCards);
  } else {
    // Filter based on project name and description
    filteredProjects = Array.from(projectCards).filter(card => {
      const projectName = card.querySelector('h3').textContent.toLowerCase();
      const projectDesc = card.querySelector('p').textContent.toLowerCase();
      return projectName.includes(currentSearchTerm) || projectDesc.includes(currentSearchTerm);
    });
  }

  updatePagination();
  filterAndDisplayCards();
}

// Update pagination controls
function updatePagination() {
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, filteredProjects.length);

  // Update showing info
  const showingInfo = document.getElementById('projectShowingInfo');
  if (showingInfo) {
    if (filteredProjects.length === 0) {
      showingInfo.textContent = 'No projects found';
    } else {
      showingInfo.textContent = `Showing ${start}-${end} of ${filteredProjects.length} projects`;
    }
  }

  // Update page numbers
  const paginationNumbers = document.getElementById('projectPaginationNumbers');
  if (paginationNumbers) {
    paginationNumbers.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.onclick = () => changePage(i);
      button.className = `w-10 h-10 rounded-xl transition-all duration-300 font-medium ${
        i === currentPage
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
          : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700'
      }`;
      paginationNumbers.appendChild(button);
    }
  }

  // Update prev/next button states
  const prevBtn = document.getElementById('projectPrevBtn');
  const nextBtn = document.getElementById('projectNextBtn');
  if (prevBtn) prevBtn.disabled = currentPage === 1 || totalPages <= 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages <= 1;

  // Hide/show pagination container based on whether there are items to paginate
  const paginationContainer = document.getElementById('projectPaginationContainer');
  if (paginationContainer) {
    const shouldShow = filteredProjects.length > itemsPerPage;
    console.log('Pagination container - should show:', shouldShow, 'filtered length:', filteredProjects.length, 'items per page:', itemsPerPage);
    paginationContainer.style.display = shouldShow ? 'block' : 'none';
  }

  // Hide/show empty state
  const emptyState = document.getElementById('projectEmptyState');
  if (emptyState) {
    emptyState.style.display = filteredProjects.length === 0 ? 'block' : 'none';
  }
}

// Change page
function changePage(direction) {
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

  if (direction === 'prev' && currentPage > 1) {
    currentPage--;
  } else if (direction === 'next' && currentPage < totalPages) {
    currentPage++;
  } else if (typeof direction === 'number') {
    currentPage = Math.max(1, Math.min(direction, totalPages));
  }

  updatePagination();
  filterAndDisplayCards();

  // Scroll to grid top
  const projectGrid = document.getElementById('projectGrid');
  if (projectGrid) {
    projectGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Filter and display cards based on current page
function filterAndDisplayCards() {
  const projectGrid = document.getElementById('projectGrid');
  if (!projectGrid) {
    console.log('filterAndDisplayCards: projectGrid not found');
    return;
  }

  const allCards = projectGrid.querySelectorAll('a[href^="/projects/detail/"]');
//   console.log('filterAndDisplayCards - total cards:', allCards.length, 'filtered projects:', filteredProjects.length, 'current page:', currentPage);

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;

  let cardIndex = 0;
  let displayedCount = 0;

  allCards.forEach((card) => {
    const isInFilteredList = filteredProjects.includes(card);

    if (!isInFilteredList) {
      card.style.display = 'none';
      return;
    }

    // Show/hide based on pagination range
    if (cardIndex >= start && cardIndex < end) {
      card.style.display = '';
      displayedCount++;
    } else {
      card.style.display = 'none';
    }

    cardIndex++;
  });

  console.log('Displayed cards on page:', displayedCount);
}
