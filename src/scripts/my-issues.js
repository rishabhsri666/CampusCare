// Import Firebase services
import { auth, db } from '../../firebase-config.js';

import {
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    limit
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

console.log('my-issues.js loaded');

// Global state
let currentUser = null;
let allIssues = [];
let filteredIssues = [];
let currentPage = 1;
const itemsPerPage = 5;

// DOM Elements
const userNameSidebar = document.querySelector('.sidebar-user-name');
const userUidSidebar = document.querySelector('.sidebar-user-uid');
const logoutBtn = document.querySelector('.logout-btn');
const reportIssueBtn = document.getElementById('report-issue-btn');
const searchInput = document.querySelector('input[placeholder*="Search"]');

// Container for issues - the card that contains everything
let issuesCard = null;
let issuesInsertPoint = null;

// ============================================================================
// INITIALIZE
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');

    // Find the issues card container
    issuesCard = document.querySelector('.bg-white.dark\\:bg-\\[\\#15202b\\].rounded-xl.shadow-sm.border.overflow-hidden');
    
    if (!issuesCard) {
        console.error('Issues card not found!');
        return;
    }

    console.log('Issues card found');

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('No user logged in, redirecting...');
            window.location.href = '../index.html';
            return;
        }

        if (!user.emailVerified) {
            console.log('Email not verified');
            alert('Please verify your email before accessing this page');
            await signOut(auth);
            window.location.href = '../index.html';
            return;
        }

        currentUser = user;
        console.log('User logged in:', user.uid);

        // Load user data
        await loadUserData(user);

        // Load issues
        await loadUserIssues(user.uid);
    });

    // Event listeners
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (reportIssueBtn) {
        reportIssueBtn.addEventListener('click', () => {
            window.location.href = 'issue.html';
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
});

// ============================================================================
// LOAD USER DATA
// ============================================================================
async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userNameSidebar) userNameSidebar.textContent = userData.fullName || 'Student';
            if (userUidSidebar) userUidSidebar.textContent = `Student ID: ${userData.universityId || 'N/A'}`;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// ============================================================================
