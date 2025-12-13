// Import Firebase services from config file
import { auth, db } from '../../firebase-config.js';

// Import Firebase authentication functions
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Import Firestore functions
import { 
    collection,
    addDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Import Firebase Storage functions
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

console.log('issue.js loaded');

// Initialize Firebase Storage
const storage = getStorage();

// ============================================================================
// WAIT FOR DOM AND AUTH
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');

    // Check if user is logged in
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.log('No user logged in, redirecting to login...');
            showNotification('Please login to report an issue', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            return;
        }

        console.log('User logged in:', user.uid);
        initializeForm(user);
    });
});

// ============================================================================
// INITIALIZE FORM
// ============================================================================
function initializeForm(user) {
    console.log('Initializing form for user:', user.email);

    // Get form elements
    const categorySelect = document.querySelector('select');
    const buildingInput = document.querySelectorAll('input[type="text"]')[0];
    const roomInput = document.querySelectorAll('input[type="text"]')[1];
    const descriptionTextarea = document.querySelector('textarea');
    const fileInput = document.querySelector('input[type="file"]');
    const fileUploadArea = fileInput.parentElement;
    const submitBtn = document.querySelector('button[class*="bg-primary"]');

    console.log('Form elements found:', {
        categorySelect: !!categorySelect,
        buildingInput: !!buildingInput,
        roomInput: !!roomInput,
        descriptionTextarea: !!descriptionTextarea,
        fileInput: !!fileInput,
        submitBtn: !!submitBtn
    });

    // File upload preview
    let selectedFile = null;
    let filePreviewDiv = null;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            showFilePreview(file, fileUploadArea);
            console.log('File selected:', file.name, 'Size:', file.size);
        }
    });

    // Drag and drop support
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('border-primary', 'bg-blue-50', 'dark:bg-blue-900/20');
    });

    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-900/20');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-900/20');
        
        const file = e.dataTransfer.files[0];
        if (file) {
            selectedFile = file;
            fileInput.files = e.dataTransfer.files;
            showFilePreview(file, fileUploadArea);
            console.log('File dropped:', file.name);
        }
    });

    // Submit button handler
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('Submit button clicked');
        await handleSubmit(user, {
            categorySelect,
            buildingInput,
            roomInput,
            descriptionTextarea,
            selectedFile
        });
    });

    // Show file preview
    function showFilePreview(file, container) {
        // Remove existing preview
        if (filePreviewDiv) {
            filePreviewDiv.remove();
        }

        // Create preview
        filePreviewDiv = document.createElement('div');
        filePreviewDiv.className = 'mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between';
        
        filePreviewDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">image</span>
                <div>
                    <p class="text-sm font-medium text-slate-900 dark:text-white">${file.name}</p>
                    <p class="text-xs text-slate-500">${(file.size / 1024).toFixed(2)} KB</p>
                </div>
            </div>
            <button type="button" class="text-red-500 hover:text-red-700 transition-colors">
                <span class="material-symbols-outlined">close</span>
            </button>
        `;

        // Remove file on click
        filePreviewDiv.querySelector('button').addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            filePreviewDiv.remove();
            filePreviewDiv = null;
        });

        container.parentElement.appendChild(filePreviewDiv);
    }
}

// ============================================================================
// HANDLE FORM SUBMISSION
// ============================================================================
async function handleSubmit(user, formElements) {
    const { categorySelect, buildingInput, roomInput, descriptionTextarea, selectedFile } = formElements;

    // Get values
    const category = categorySelect.value;
    const building = buildingInput.value.trim();
    const room = roomInput.value.trim();
    const description = descriptionTextarea.value.trim();

    console.log('Form values:', { category, building, room, description, hasFile: !!selectedFile });

    // Validation
    if (!category) {
        showNotification('Please select an issue category', 'error');
        return;
    }
    if (!building) {
        showNotification('Please enter the building name', 'error');
        return;
    }
    if (!room) {
        showNotification('Please enter the room number', 'error');
        return;
    }
    if (!description) {
        showNotification('Please provide a detailed description', 'error');
        return;
    }
    if (description.length < 20) {
        showNotification('Please provide more details (at least 20 characters)', 'error');
        return;
    }

    // Show loading
    setLoading(true);

    try {
        let imageURL = null;

        // Upload image if selected
        if (selectedFile) {
            console.log('Uploading image...');
            imageURL = await uploadImage(selectedFile, user.uid);
            console.log('Image uploaded:', imageURL);
        }

        // Create issue document
        console.log('Creating issue document...');
        const issueData = {
            category: category,
            building: building,
            room: room,
            description: description,
            imageURL: imageURL,
            status: 'pending',
            priority: determinePriority(category),
            reportedBy: user.uid,
            reportedByEmail: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            resolvedAt: null,
            assignedTo: null,
            comments: []
        };

        const docRef = await addDoc(collection(db, 'issues'), issueData);
        console.log('Issue created with ID:', docRef.id);

        showNotification('Issue reported successfully! Tracking ID: ' + docRef.id.substring(0, 8), 'success');

        // Clear form
        categorySelect.value = '';
        buildingInput.value = '';
        roomInput.value = '';
        descriptionTextarea.value = '';
        if (formElements.selectedFile) {
            const fileInput = document.querySelector('input[type="file"]');
            fileInput.value = '';
            const preview = document.querySelector('.mt-3.p-3');
            if (preview) preview.remove();
        }

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Error submitting issue:', error);
        showNotification('Error submitting issue: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ============================================================================
// UPLOAD IMAGE TO FIREBASE STORAGE
// ============================================================================
async function uploadImage(file, userId) {
    // Validate file
    if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Image size must be less than 5MB');
    }

    // Create unique filename
    const timestamp = Date.now();
    const filename = `issues/${userId}/${timestamp}_${file.name}`;
    
    // Create storage reference
    const storageRef = ref(storage, filename);
    
    // Upload file
    console.log('Uploading to:', filename);
    const snapshot = await uploadBytes(storageRef, file);
    console.log('Upload successful');
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
}

// ============================================================================
// DETERMINE PRIORITY BASED ON CATEGORY
// ============================================================================
function determinePriority(category) {
    const highPriority = ['safety', 'electrical', 'plumbing'];
    const mediumPriority = ['hvac', 'cleaning'];
    
    if (highPriority.includes(category)) {
        return 'high';
    } else if (mediumPriority.includes(category)) {
        return 'medium';
    } else {
        return 'low';
    }
}

// ============================================================================
// LOADING STATE
// ============================================================================
function setLoading(loading) {
    const submitBtn = document.querySelector('button[class*="bg-primary"]');
    const btnText = submitBtn.querySelector('span:first-child');
    const btnIcon = submitBtn.querySelector('.material-symbols-outlined');

    if (loading) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        btnText.textContent = 'Submitting...';
        btnIcon.textContent = 'hourglass_empty';
    } else {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        btnText.textContent = 'Submit Report';
        btnIcon.textContent = 'send';
    }
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================
function showNotification(message, type = 'info') {
    console.log('Notification:', type, message);

    // Remove existing notification
    const existing = document.querySelector('.issue-notification');
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
    notification.className = `issue-notification fixed top-20 right-4 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl text-white ${colors[type]} transform transition-all duration-300`;
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl">${icons[type]}</span>
            <p class="font-medium">${message}</p>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}