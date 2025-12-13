import { auth,db } from "../../firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const tbody = document.getElementById("admin-issues-body");
const searchInput = document.getElementById("filter-search");
const categoryFilter = document.getElementById("filter-category");
const sortFilter = document.getElementById("filter-sort");
const pendingCount = document.getElementById("admin-pending-count");
const logoutButton = document.querySelector(".logout-btn");


function formatDate(ts) {
    if (!ts) return "—";
    const d = ts.toDate();
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Load all PENDING or ACTIVE issues
async function loadIssues() {
    let q = query(collection(db, "issues"), where("status", "in", ["pending", "active"]));

    // Category filter
    if (categoryFilter.value) {
        q = query(
            collection(db, "issues"),
            where("status", "in", ["pending", "active"]),
            where("category", "==", categoryFilter.value)
        );
    }

    const snap = await getDocs(q);
    let issues = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sorting
    if (sortFilter.value === "newest") {
        issues.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
    } else if (sortFilter.value === "oldest") {
        issues.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds);
    } else if (sortFilter.value === "priority") {
        const rank = { high: 1, medium: 2, low: 3 };
        issues.sort((a, b) => rank[a.priority] - rank[b.priority]);
    }

    // Search
    const term = searchInput.value.toLowerCase();
    if (term.length > 0) {
        issues = issues.filter(issue =>
            issue.description?.toLowerCase().includes(term) ||
            issue.category?.toLowerCase().includes(term) ||
            issue.building?.toLowerCase().includes(term) ||
            issue.room?.toLowerCase().includes(term)
        );
    }

    // Update pending count
    const pendingOnly = issues.filter(i => i.status === "pending");
    pendingCount.textContent = pendingOnly.length;

    // Render table
    tbody.innerHTML = "";

    if (issues.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-12">
                    <div class="flex flex-col items-center gap-3">
                        <span class="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">inbox</span>
                        <p class="text-slate-500 dark:text-slate-400 text-lg">No issues found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    issues.forEach(issue => renderRow(issue));
}

function renderRow(issue) {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer";

    tr.innerHTML = `
        <td class="px-6 py-4">
            <span class="font-medium capitalize">${issue.category}</span>
        </td>
        <td class="px-6 py-4 text-slate-600 dark:text-slate-400">
            ${issue.building} - ${issue.room}
        </td>
        <td class="px-6 py-4 text-slate-500">${formatDate(issue.createdAt)}</td>
        <td class="px-6 py-4">${renderPriority(issue.priority)}</td>
        <td class="px-6 py-4">${renderStatus(issue.status)}</td>
        <td class="px-6 py-4 text-right">
            <div class="flex items-center justify-end gap-2">
                <button class="view-btn px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium" data-id="${issue.id}">
                    View Details
                </button>
                ${renderQuickActions(issue)}
            </div>
        </td>
    `;

    tbody.appendChild(tr);

    // Attach event listeners AFTER inserting row
    attachRowHandlers(issue, tr);
}

function renderPriority(priority) {
    const colors = {
        high: 'text-red-600 dark:text-red-400 font-bold',
        medium: 'text-yellow-600 dark:text-yellow-400 font-semibold',
        low: 'text-green-600 dark:text-green-400 font-medium'
    };
    return `<span class="${colors[priority] || colors.medium}">${priority.toUpperCase()}</span>`;
}

function renderStatus(status) {
    if (status === "pending")
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            <span class="size-1.5 rounded-full bg-orange-500"></span>
            Pending
        </span>`;
    if (status === "active")
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <span class="size-1.5 rounded-full bg-blue-500"></span>
            Active
        </span>`;
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <span class="size-1.5 rounded-full bg-green-500"></span>
        Resolved
    </span>`;
}

function renderQuickActions(issue) {
    if (issue.status === "pending") {
        return `
            <button class="activate-btn px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium" data-id="${issue.id}">
                Activate
            </button>
        `;
    }

    if (issue.status === "active") {
        return `
            <button class="resolve-btn px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium" data-id="${issue.id}">
                Resolve
            </button>
        `;
    }

    return '';
}

function attachRowHandlers(issue, row) {
    // View Details button
    const viewBtn = row.querySelector(".view-btn");
    if (viewBtn) {
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `issue-details.html?id=${issue.id}`;
        };
    }

    // Quick action buttons
    const activateBtn = row.querySelector(".activate-btn");
    const resolveBtn = row.querySelector(".resolve-btn");

    if (activateBtn) {
        activateBtn.onclick = async (e) => {
            e.stopPropagation();
            activateBtn.textContent = "Activating...";
            activateBtn.disabled = true;

            try {
                await updateDoc(doc(db, "issues", issue.id), {
                    status: "active",
                    updatedAt: new Date()
                });
                showNotification('Issue activated successfully', 'success');
                loadIssues();
            } catch (error) {
                console.error('Error activating issue:', error);
                showNotification('Error activating issue', 'error');
                activateBtn.textContent = "Activate";
                activateBtn.disabled = false;
            }
        };
    }

    if (resolveBtn) {
        resolveBtn.onclick = async (e) => {
            e.stopPropagation();
            resolveBtn.textContent = "Resolving...";
            resolveBtn.disabled = true;

            try {
                await updateDoc(doc(db, "issues", issue.id), {
                    status: "resolved",
                    resolvedAt: new Date(),
                    updatedAt: new Date()
                });
                showNotification('Issue resolved successfully', 'success');
                loadIssues();
            } catch (error) {
                console.error('Error resolving issue:', error);
                showNotification('Error resolving issue', 'error');
                resolveBtn.textContent = "Resolve";
                resolveBtn.disabled = false;
            }
        };
    }

    // Make entire row clickable to view details
    row.onclick = () => {
        window.location.href = `issue-details.html?id=${issue.id}`;
    };
}

// Notification system
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.admin-notification');
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
    notification.className = `admin-notification fixed top-4 right-4 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl text-white ${colors[type]} transform transition-all duration-300`;
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl">${icons[type]}</span>
            <p class="font-medium">${message}</p>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    loadUserDashboard(user);
});

logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// Listeners
searchInput.addEventListener("input", loadIssues);
categoryFilter.addEventListener("change", loadIssues);
sortFilter.addEventListener("change", loadIssues);

// Initial load
loadIssues();

console.log('Admin dashboard initialized');