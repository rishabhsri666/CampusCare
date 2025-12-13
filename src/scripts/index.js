// Import Firebase services from config file
import { auth, db } from '../../firebase-config.js';

// Import Firebase authentication functions
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Import Firestore functions
import {
    doc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

console.log('index.js loaded');

// ============================================================================
// DOM ELEMENTS
// ============================================================================
let isSignupMode = true;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');

    // Get all form elements
    const authModeRadios = document.querySelectorAll('input[name="auth_mode"]');
    const formTitle = document.querySelector('.text-center h2');
    const formSubtitle = document.querySelector('.text-center p');

    // Get all buttons - there are 2: password toggle and submit
    const allButtons = document.querySelectorAll('form button[type="button"]');
    const passwordToggleBtn = allButtons[0]; // First button (in password field)
    const submitBtn = allButtons[1]; // Second button (Create Account)

    // Input fields
    const fullNameInput = document.querySelector('input[placeholder="John Doe"]');
    const uidInput = document.querySelector('input[placeholder="2024001"]');
    const branchSelect = document.querySelectorAll('select')[0];
    const yearSelect = document.querySelectorAll('select')[1];
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');

    // Signup field containers (to hide/show)
    const signupRow1 = fullNameInput.closest('.grid');
    const signupRow2 = branchSelect.closest('.grid');

    console.log('Elements loaded:', {
        submitBtn: !!submitBtn,
        emailInput: !!emailInput,
        passwordInput: !!passwordInput
    });

    // ============================================================================
    // AUTH MODE TOGGLE (Login/Signup)
    // ============================================================================
    authModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            isSignupMode = e.target.value === 'signup';
            updateFormMode();
        });
    });

    function updateFormMode() {
        if (isSignupMode) {
            formTitle.textContent = 'Create Student Account';
            formSubtitle.textContent = 'Enter your university details to get started';
            submitBtn.querySelector('span:first-child').textContent = 'Create Account';
            signupRow1.style.display = 'grid';
            signupRow2.style.display = 'grid';
        } else {
            formTitle.textContent = 'Welcome Back';
            formSubtitle.textContent = 'Login to your CampusCare account';
            submitBtn.querySelector('span:first-child').textContent = 'Log In';
            signupRow1.style.display = 'none';
            signupRow2.style.display = 'none';
        }
        console.log('Mode switched to:', isSignupMode ? 'Signup' : 'Login');
    }

    // ============================================================================
    // PASSWORD VISIBILITY TOGGLE
    // ============================================================================
    let passwordVisible = false;
    passwordToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        passwordVisible = !passwordVisible;
        passwordInput.type = passwordVisible ? 'text' : 'password';
        passwordToggleBtn.querySelector('.material-symbols-outlined').textContent =
            passwordVisible ? 'visibility' : 'visibility_off';
    });

    // ============================================================================
    // FORM SUBMISSION
    // ============================================================================
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('Submit clicked. Mode:', isSignupMode ? 'Signup' : 'Login');

        if (isSignupMode) {
            await handleSignup();
        } else {
            await handleLogin();
        }
    });

    // ============================================================================
    // SIGNUP FUNCTION
    // ============================================================================
    async function handleSignup() {
        console.log('Starting signup...');

        // Get form values
        const fullName = fullNameInput.value.trim();
        const uid = uidInput.value.trim();
        const branch = branchSelect.value;
        const year = yearSelect.value;
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validation
        if (!fullName) {
            showNotification('Please enter your full name', 'error');
            return;
        }
        if (!uid) {
            showNotification('Please enter your University ID', 'error');
            return;
        }
        if (!branch) {
            showNotification('Please select your branch', 'error');
            return;
        }
        if (!year) {
            showNotification('Please select your year', 'error');
            return;
        }
        if (!email) {
            showNotification('Please enter your email', 'error');
            return;
        }
        if (!email.endsWith('@kiet.edu')) {
            showNotification('Please use your college email (@kiet.edu)', 'error');
            return;
        }
        if (!password) {
            showNotification('Please enter a password', 'error');
            return;
        }
        if (password.length < 8) {
            showNotification('Password must be at least 8 characters', 'error');
            return;
        }

        // Show loading
        setLoading(true);

        try {
            // Create user account
            console.log('Creating user account...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('User created:', user.uid);

            // Save user data to Firestore
            console.log('Saving user data to Firestore...');
            await setDoc(doc(db, 'users', user.uid), {
                fullName: fullName,
                universityId: uid,
                branch: branch,
                year: year,
                email: email,
                role: 'student',
                createdAt: serverTimestamp()
            });
            console.log('User data saved');

            // Send verification email
            console.log('Sending verification email...');
            await sendEmailVerification(user);
            console.log('Verification email sent');

            showNotification(
                'Account created! Please verify your email, then log in.',
                'success'
            );
            // Clear form
            fullNameInput.value = '';
            uidInput.value = '';
            branchSelect.value = '';
            yearSelect.value = '';
            emailInput.value = '';
            passwordInput.value = '';

            // Redirect to dashboard after 2 seconds
            // setTimeout(() => {
            //     window.location.href = 'dashboard.html';
            // }, 2000);
            // IMPORTANT: Sign out user immediately
            await auth.signOut();

            

            // Switch to Login tab
            isSignupMode = false;
            updateFormMode();

        } catch (error) {
            console.error('Signup error:', error);
            handleError(error);
        } finally {
            setLoading(false);
        }
    }

    // ============================================================================
    // LOGIN FUNCTION
    // ============================================================================
    async function handleLogin() {
        console.log('Starting login...');

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validation
        if (!email) {
            showNotification('Please enter your email', 'error');
            return;
        }
        if (!email.endsWith('@kiet.edu')) {
            showNotification('Please use your college email (@kiet.edu)', 'error');
            return;
        }
        if (!password) {
            showNotification('Please enter your password', 'error');
            return;
        }

        // Show loading
        setLoading(true);

        try {
            console.log('Signing in...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('User logged in:', user.uid);

            // Check if email is verified
            if (!user.emailVerified) {
                showNotification('Please verify your email before logging in', 'warning');
                await auth.signOut();
                setLoading(false);
                return;
            }

            showNotification('Login successful!', 'success');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            handleError(error);
        } finally {
            setLoading(false);
        }
    }

    // ============================================================================
    // ERROR HANDLER
    // ============================================================================
    function handleError(error) {
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        switch (error.code) {
            case 'auth/email-already-in-use':
                showNotification('This email is already registered', 'error');
                break;
            case 'auth/invalid-email':
                showNotification('Invalid email address', 'error');
                break;
            case 'auth/weak-password':
                showNotification('Password is too weak', 'error');
                break;
            case 'auth/user-not-found':
                showNotification('No account found with this email', 'error');
                break;
            case 'auth/wrong-password':
                showNotification('Incorrect password', 'error');
                break;
            case 'auth/too-many-requests':
                showNotification('Too many attempts. Please try again later', 'error');
                break;
            default:
                showNotification(error.message || 'An error occurred', 'error');
        }
    }

    // ============================================================================
    // LOADING STATE
    // ============================================================================
    function setLoading(loading) {
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            const btnText = submitBtn.querySelector('span:first-child');
            btnText.textContent = 'Processing...';
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            const btnText = submitBtn.querySelector('span:first-child');
            btnText.textContent = isSignupMode ? 'Create Account' : 'Log In';
        }
    }

    // ============================================================================
    // NOTIFICATION SYSTEM
    // ============================================================================
    function showNotification(message, type = 'info') {
        console.log('Notification:', type, message);

        // Remove existing notification
        const existing = document.querySelector('.auth-notification');
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
        notification.className = `auth-notification fixed top-20 right-4 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl text-white ${colors[type]} transform transition-all duration-300`;
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

    // ============================================================================
    // CHECK AUTH STATE
    // ============================================================================
    onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified) {
            console.log('User already logged in and verified. Redirecting...');
            window.location.href = 'dashboard.html';
        }
    });

    console.log('Authentication system ready!');
});