// LOAD USER ISSUES
// ============================================================================
async function loadUserIssues(userId) {
    try {
        console.log('Loading issues for user:', userId);

        showLoading();

        const issuesRef = collection(db, 'issues');
        const q = query(
            issuesRef,
            where('reportedBy', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        allIssues = [];

        querySnapshot.forEach((doc) => {
            allIssues.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log('Loaded issues:', allIssues.length);

        // Initialize filtered issues
        filteredIssues = [...allIssues];

        // Reset to page 1
        currentPage = 1;

        // Render issues
        renderIssues();

    } catch (error) {
        console.error('Error loading issues:', error);
        showError('Error loading your issues. Please try again.');
    }
}

// ============================================================================
// SEARCH HANDLER
// ============================================================================
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (!searchTerm) {
        filteredIssues = [...allIssues];
    } else {
        filteredIssues = allIssues.filter(issue => {
            return (
                issue.id.toLowerCase().includes(searchTerm) ||
                issue.category.toLowerCase().includes(searchTerm) ||
                issue.building.toLowerCase().includes(searchTerm) ||
                issue.room.toLowerCase().includes(searchTerm) ||
                issue.description.toLowerCase().includes(searchTerm)
            );
        });
    }

    // Reset to page 1 after search
    currentPage = 1;
    renderIssues();
}

// ============================================================================
// CLEAR ISSUE ROWS
// ============================================================================
function clearIssueRows() {
    // Find all div elements that are issue rows (between header and pagination)
    const header = issuesCard.querySelector('.hidden.md\\:grid');
    if (!header) return;

    // Remove all siblings after header until we hit pagination or end
    let nextElement = header.nextElementSibling;
    while (nextElement) {
        const toRemove = nextElement;
        nextElement = nextElement.nextElementSibling;
        
        // Stop if we hit the pagination (it has flex and items-center classes)
        if (toRemove.classList.contains('flex') && toRemove.classList.contains('items-center')) {
            toRemove.remove();
            break;
        }
        
        toRemove.remove();
    }
}

// ============================================================================
// RENDER ISSUES
// ============================================================================
function renderIssues() {
    if (!issuesCard) {
        console.error('Issues card not found');
        return;
    }

    // Clear existing issue rows
    clearIssueRows();

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedIssues = filteredIssues.slice(startIndex, endIndex);

    const header = issuesCard.querySelector('.hidden.md\\:grid');
    if (!header) {
        console.error('Header not found');
        return;
    }

    // If no issues, show empty state
    if (paginatedIssues.length === 0) {
        showEmptyState();
        return;
    }

    // Insert each issue row after the header
    paginatedIssues.forEach((issue) => {
        const issueRow = createIssueRow(issue);
        header.insertAdjacentElement('afterend', issueRow);
        
        // Move the newly inserted row to the end (so they stack in order)
        const lastRow = issuesCard.querySelector('.grid.grid-cols-1:last-of-type');
        if (lastRow && lastRow !== issueRow) {
            lastRow.insertAdjacentElement('afterend', issueRow);
        }
    });

    // Render pagination at the end
    renderPagination();
}

// ============================================================================
// CREATE ISSUE ROW
// ============================================================================
function createIssueRow(issue) {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 border-b border-[#e7edf3] dark:border-slate-800 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer';
    
    const categoryIcon = getCategoryIcon(issue.category);
    const statusBadge = getStatusBadge(issue.status);
    const ticketId = `#TCK-${issue.id.substring(0, 8).toUpperCase()}`;

    row.innerHTML = `
        <div class="col-span-1 md:col-span-4 flex gap-4 items-start">
            <div class="shrink-0 size-10 rounded-full ${categoryIcon.bg} flex items-center justify-center ${categoryIcon.text}">
                <span class="material-symbols-outlined">${categoryIcon.icon}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-sm font-bold text-[#0d141b] dark:text-white">${capitalizeFirst(issue.category)}</span>
                <span class="text-xs font-mono text-[#4c739a] dark:text-slate-500 mb-1">${ticketId}</span>
                <p class="text-sm text-[#4c739a] dark:text-slate-400 line-clamp-1">${issue.description}</p>
            </div>
        </div>
        <div class="col-span-1 md:col-span-3 flex items-center gap-2 text-sm text-[#0d141b] dark:text-slate-200">
            <span class="material-symbols-outlined text-[18px] text-[#4c739a] md:hidden">location_on</span>
            <span>${issue.building}, ${issue.room}</span>
        </div>
        <div class="col-span-1 md:col-span-2 flex items-center gap-2 text-sm text-[#0d141b] dark:text-slate-200">
            <span class="material-symbols-outlined text-[18px] text-[#4c739a] md:hidden">event</span>
            <span>${formatDate(issue.createdAt)}</span>
        </div>
        <div class="col-span-1 md:col-span-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.text} border ${statusBadge.border}">
                <span class="size-1.5 rounded-full ${statusBadge.dot}"></span>
                ${statusBadge.label}
            </span>
        </div>
        <div class="col-span-1 text-right">
            <button class="text-[#4c739a] hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                <span class="material-symbols-outlined">visibility</span>
            </button>
        </div>
    `;

    // Click handler to view details
    row.addEventListener('click', () => {
        window.location.href = `issue-details.html?id=${issue.id}`;
    });

    return row;
}

// ============================================================================
// RENDER PAGINATION
// ============================================================================
function renderPagination() {
    const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
    const startItem = filteredIssues.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredIssues.length);

    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'flex items-center justify-between px-6 py-4 bg-[#fcfdfe] dark:bg-slate-900 border-t border-[#e7edf3] dark:border-slate-800';

    paginationDiv.innerHTML = `
        <div class="text-sm text-[#4c739a] dark:text-slate-400">
            Showing <span class="font-medium text-[#0d141b] dark:text-white">${startItem}</span> to 
            <span class="font-medium text-[#0d141b] dark:text-white">${endItem}</span> of 
            <span class="font-medium text-[#0d141b] dark:text-white">${filteredIssues.length}</span> results
        </div>
        <div class="flex items-center gap-2">
            ${renderPaginationButtons(totalPages)}
        </div>
    `;

    issuesCard.appendChild(paginationDiv);

    // Attach event listeners
    attachPaginationListeners();
}

// ============================================================================
// RENDER PAGINATION BUTTONS
// ============================================================================
function renderPaginationButtons(totalPages) {
    let buttons = '';

    // Previous button
    buttons += `
        <button class="pagination-btn prev-btn flex items-center justify-center size-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-[#15202b] text-[#4c739a] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
        </button>
    `;

    // Page numbers
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
            buttons += createPageButton(i);
        }
    } else {
        buttons += createPageButton(1);

        if (currentPage > 3) {
            buttons += `<span class="text-[#4c739a] px-1">...</span>`;
        }

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
            buttons += createPageButton(i);
        }

        if (currentPage < totalPages - 2) {
            buttons += `<span class="text-[#4c739a] px-1">...</span>`;
        }

        buttons += createPageButton(totalPages);
    }

    // Next button
    buttons += `
        <button class="pagination-btn next-btn flex items-center justify-center size-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-[#15202b] text-[#4c739a] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
        </button>
    `;

    return buttons;
}

