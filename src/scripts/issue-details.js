// Import Firebase services
import { auth, db } from '../../firebase-config.js';

import { 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import { 
    doc, 
    getDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

console.log('issue-details.js loaded');

// Get issue ID from URL
const urlParams = new URLSearchParams(window.location.search);
const issueId = urlParams.get('id');

let currentUser = null;
let currentUserData = null;
let currentIssue = null;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const issueContent = document.getElementById('issue-content');

// ============================================================================
// INITIALIZE
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!issueId) {
        showError();
        return;
    }

    // Check auth state
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        currentUser = user;
        
        // Get user data to check if admin
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }

        await loadIssueDetails();
    });
});

// ============================================================================
// LOAD ISSUE DETAILS
// ============================================================================
async function loadIssueDetails() {
    try {
        console.log('Loading issue:', issueId);

        const issueRef = doc(db, 'issues', issueId);
        const issueSnap = await getDoc(issueRef);

        if (!issueSnap.exists()) {
            showError();
            return;
        }

        currentIssue = { id: issueSnap.id, ...issueSnap.data() };
        console.log('Issue loaded:', currentIssue);

        // Check if user is admin OR the reporter
        const isAdmin = currentUserData && currentUserData.role === 'admin';
        const isReporter = currentUser.uid === currentIssue.reportedBy;

        if (!isAdmin && !isReporter) {
            showError('You do not have permission to view this issue.');
            return;
        }

        displayIssue(currentIssue);
        
        // Show admin actions only if admin
        if (isAdmin) {
            showAdminActions(currentIssue);
        }

    } catch (error) {
        console.error('Error loading issue:', error);
        showError();
    }
}

// ============================================================================
// DISPLAY ISSUE
// ============================================================================
function displayIssue(issue) {
    // Hide loading, show content
    loadingState.classList.add('hidden');
    issueContent.classList.remove('hidden');

    // Title and Status
    document.getElementById('issue-title').textContent = capitalizeFirst(issue.category) + ' Issue';
    document.getElementById('issue-id').textContent = issue.id.substring(0, 12);
    
    // Status Badge
    const statusBadge = document.getElementById('issue-status-badge');
    const statusInfo = getStatusInfo(issue.status);
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.text}`;
    statusBadge.textContent = statusInfo.label;

    // Priority Badge
    const priorityBadge = document.getElementById('priority-badge');
    const priorityInfo = getPriorityInfo(issue.priority);
    priorityBadge.className = `px-4 py-2 rounded-lg font-bold text-sm ${priorityInfo.bg} ${priorityInfo.text}`;
    priorityBadge.innerHTML = `<span class="material-symbols-outlined text-[20px] inline-block mr-1">${priorityInfo.icon}</span>${priorityInfo.label} Priority`;

    // Issue Information
    document.getElementById('issue-category').textContent = capitalizeFirst(issue.category);
    document.getElementById('issue-location').textContent = `${issue.building} - ${issue.room}`;
    document.getElementById('issue-date').textContent = formatDate(issue.createdAt);
    document.getElementById('issue-reporter').textContent = issue.reportedByEmail || 'Unknown';

    // Description
    document.getElementById('issue-description').textContent = issue.description;

    // Image
    if (issue.imageURL) {
        const imageCard = document.getElementById('issue-image-card');
        const imageEl = document.getElementById('issue-image');
        imageCard.classList.remove('hidden');
        imageEl.src = issue.imageURL;
        imageEl.onclick = () => window.open(issue.imageURL, '_blank');
    }

    // Reporter Details
    document.getElementById('reporter-email').textContent = issue.reportedByEmail || 'N/A';
    document.getElementById('reporter-id').textContent = issue.reportedBy || 'N/A';

    // Comments
    displayComments(issue.comments || []);

    // Timeline
    displayTimeline(issue);
}

// ============================================================================
// DISPLAY COMMENTS
// ============================================================================
function displayComments(comments) {
    const commentsList = document.getElementById('comments-list');
    
    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2 opacity-50">chat_bubble_outline</span>
                <p>No comments yet. Be the first to comment!</p>
            </div>
        `;
        return;
    }

    commentsList.innerHTML = '';
    comments.forEach((comment) => {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700';
        
        commentDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-[18px]">person</span>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-semibold text-sm">${comment.authorEmail || 'User'}</span>
                        <span class="text-xs text-slate-500">${formatDate(comment.timestamp)}</span>
                    </div>
                    <p class="text-sm text-slate-700 dark:text-slate-300">${escapeHtml(comment.text)}</p>
                </div>
            </div>
        `;
        
        commentsList.appendChild(commentDiv);
    });
}

// ============================================================================
// DISPLAY TIMELINE
// ============================================================================
function displayTimeline(issue) {
    const timeline = document.getElementById('timeline');
    const events = [];

    // Created event
    events.push({
        icon: 'add_circle',
        color: 'text-blue-500',
        label: 'Issue Created',
        date: issue.createdAt
    });

    // Status changes
    if (issue.status === 'active' || issue.status === 'in-progress' || issue.status === 'resolved') {
        events.push({
            icon: 'play_arrow',
            color: 'text-orange-500',
            label: 'Issue Activated',
            date: issue.updatedAt
        });
    }

    if (issue.status === 'resolved') {
        events.push({
            icon: 'check_circle',
            color: 'text-green-500',
            label: 'Issue Resolved',
            date: issue.resolvedAt || issue.updatedAt
        });
    }

    timeline.innerHTML = '';
    events.forEach((event, index) => {
        const isLast = index === events.length - 1;
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'flex gap-3';
        
        eventDiv.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="size-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <span class="material-symbols-outlined ${event.color} text-[20px]">${event.icon}</span>
                </div>
                ${!isLast ? '<div class="w-0.5 h-8 bg-slate-200 dark:bg-slate-700"></div>' : ''}
            </div>
            <div class="flex-1 pb-${isLast ? '0' : '4'}">
                <p class="font-semibold text-sm">${event.label}</p>
                <p class="text-xs text-slate-500">${formatDate(event.date)}</p>
            </div>
        `;
        
        timeline.appendChild(eventDiv);
    });
}

