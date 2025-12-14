import { auth, db } from "../../firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const userNameSidebar = document.querySelector(".sidebar-user-name");
const userUidSidebar = document.querySelector(".sidebar-user-uid");
const userWelcomeHeading = document.querySelector(".dashboard-welcome-name");
const dashboardDateEl = document.querySelector(".dashboard-date");
const logoutButton = document.querySelector(".logout-btn");
const recentIssuesBody = document.getElementById("recent-issues-body");
const reportIssueBtn = document.getElementById("report-issue-btn");

onAuthStateChanged(auth, user => {
    if (user) {
        loadIssueCounts(user.uid);
    }
});


// ---------- Date Formatter ----------
function formatDate(ts) {
    if (!ts) return "—";
    const date = ts.toDate();
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}



// ---------- Load User Info ----------
async function loadUserDashboard(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return;

    const data = snap.data();

    userNameSidebar.textContent = data.fullName;
    userUidSidebar.textContent = `Student ID: ${data.universityId}`;

    userWelcomeHeading.textContent = `Welcome back, ${data.fullName.split(" ")[0]} !`;
    dashboardDateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
    });

    await loadUserIssues(user.uid);
    await loadIssueCounts(user.uid);
}

// -------------------------------
// Load Issue Counts
// -------------------------------
async function loadIssueCounts(userId) {
    // Single query: fetch all issues for this user
    const issuesRef = collection(db, "issues");
    const q = query(issuesRef, where("reportedBy", "==", userId));

    const snap = await getDocs(q);

    // Prepare counters
    let pending = 0;
    let active = 0;
    let resolved = 0;

    snap.forEach(doc => {
        const data = doc.data();

        if (data.status === "pending") pending++;
        else if (data.status === "active") active++;
        else if (data.status === "resolved") resolved++;
    });

    // Update UI (verify IDs exist)
    const elActive = document.getElementById("count-active");
    const elResolved = document.getElementById("count-resolved");
    const elPending = document.getElementById("count-pending");

    if (elActive) elActive.textContent = active;
    if (elResolved) elResolved.textContent = resolved;
    if (elPending) elPending.textContent = pending;
}


// ---------- Load Issues for This User ----------
async function loadUserIssues(userId) {

    const issuesRef = collection(db, "issues");

    // Fetch only issues reported by this user
    const q = query(
        issuesRef,
        where("reportedBy", "==", userId),
        orderBy("createdAt", "desc"), 
        limit(5)
    );

    const snapshot = await getDocs(q);

    recentIssuesBody.innerHTML = ""; // clear old UI

    if (snapshot.empty) {
        recentIssuesBody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-4 text-slate-500">
                No issues reported yet.
            </td>
        </tr>`;
        return;
    }

    snapshot.forEach(docSnap => {
        const issue = docSnap.data();

        // Map priority → icon + color
        const priorityColors = {
            high: "text-red-600 bg-red-100 dark:bg-red-900/20",
            medium: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20",
            low: "text-green-600 bg-green-100 dark:bg-green-900/20"
        };

        const priorityIcon = {
            high: "error",
            medium: "warning",
            low: "check_circle"
        };

        const row = document.createElement("tr");
        row.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";

        row.innerHTML = `
            <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                    <div class="size-8 rounded-full ${priorityColors[issue.priority]} flex items-center justify-center">
                        <span class="material-symbols-outlined text-[18px]">
                            ${priorityIcon[issue.priority]}
                        </span>
                    </div>
                    <span class="font-medium text-slate-900 dark:text-white text-sm">
                        ${issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}
                    </span>
                </div>
            </td>

            <td class="py-4 px-6 text-sm text-slate-600 dark:text-slate-400">
                ${issue.building} – ${issue.room}
            </td>

            <td class="py-4 px-6 text-sm text-slate-500">
                ${formatDate(issue.createdAt)}
            </td>

            <td class="py-4 px-6">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                    ${
                        issue.status === "resolved"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : issue.status === "in-progress"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                    }">
                    <span class="size-1.5 rounded-full ${
                        issue.status === "resolved"
                        ? "bg-green-500"
                        : issue.status === "in-progress"
                        ? "bg-blue-500"
                        : "bg-orange-500"
                    }"></span>
                    ${issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                </span>
            </td>
        `;

        recentIssuesBody.appendChild(row);
    });
}


// ---------- Auth Listener ----------
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    loadUserDashboard(user);
});

reportIssueBtn.addEventListener("click", async () => {
    window.location.href = "issue.html";
});

// ---------- Logout ----------
logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "auth.html";
});