function createPageButton(pageNum) {
    const isActive = pageNum === currentPage;
    return `
        <button class="pagination-btn page-btn flex items-center justify-center size-8 rounded-lg ${isActive ? 'bg-primary text-white shadow-sm' : 'border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-[#15202b] text-[#0d141b] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800'} text-sm font-medium transition-colors" data-page="${pageNum}">
            ${pageNum}
        </button>
    `;
}

// ============================================================================
// ATTACH PAGINATION LISTENERS
// ============================================================================
function attachPaginationListeners() {
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const pageButtons = document.querySelectorAll('.page-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderIssues();
                scrollToTop();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderIssues();
                scrollToTop();
            }
        });
    }

    pageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            currentPage = page;
            renderIssues();
            scrollToTop();
        });
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function scrollToTop() {
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showLoading() {
    clearIssueRows();
    
    const header = issuesCard.querySelector('.hidden.md\\:grid');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'flex items-center justify-center py-20';
    loadingDiv.innerHTML = `
        <div class="flex flex-col items-center gap-4">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p class="text-slate-500 dark:text-slate-400">Loading your issues...</p>
        </div>
    `;
    header.insertAdjacentElement('afterend', loadingDiv);
}

function showEmptyState() {
    const header = issuesCard.querySelector('.hidden.md\\:grid');
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'flex flex-col items-center justify-center py-20 px-4';
    emptyDiv.innerHTML = `
        <span class="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">inbox</span>
        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">No issues found</h3>
        <p class="text-slate-500 dark:text-slate-400 text-center mb-6">
            ${searchInput && searchInput.value ? 'Try adjusting your search terms' : "You haven't reported any issues yet"}
        </p>
        ${!searchInput || !searchInput.value ? `
            <button onclick="window.location.href='issue.html'" class="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-colors">
                <span class="material-symbols-outlined text-[20px]">add</span>
                <span>Report Your First Issue</span>
            </button>
        ` : ''}
    `;
    header.insertAdjacentElement('afterend', emptyDiv);
}

function showError(message) {
    clearIssueRows();
    
    const header = issuesCard.querySelector('.hidden.md\\:grid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'flex flex-col items-center justify-center py-20 px-4';
    errorDiv.innerHTML = `
        <span class="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Error</h3>
        <p class="text-slate-500 dark:text-slate-400 text-center">${message}</p>
    `;
    header.insertAdjacentElement('afterend', errorDiv);
}

function getCategoryIcon(category) {
    const icons = {
        electrical: { icon: 'bolt', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
        plumbing: { icon: 'water_drop', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
        hvac: { icon: 'ac_unit', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400' },
        cleaning: { icon: 'cleaning_services', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
        safety: { icon: 'shield', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
        other: { icon: 'help', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' }
    };
    return icons[category] || icons.other;
}

function getStatusBadge(status) {
    const badges = {
        pending: {
            bg: 'bg-orange-100 dark:bg-orange-900/30',
            text: 'text-orange-700 dark:text-orange-400',
            border: 'border-orange-200 dark:border-orange-800',
            dot: 'bg-orange-500',
            label: 'Pending'
        },
        active: {
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-700 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800',
            dot: 'bg-blue-500',
            label: 'Active'
        },
        // 'in-progress': {
        //     bg: 'bg-blue-100 dark:bg-blue-900/30',
        //     text: 'text-blue-700 dark:text-blue-400',
        //     border: 'border-blue-200 dark:border-blue-800',
        //     dot: 'bg-blue-500',
        //     label: 'In Progress'
        // },
        resolved: {
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            text: 'text-emerald-700 dark:text-emerald-400',
            border: 'border-emerald-200 dark:border-emerald-800',
            dot: 'bg-emerald-500',
            label: 'Resolved'
        }
    };
    return badges[status] || badges.pending;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        let date;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'N/A';
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = '../index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

console.log('my-issues.js initialized');