// ============================================================================
// SHOW ADMIN ACTIONS (ADMIN ONLY)
// ============================================================================
function showAdminActions(issue) {
    const adminActions = document.getElementById('admin-actions');
    const activateBtn = document.getElementById('activate-btn');
    const resolveBtn = document.getElementById('resolve-btn');

    adminActions.classList.remove('hidden');

    // Configure buttons based on status
    if (issue.status === 'pending') {
        activateBtn.classList.remove('hidden');
        activateBtn.disabled = false;
        activateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        
        resolveBtn.disabled = true;
        resolveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (issue.status === 'active' || issue.status === 'in-progress') {
        activateBtn.classList.add('hidden');
        
        resolveBtn.disabled = false;
        resolveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else if (issue.status === 'resolved') {
        activateBtn.classList.add('hidden');
        
        resolveBtn.disabled = true;
        resolveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        resolveBtn.innerHTML = `
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            <span>Already Resolved</span>
        `;
    }

    // Event listeners
    activateBtn.onclick = () => updateIssueStatus('active');
    resolveBtn.onclick = () => updateIssueStatus('resolved');
}

// ============================================================================
// UPDATE ISSUE STATUS (ADMIN ONLY)
// ============================================================================
async function updateIssueStatus(newStatus) {
    // Double-check admin permission
    if (!currentUserData || currentUserData.role !== 'admin') {
        showNotification('You do not have permission to perform this action', 'error');
        return;
    }

    try {
        const updateData = {
            status: newStatus,
            updatedAt: serverTimestamp()
        };

        if (newStatus === 'resolved') {
            updateData.resolvedAt = serverTimestamp();
        }

        await updateDoc(doc(db, 'issues', issueId), updateData);

        showNotification(`Issue ${newStatus === 'active' ? 'activated' : 'resolved'} successfully!`, 'success');
        
        // Reload issue details
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error updating issue status', 'error');
    }
}

// ============================================================================
// ADD COMMENT
// ============================================================================
const commentInput = document.getElementById('comment-input');
const addCommentBtn = document.getElementById('add-comment-btn');

addCommentBtn.addEventListener('click', async () => {
    const text = commentInput.value.trim();
    
    if (!text) {
        showNotification('Please enter a comment', 'error');
        return;
    }

    if (text.length > 500) {
        showNotification('Comment is too long (max 500 characters)', 'error');
        return;
    }

    try {
        const comment = {
            text: text,
            authorEmail: currentUser.email,
            authorId: currentUser.uid,
            timestamp: new Date()
        };

        await updateDoc(doc(db, 'issues', issueId), {
            comments: arrayUnion(comment),
            updatedAt: serverTimestamp()
        });

        showNotification('Comment added successfully', 'success');
        commentInput.value = '';

        // Reload issue
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Error adding comment:', error);
        showNotification('Error adding comment', 'error');
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function showError(message = 'Issue not found or you do not have permission to view it.') {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    
    const errorMsg = errorState.querySelector('p');
    if (errorMsg) {
        errorMsg.textContent = message;
    }
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        let date;
        // Check if it's a Firestore Timestamp
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } 
        // Check if it's already a Date object
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        // Try to parse as date string or number
        else {
            date = new Date(timestamp);
        }

        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error, timestamp);
        return 'N/A';
    }
}

function getStatusInfo(status) {
    const statusMap = {
        'pending': {
            bg: 'bg-orange-100 dark:bg-orange-900/30',
            text: 'text-orange-700 dark:text-orange-300',
            label: 'Pending'
        },
        'in-progress': {
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-700 dark:text-blue-300',
            label: 'In Progress'
        },
        'active': {
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-700 dark:text-blue-300',
            label: 'Active'
        },
        'resolved': {
            bg: 'bg-green-100 dark:bg-green-900/30',
            text: 'text-green-700 dark:text-green-300',
            label: 'Resolved'
        }
    };
    return statusMap[status] || statusMap['pending'];
}

function getPriorityInfo(priority) {
    const priorityMap = {
        'high': {
            bg: 'bg-red-100 dark:bg-red-900/20',
            text: 'text-red-700 dark:text-red-300',
            icon: 'priority_high',
            label: 'High'
        },
        'medium': {
            bg: 'bg-yellow-100 dark:bg-yellow-900/20',
            text: 'text-yellow-700 dark:text-yellow-300',
            icon: 'warning',
            label: 'Medium'
        },
        'low': {
            bg: 'bg-green-100 dark:bg-green-900/20',
            text: 'text-green-700 dark:text-green-300',
            icon: 'arrow_downward',
            label: 'Low'
        }
    };
    return priorityMap[priority] || priorityMap['medium'];
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.detail-notification');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const notification = document.createElement('div');
    notification.className = `detail-notification fixed top-20 right-4 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl text-white ${colors[type]} transform transition-all duration-300`;
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl">${icons[type]}</span>
            <p class="font-medium">${escapeHtml(message)}</p>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    loadUserDashboard(user);
});