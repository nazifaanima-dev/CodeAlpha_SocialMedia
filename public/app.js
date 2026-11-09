
"use strict";

// ==========================================
// HEYO - SOCIAL MEDIA PLATFORM
// Frontend + Express API + MySQL Integration
// ==========================================

const state = {
    user: null,
    posts: [],
    currentCommentPost: null,
    currentProfile: null,
    authMode: "login",
    editingPost: null
};

const $ = selector => document.querySelector(selector);

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

function initials(name) {
    return String(name || "H").trim().charAt(0).toUpperCase();
}

function formatDate(date) {
    return new Date(date).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

// ==========================================
// CUSTOM HEYO NOTIFICATIONS
// ==========================================

function notify(message, type = "success") {
    let container = document.getElementById("heyo-toast-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "heyo-toast-container";

        container.style.cssText = `
            position:fixed;
            top:24px;
            right:24px;
            z-index:99999;
            display:flex;
            flex-direction:column;
            gap:12px;
            width:min(360px,calc(100vw - 32px));
            pointer-events:none;
        `;

        document.body.appendChild(container);
    }

    const colors = {
        success: "#55d6be",
        error: "#ff7185",
        info: "#a99aff"
    };

    const icons = {
        success: "✓",
        error: "!",
        info: "✦"
    };

    const toast = document.createElement("div");

    toast.style.cssText = `
        display:flex;
        align-items:center;
        gap:13px;
        padding:17px 19px;
        background:#191d2b;
        color:#f4f5fb;
        border:1px solid rgba(255,255,255,.1);
        border-left:4px solid ${colors[type] || colors.info};
        border-radius:15px;
        box-shadow:0 15px 45px rgba(0,0,0,.35);
        font-family:'DM Sans',sans-serif;
        font-size:13px;
        font-weight:600;
        pointer-events:auto;
        opacity:0;
        transform:translateX(20px);
        transition:.25s ease;
    `;

    const icon = document.createElement("span");
    icon.textContent = icons[type] || icons.info;

    icon.style.cssText = `
        width:29px;
        height:29px;
        flex-shrink:0;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:${colors[type] || colors.info};
        color:#10131f;
        font-size:16px;
        font-weight:800;
    `;

    const text = document.createElement("span");
    text.textContent = message;
    text.style.flex = "1";

    const close = document.createElement("button");
    close.textContent = "×";
    close.style.cssText = `
        border:none;
        background:transparent;
        color:#9299ad;
        font-size:21px;
        cursor:pointer;
    `;

    close.onclick = () => {
        clearTimeout(timer);
        toast.remove();
    };

    toast.append(icon, text, close);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(0)";
    });

    const timer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// API HELPER
// ==========================================

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            ...(options.body instanceof FormData
                ? {}
                : options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

// ==========================================
// IMAGE UPLOAD SYSTEM
// ==========================================

const heyoImageFiles = {
    profile: null,
    post: null
};

const imagePreviews = {
    profile: null,
    post: null
};

let heyoCoverFile = null;
let heyoCoverPreviewUrl = null;


let heyoPostVideoFile = null;
let heyoVideoPreviewUrl = null;

async function uploadHeyoImage(file) {
    if (!file) return null;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPG, PNG and WEBP images are allowed.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image size must be 5 MB or less.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const data = await api("/api/upload/image", {
        method: "POST",
        body: formData
    });

    return data.image;
}

function clearImagePreview(type) {
    const preview = $(`#${type}-image-preview`);
    const input = $(`#${type}-image-file`);
    const removeButton = $(`#remove-${type}-image`);
    const hiddenInput = $(`#${type}-image`);

    heyoImageFiles[type] = null;

    if (input) input.value = "";
    if (hiddenInput) hiddenInput.value = "";

    if (imagePreviews[type]) {
        URL.revokeObjectURL(imagePreviews[type]);
        imagePreviews[type] = null;
    }

    if (preview) {
        preview.removeAttribute("src");
        preview.hidden = true;
    }

    if (removeButton) removeButton.hidden = true;
}

function showImagePreview(type, url) {
    const preview = $(`#${type}-image-preview`);
    const removeButton = $(`#remove-${type}-image`);

    if (!preview || !url) return;

    if (imagePreviews[type]) {
        URL.revokeObjectURL(imagePreviews[type]);
        imagePreviews[type] = null;
    }

    preview.src = url;
    preview.hidden = false;

    if (removeButton) {
        removeButton.hidden = false;
    }
}

function setupHeyoImagePicker(type) {
    const input = $(`#${type}-image-file`);
    const preview = $(`#${type}-image-preview`);
    const removeButton = $(`#remove-${type}-image`);
    const hiddenInput = $(`#${type}-image`);

    if (!input || !preview || !removeButton || !hiddenInput) {
        console.warn(`Image picker elements missing: ${type}`);
        return;
    }

    input.addEventListener("change", () => {
        const file = input.files[0];

        if (!file) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            notify("Please select JPG, PNG or WEBP.", "error");
            input.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            notify("Image size must be 5 MB or less.", "error");
            input.value = "";
            return;
        }

        heyoImageFiles[type] = file;

        const objectUrl = URL.createObjectURL(file);

        showImagePreview(type, objectUrl);
        imagePreviews[type] = objectUrl;

        notify("Image selected successfully!");
    });

    removeButton.addEventListener("click", () => {
        clearImagePreview(type);
        notify("Image removed.", "info");
    });
}

setupHeyoImagePicker("profile");

function showCoverPreview(url) {
    const preview = $("#profile-cover-preview");

    if (heyoCoverPreviewUrl &&
        heyoCoverPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(heyoCoverPreviewUrl);
    }

    heyoCoverPreviewUrl = url;
    preview.src = url;
    preview.hidden = !url;
    $("#remove-profile-cover").hidden = !url;
}

function setupProfileCoverPicker() {
    const input = $("#profile-cover-file");

    $("#choose-cover-button").addEventListener("click", () => {
        input.click();
    });

    input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            notify("Select JPG, PNG or WEBP.", "error");
            input.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            notify("Cover photo must be 5 MB or less.", "error");
            input.value = "";
            return;
        }

        heyoCoverFile = file;

        const url = URL.createObjectURL(file);
        showCoverPreview(url);

        notify("Cover photo selected!");
    });

    $("#remove-profile-cover").addEventListener("click", () => {
        heyoCoverFile = null;
        input.value = "";
        $("#profile-cover").value = "";

        if (heyoCoverPreviewUrl &&
            heyoCoverPreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(heyoCoverPreviewUrl);
        }

        heyoCoverPreviewUrl = null;

        $("#profile-cover-preview").removeAttribute("src");
        $("#profile-cover-preview").hidden = true;
        $("#remove-profile-cover").hidden = true;

        notify("Cover photo removed. Save Profile to confirm.");
    });
}

setupProfileCoverPicker();


setupHeyoImagePicker("post");

async function uploadHeyoPostMedia(file) {
    if (!file || !["video/mp4", "video/webm"].includes(file.type)) {
        throw new Error("Select an MP4 or WEBM video.");
    }

    if (file.size > 50 * 1024 * 1024) {
        throw new Error("Video must be 50 MB or less.");
    }

    const form = new FormData();
    form.append("media", file);

    const result = await api("/api/upload/post-media", {
        method: "POST",
        body: form
    });

    return result.media;
}

function clearPostVideo() {
    const preview = $("#post-video-preview");
    heyoPostVideoFile = null;

    if ($("#post-video-file")) $("#post-video-file").value = "";

    if (heyoVideoPreviewUrl) {
        URL.revokeObjectURL(heyoVideoPreviewUrl);
        heyoVideoPreviewUrl = null;
    }

    if (preview) {
        preview.pause();
        preview.removeAttribute("src");
        preview.load();
        preview.hidden = true;
    }
}

function setupHeyoVideoPicker() {
    const input = $("#post-video-file");
    const preview = $("#post-video-preview");

    if (!input || !preview) return;

    input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        if (!["video/mp4", "video/webm"].includes(file.type)) {
            notify("Select MP4 or WEBM video.", "error");
            input.value = "";
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            notify("Video must be 50 MB or less.", "error");
            input.value = "";
            return;
        }

        clearImagePreview("post");
        clearPostVideo();

        heyoPostVideoFile = file;
        $("#post-media-type").value = "video";

        heyoVideoPreviewUrl = URL.createObjectURL(file);
        preview.src = heyoVideoPreviewUrl;
        preview.hidden = false;
        $("#remove-post-image").hidden = false;

        notify("Video selected successfully!");
    });
}

setupHeyoVideoPicker();

$("#post-image-file").addEventListener("change", () => {
    if (heyoImageFiles.post) {
        clearPostVideo();
        $("#post-media-type").value = "image";
    }
});


// ==========================================
// IMAGE DISPLAY HELPERS
// ==========================================

function avatarHTML(user, className = "post-avatar") {
    if (user?.profile_image) {
        return `
            <img class="${className}"
                src="${escapeHTML(user.profile_image)}"
                alt="${escapeHTML(user.name || "User")}"
                onerror="this.style.display='none'">
        `;
    }

    return `
        <div class="${className} user-avatar">
            ${escapeHTML(initials(user?.name))}
        </div>
    `;
}

function setAvatar(element, user) {
    if (!element) return;

    if (user?.profile_image) {
        element.innerHTML = `
            <img src="${escapeHTML(user.profile_image)}"
                alt="${escapeHTML(user.name || "User")}"
                style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">
        `;
    } else {
        element.textContent = initials(user?.name);
    }
}

// ==========================================
// AUTHENTICATION
// ==========================================


function updateContactMethod() {
    const method = $("#register-contact-method").value;

    $("#register-email-field").hidden = method !== "email";
    $("#register-phone-field").hidden = method !== "phone";

    $("#auth-email").required = method === "email";
    $("#auth-phone").required = method === "phone";

    if (method === "email") $("#auth-phone").value = "";
    else $("#auth-email").value = "";
}

$("#register-contact-method").addEventListener(
    "change", updateContactMethod
);

function setAuthMode(mode) {
    state.authMode = mode;

    const register = mode === "register";

    $("#register-fields").hidden = !register;
    $("#login-identity-field").hidden = register;

    $("#auth-title").textContent =
        register ? "Join Heyo!" : "Welcome back!";

    $("#auth-description").textContent = register
        ? "Create your account and meet your community."
        : "Log in using your email or phone number.";

    $("#auth-submit").textContent =
        register ? "Create account" : "Log in";

    $("#auth-switch-text").textContent =
        register ? "Already have an account?" : "Don't have an account?";

    $("#auth-switch").textContent =
        register ? "Log in" : "Create account";

    $("#auth-name").required = register;
    $("#auth-username").required = register;
    $("#auth-identity").required = !register;

    $("#auth-email").required = false;
    $("#auth-phone").required = false;

    if (register) updateContactMethod();
}

function openAuth() {
    $("#auth-message").textContent = "";
    $("#auth-form").reset();
    setAuthMode("login");
    $("#auth-dialog").showModal();
}

async function refreshUser() {
    try {
        const data = await api("/api/auth/me");
        state.user = data.user || null;
        updateUserInterface();
    } catch (error) {
        console.error("Authentication check:", error);
    }
}

function updateUserInterface() {
    const user = state.user;

    setAvatar($("#header-avatar"), user);
    setAvatar($("#composer-avatar"), user);
    setAvatar($("#right-avatar"), user);

    $("#header-username").textContent = user ? user.name : "Guest";
    $("#right-name").textContent = user ? user.name : "Welcome, Guest";
    $("#right-username").textContent = user ? "@" + user.username : "@guest";

    $("#login-card").hidden = Boolean(user);

    if (user) {
        loadMyProfile();
    } else {
        $("#stat-posts").textContent = "0";
        $("#stat-followers").textContent = "0";
        $("#stat-following").textContent = "0";
    }
}

$("#auth-switch").addEventListener("click", () => {
    $("#auth-form").reset();
    $("#auth-message").textContent = "";

    setAuthMode(
        state.authMode === "login" ? "register" : "login"
    );
});

$("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();

    const button = $("#auth-submit");
    button.disabled = true;
    button.textContent = "Please wait...";

    const register = state.authMode === "register";
    const method = register
        ? $("#register-contact-method").value
        : null;

    const payload = register ? {
        name: $("#auth-name").value.trim(),
        username: $("#auth-username").value.trim(),
        email: method === "email"
            ? $("#auth-email").value.trim()
            : null,
        phone: method === "phone"
            ? $("#auth-phone").value.trim()
            : null,
        password: $("#auth-password").value
    } : {
        identity: $("#auth-identity").value.trim(),
        password: $("#auth-password").value
    };

    try {
        const data = await api(
            register ? "/api/auth/register" : "/api/auth/login",
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        state.user = data.user;

        $("#auth-dialog").close();
        $("#auth-form").reset();

        setAuthMode("login");
        updateUserInterface();

        await loadFeed();

        notify(data.message || "Welcome to Heyo!");

    } catch (error) {
        $("#auth-message").textContent = error.message;
        notify(error.message, "error");

    } finally {
        button.disabled = false;
        button.textContent =
            state.authMode === "register"
                ? "Create account"
                : "Log in";
    }
});

// LOGOUT

$("#logout-button").addEventListener("click", async () => {
    try {
        await api("/api/auth/logout", {
            method: "POST"
        });

        state.user = null;

        $("#profile-dialog").close();

        updateUserInterface();
        await loadFeed();

        notify("You have been logged out.");

    } catch (error) {
        notify(error.message, "error");
    }
});

// ==========================================
// PROFILE
// ==========================================

async function loadMyProfile() {
    if (!state.user) return;

    try {
        const data = await api(
            "/api/users/" + encodeURIComponent(state.user.username)
        );

        const profile = data.profile;

        $("#stat-posts").textContent = profile.posts_count;
        $("#stat-followers").textContent = profile.followers_count;
        $("#stat-following").textContent = profile.following_count;

    } catch (error) {
        console.error("Profile loading:", error);
    }
}


// ==========================================
// PROFILE VIEW & EDIT SYSTEM
// ==========================================

function showProfileView(profile, isOwnProfile = true) {
    $("#profile-view").hidden = false;
    $("#profile-edit-view").hidden = true;

    $("#saved-profile-name").textContent =
        profile.name || "Your Name";

    $("#saved-profile-username").textContent =
        profile.username ? "@" + profile.username : "";

    $("#saved-profile-bio").textContent =
        profile.bio || "No bio added yet.";

    const photo = $("#saved-profile-photo");
    const avatar = $("#saved-profile-avatar");

    if (profile.profile_image) {
        photo.src = profile.profile_image;
        photo.hidden = false;
        avatar.hidden = true;
    } else {
        photo.hidden = true;
        photo.removeAttribute("src");
        avatar.hidden = false;
        avatar.textContent = initials(profile.name);
    }

    // Edit button only for own profile
    $("#edit-profile-button").hidden = !isOwnProfile;

    // Logout only for own profile
    $("#logout-button").hidden = !isOwnProfile;
}

function showProfileEdit() {
    $("#profile-view").hidden = true;
    $("#profile-edit-view").hidden = false;
}

// ==========================================

async function openMyProfile() {
    if (!state.user) {
        openAuth();
        return;
    }

    $("#profile-message").textContent = "";
    $("#profile-form").hidden = false;
    $("#public-profile-info")?.remove();

    clearImagePreview("profile");

    try {
        const data = await api(
            "/api/users/" + encodeURIComponent(state.user.username)
        );

        const profile = data.profile;

        state.user = {
            ...state.user,
            name: profile.name,
            bio: profile.bio,
            profile_image: profile.profile_image
        };

        $("#profile-name").value = profile.name || "";
        $("#profile-bio").value = profile.bio || "";
        $("#profile-image").value = profile.profile_image || "";

        heyoCoverFile = null;
        $("#profile-cover-file").value = "";
        $("#profile-cover").value = profile.cover_image || "";

        if (profile.cover_image) {
            showCoverPreview(profile.cover_image);
        } else {
            $("#profile-cover-preview").hidden = true;
            $("#remove-profile-cover").hidden = true;
        }


        if (profile.profile_image) {
            showImagePreview("profile", profile.profile_image);
        }

        showProfileView(profile, true);

        $("#profile-dialog").showModal();

    } catch (error) {
        notify(error.message, "error");
    }
}

// ==========================================
// EDIT BUTTON
// ==========================================

$("#edit-profile-button").addEventListener("click", () => {
    showProfileEdit();
});

// ==========================================
// PROFILE BUTTONS
// ==========================================

$("#header-profile").addEventListener("click", openMyProfile);
$("#profile-nav").addEventListener("click", openMyProfile);
$("#edit-profile").addEventListener("click", () => openMainProfilePage());

// ==========================================
// SAVE PROFILE INCLUDING IMAGE
// ==========================================

$("#profile-form").addEventListener("submit", async event => {
    event.preventDefault();

    const submit = $("#profile-form button[type='submit']");

    submit.disabled = true;
    submit.textContent = "Saving...";

    try {
        let uploadedProfileImage = $("#profile-image").value.trim();

        let uploadedCoverImage = $("#profile-cover").value.trim();

        if (heyoCoverFile) {
            uploadedCoverImage = await uploadHeyoImage(heyoCoverFile);
        }


        // Upload selected image first
        if (heyoImageFiles.profile) {
            uploadedProfileImage = await uploadHeyoImage(
                heyoImageFiles.profile
            );
        }

        // Save profile information in MySQL
        const result = await api("/api/users/me", {
            method: "PUT",
            body: JSON.stringify({
                name: $("#profile-name").value.trim(),
                bio: $("#profile-bio").value.trim(),
                profile_image: uploadedProfileImage,
                cover_image: uploadedCoverImage
            })
        });

        // Update current user state
        state.user = {
            ...state.user,
            ...result.user,
            name: $("#profile-name").value.trim(),
            bio: $("#profile-bio").value.trim(),
            profile_image: uploadedProfileImage || null,
            cover_image: uploadedCoverImage || null
        };

        // Clear selected upload file
        heyoImageFiles.profile = null;
        $("#profile-image-file").value = "";
        $("#profile-image").value = uploadedProfileImage || "";

        // Get latest saved profile from database
        const profileData = await api(
            "/api/users/" + encodeURIComponent(state.user.username)
        );

        const savedProfile = profileData.profile;

        // Update profile state
        state.user = {
            ...state.user,
            ...result.user,
            profile_image: savedProfile.profile_image,
            cover_image: savedProfile.cover_image,
            bio: savedProfile.bio
        };

        // Switch back to profile view
        showProfileView(savedProfile, true);

        // Clear edit preview without removing saved image
        clearImagePreview("profile");
        heyoCoverFile = null;
        $("#profile-cover-file").value = "";
        $("#profile-cover").value = savedProfile.cover_image || "";
        if (savedProfile.cover_image) {
            showCoverPreview(savedProfile.cover_image);
        }


        // Update header and right sidebar
        updateUserInterface();

        // Refresh feed and statistics
        await loadFeed();
        await loadMyProfile();

        $("#profile-message").textContent =
            "Profile saved successfully!";

        notify("Your profile has been updated!");

    } catch (error) {
        $("#profile-message").textContent = error.message;
        notify(error.message, "error");

    } finally {
        submit.disabled = false;
        submit.textContent = "Save Profile";
    }
});

// ==========================================
// PUBLIC USER PROFILE
// ==========================================

async function viewUserProfile(username) {
    await openMainProfilePage(username);
}

// PUBLIC PROFILE NAVIGATION END

// FOLLOW / UNFOLLOW
// ==========================================

async function toggleFollow(userId, button, profile) {
    if (!state.user) {
        openAuth();
        return;
    }

    try {
        const data = await api(`/api/users/${userId}/follow`, {
            method: "POST"
        });

        profile.isFollowing = data.following;
        profile.followers_count = data.followersCount;

        button.textContent = data.following ? "Unfollow" : "Follow";

        await loadMyProfile();

    } catch (error) {
        notify(error.message, "error");
    }
}

// ==========================================
// NEWS FEED
// ==========================================

async function loadFeed() {
    const container = $("#posts-container");

    container.innerHTML = `
        <div class="loading-state">
            <div class="loader"></div>
            <p>Loading your community...</p>
        </div>
    `;

    try {
        state.posts = await api("/api/posts");
        renderFeed();

    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load feed</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

function renderFeed() {
    const container = $("#posts-container");

    let posts = [...state.posts];

    if ($("#feed-sort").value === "popular") {
        posts.sort((a, b) =>
            Number(b.likes_count) - Number(a.likes_count)
        );
    }

    const term = $("#search-input").value.trim().toLowerCase();

    if (term) {
        posts = posts.filter(post =>
            [post.content, post.author_name, post.username]
                .some(value =>
                    String(value || "").toLowerCase().includes(term)
                )
        );
    }

    if (!posts.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No posts yet</h3>
                <p>Be the first to share something with Heyo!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = posts.map(post => {
        const avatar = post.profile_image
            ? `<img class="post-avatar"
                src="${escapeHTML(post.profile_image)}"
                alt="${escapeHTML(post.author_name)}"
                onerror="this.style.display='none'">`
            : `<div class="post-avatar user-avatar">
                ${escapeHTML(initials(post.author_name))}
            </div>`;

        return `
            <article class="post-card" id="post-${post.id}"
                data-post-id="${post.id}">

                <div class="post-header">
                    ${avatar}

                    <div class="post-author">
                        <h3>
                            <button class="profile-link"
                                data-username="${escapeHTML(post.username)}">
                                ${escapeHTML(post.author_name)}
                            </button>
                        </h3>

                        <p>
                            @${escapeHTML(post.username)}
                            · ${escapeHTML(formatDate(post.created_at))}
                        </p>
                    </div>

                    ${state.user &&
                        Number(state.user.id) === Number(post.user_id)
                        ? `
                            <button class="post-menu"
                                data-action="post-menu"
                                data-id="${post.id}">⋯</button>
                        `
                        : ""}
                </div>

                ${post.content
                    ? `<div class="post-content">${escapeHTML(post.content)}</div>`
                    : ""}

                ${post.image
                    ? (post.media_type === "video"
                        ? `<video class="post-video"
                            src="${escapeHTML(post.image)}"
                            controls autoplay muted loop playsinline preload="metadata">
                           Your browser does not support video.
                           </video>`
                        : `<img class="post-image"
                            src="${escapeHTML(post.image)}"
                            alt="Post image"
                            loading="lazy"
                            onerror="this.style.display='none'">`)
                    : ""}

                <div class="post-stats">
                    <span>♥ ${Number(post.likes_count)} Likes</span>
                    <span>${Number(post.comments_count)} Comments</span>
                </div>

                <div class="post-actions">

                    <button class="post-action ${Number(post.is_liked) ? "liked" : ""}"
                        data-action="like" data-id="${post.id}">
                        ${Number(post.is_liked) ? "♥ Liked" : "♡ Like"}
                    </button>

                    <button class="post-action"
                        data-action="comment" data-id="${post.id}">
                        ◯ Comment
                    </button>

                    <button class="post-action"
                        data-action="share" data-id="${post.id}">
                        ↗ Share
                    </button>

                </div>
            </article>
        `;
    }).join("");
}

$("#feed-sort").addEventListener("change", renderFeed);

// ==========================================
// SEARCH
// ==========================================

$("#search-toggle").addEventListener("click", () => {
    $("#search-area").hidden = !$("#search-area").hidden;

    if (!$("#search-area").hidden) {
        $("#search-input").focus();
    }
});

$("#search-button").addEventListener("click", renderFeed);
$("#search-input").addEventListener("input", renderFeed);

// ==========================================
// CREATE POST
// ==========================================

function openCreatePost() {
    if (!state.user) {
        openAuth();
        return;
    }

    state.editingPost = null;

    clearImagePreview("post");
    clearPostVideo();

    $("#post-form").reset();
    $("#post-message").textContent = "";

    $("#post-dialog h2").textContent = "Create a post";

    $("#post-form button[type='submit']").textContent =
        "Publish Post";

    $("#post-dialog").showModal();
}

$("#create-post-nav").addEventListener("click", openCreatePost);
$("#banner-create").addEventListener("click", openCreatePost);
$("#composer-open").addEventListener("click", openCreatePost);
$("#composer-submit").addEventListener("click", openCreatePost);

// CREATE / EDIT POST WITH IMAGE AND VIDEO

$("#post-form").addEventListener("submit", async event => {
    event.preventDefault();

    if (!state.user) {
        openAuth();
        return;
    }

    const content = $("#post-content").value.trim();
    const submit = $("#post-form button[type='submit']");

    submit.disabled = true;
    submit.textContent = "Uploading...";

    try {
        let image = $("#post-image").value.trim();
        let mediaType = $("#post-media-type").value || "image";

        if (heyoPostVideoFile) {
            image = await uploadHeyoPostMedia(heyoPostVideoFile);
            mediaType = "video";
        } else if (heyoImageFiles.post) {
            image = await uploadHeyoImage(heyoImageFiles.post);
            mediaType = "image";
        }

        if (!content && !image) {
            throw new Error("Write something or add media.");
        }

        const editing = state.editingPost;

        if (editing) {
            await api("/api/posts/" + editing, {
                method: "PUT",
                body: JSON.stringify({
                    content,
                    image,
                    media_type: mediaType
                })
            });
            notify("Post updated successfully!");
        } else {
            await api("/api/posts", {
                method: "POST",
                body: JSON.stringify({
                    content,
                    image,
                    media_type: mediaType
                })
            });
            notify("Your post has been published!");
        }

        state.editingPost = null;
        clearImagePreview("post");
        clearPostVideo();

        $("#post-dialog").close();
        $("#post-form").reset();
        $("#post-media-type").value = "image";

        await loadFeed();
        await loadMyProfile();

    } catch (error) {
        $("#post-message").textContent = error.message;
        notify(error.message, "error");
    } finally {
        submit.disabled = false;
        submit.textContent = state.editingPost
            ? "Save Changes"
            : "Publish Post";
    }
});

// ==========================================
// POST ACTIONS
// ==========================================

$("#posts-container").addEventListener("click", async event => {
    const profileButton = event.target.closest("[data-username]");

    if (profileButton) {
        viewUserProfile(profileButton.dataset.username);
        return;
    }

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);

    if (action === "like") {
        if (!state.user) {
            openAuth();
            return;
        }

        try {
            await api(`/api/posts/${id}/like`, {
                method: "POST"
            });

            await loadFeed();

        } catch (error) {
            notify(error.message, "error");
        }
    }

    if (action === "comment") {
        state.currentCommentPost = id;
        await loadComments(id);
        $("#comments-dialog").showModal();
    }

    if (action === "share") {
        const url = `${location.origin}/#post-${id}`;

        try {
            await navigator.clipboard.writeText(url);
            notify("Post link copied!");
        } catch (_) {
            prompt("Copy this post link:", url);
        }
    }

    if (action === "post-menu") {
        showPostMenu(id);
    }
});

// ==========================================
// EDIT / DELETE POSTS
// ==========================================


function showPostMenu(id) {
    const post = state.posts.find(item => Number(item.id) === Number(id));

    if (!post || Number(post.user_id) !== Number(state.user?.id)) {
        return;
    }

    document.querySelectorAll(".post-options-menu").forEach(menu => menu.remove());

    const card = document.getElementById("post-" + id);
    const header = card?.querySelector(".post-header");

    if (!header) return;

    header.style.position = "relative";

    const menu = document.createElement("div");
    menu.className = "post-options-menu";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "post-option-edit";
    editButton.textContent = "?  Edit Post";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "post-option-delete";
    deleteButton.textContent = "?  Delete Post";

    menu.append(editButton, deleteButton);
    header.appendChild(menu);

    editButton.addEventListener("click", () => {
        menu.remove();

        state.editingPost = Number(id);
        clearImagePreview("post");

        $("#post-content").value = post.content || "";
        $("#post-image").value = post.image || "";

        $("#post-dialog h2").textContent = "Edit your post";
        $("#post-form button[type='submit']").textContent = "Save Changes";

        if (post.image) {
            if (post.media_type === "video") {
                const video = $("#post-video-preview");
                if (video) {
                    video.src = post.image;
                    video.hidden = false;
                }
            } else {
                showImagePreview("post", post.image);
            }
        }

        $("#post-dialog").showModal();
    });

    deleteButton.addEventListener("click", async () => {
        menu.remove();

        if (!confirm("Are you sure you want to delete this post?")) {
            return;
        }

        await deletePost(Number(id));
    });

    const closeMenu = event => {
        if (!menu.contains(event.target) &&
            !event.target.closest('[data-action="post-menu"]')) {
            menu.remove();
            document.removeEventListener("click", closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener("click", closeMenu);
    }, 0);
}

async function deletePost(id) {
    try {
        await api(`/api/posts/${id}`, {
            method: "DELETE"
        });

        notify("Post deleted.");

        await loadFeed();
        await loadMyProfile();

    } catch (error) {
        notify(error.message, "error");
    }
}

// ==========================================
// COMMENTS
// ==========================================

async function loadComments(postId) {
    const list = $("#comments-list");
    list.innerHTML = "<p>Loading comments...</p>";

    try {
        const comments = await api("/api/posts/" + postId + "/comments");

        list.innerHTML = comments.length
            ? comments.map(comment => {
                const own = state.user &&
                    Number(state.user.id) === Number(comment.user_id);

                const avatar = comment.profile_image
                    ? '<img class="comment-avatar" src="' +
                      escapeHTML(comment.profile_image) + '" alt="">'
                    : '<div class="comment-avatar comment-avatar-fallback">' +
                      escapeHTML(initials(comment.name)) + '</div>';

                return `
                    <article class="comment-item">
                        ${avatar}
                        <div class="comment-bubble">
                            <strong>${escapeHTML(comment.name)}</strong>
                            <span class="comment-username">@${escapeHTML(comment.username)}</span>
                            <p>${escapeHTML(comment.comment)}</p>
                            <div class="comment-footer">
                                <small>${escapeHTML(formatDate(comment.created_at))}</small>
                                ${own ? `
                                    <button type="button"
                                        class="comment-more"
                                        data-comment-menu="${comment.id}">?</button>
                                ` : ""}
                            </div>
                        </div>
                    </article>
                `;
            }).join("")
            : "<p class='profile-no-posts'>No comments yet. Start the conversation!</p>";

    } catch (error) {
        list.textContent = error.message;
    }
}

$("#comment-form").addEventListener("submit", async event => {
    event.preventDefault();

    if (!state.user) {
        openAuth();
        return;
    }

    const comment = $("#comment-content").value.trim();

    if (!comment) return;

    try {
        await api(`/api/posts/${state.currentCommentPost}/comments`, {
            method: "POST",
            body: JSON.stringify({ comment })
        });

        $("#comment-content").value = "";

        await loadComments(state.currentCommentPost);
        await loadFeed();

        notify("Comment added!");

    } catch (error) {
        notify(error.message, "error");
    }
});

// COMMENT OPTIONS MENU

$("#comments-list").addEventListener("click", async event => {
    const menuButton = event.target.closest("[data-comment-menu]");
    const deleteButton = event.target.closest("[data-delete-comment]");

    if (menuButton) {
        document.querySelectorAll(".comment-options-menu")
            .forEach(menu => menu.remove());

        const id = Number(menuButton.dataset.commentMenu);
        const menu = document.createElement("div");
        menu.className = "comment-options-menu";

        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.deleteComment = String(id);
        remove.textContent = "Delete comment";

        menu.appendChild(remove);
        menuButton.parentElement.appendChild(menu);
        return;
    }

    if (!deleteButton) return;

    const id = Number(deleteButton.dataset.deleteComment);

    try {
        const comments = await api(
            "/api/posts/" + state.currentCommentPost + "/comments"
        );

        const own = comments.some(comment =>
            Number(comment.id) === id &&
            Number(comment.user_id) === Number(state.user?.id)
        );

        if (!own) {
            notify("You can only delete your own comment.", "error");
            return;
        }

        if (!confirm("Delete this comment?")) return;

        await api("/api/comments/" + id, {
            method: "DELETE"
        });

        await loadComments(state.currentCommentPost);
        await loadFeed();

        notify("Comment deleted.");

    } catch (error) {
        notify(error.message, "error");
    }
});

// MODAL CONTROLS
// ==========================================

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
        const dialog = document.getElementById(button.dataset.close);

        if (dialog) dialog.close();
    });
});

document.querySelectorAll("dialog.modal").forEach(dialog => {
    dialog.addEventListener("click", event => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
});

// ==========================================
// NAVIGATION
// ==========================================

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");
    });
});


// ==========================================
// HEYO MAIN AREA PROFILE PAGE
// ==========================================

async function openMainProfilePage(username = state.user?.username) {
    if (!username) {
        openAuth();
        return;
    }

    try {
        const result = await api(
            "/api/users/" + encodeURIComponent(username)
        );

        const profile = result.profile;
        const isOwnProfile = Boolean(
            state.user &&
            Number(state.user.id) === Number(profile.id)
        );

        const main = $(".main-content");
        let page = $("#main-profile-page");

        if (!page) {
            page = document.createElement("section");
            page.id = "main-profile-page";
            page.className = "main-profile-page";
            $(".welcome-banner").before(page);
        }

        $(".welcome-banner").hidden = true;
        $(".stories-section").hidden = true;
        $(".feed-section").hidden = true;
        $(".main-footer").hidden = true;

        const photo = profile.profile_image
            ? '<img class="main-profile-avatar" src="' +
              escapeHTML(profile.profile_image) + '" alt="Profile">'
            : '<div class="main-profile-avatar main-profile-fallback">' +
              escapeHTML(initials(profile.name)) + '</div>';

        const cover = profile.cover_image
            ? 'style="background-image:url(&quot;' +
              escapeHTML(profile.cover_image) +
              '&quot;);background-size:cover;background-position:center;"'
            : "";

        const posts = await api("/api/posts");

        const userPosts = posts.filter(
            post => Number(post.user_id) === Number(profile.id)
        );

        page.innerHTML = `
            <div class="main-profile-cover" ${cover}>
                <div class="main-profile-cover-decoration"
                    ${profile.cover_image ? 'hidden' : ''}>H</div>

                ${isOwnProfile ? `
                    <div class="main-cover-actions">
                        <input type="file"
                            id="main-cover-file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden>

                        <button type="button"
                            id="main-cover-change"
                            class="main-cover-button">
                            ? ${profile.cover_image ? "Change Cover" : "Add Cover Photo"}
                        </button>

                        ${profile.cover_image ? `
                            <button type="button"
                                id="main-cover-remove"
                                class="main-cover-button main-cover-remove">
                                Remove
                            </button>
                        ` : ""}
                    </div>
                ` : ""}
            </div>

            <div class="main-profile-details">
                <div class="main-profile-top">
                    ${photo}

                    ${isOwnProfile ? `
                        <button type="button"
                            id="main-profile-edit"
                            class="main-profile-edit">
                            ? Edit Profile
                        </button>
                    ` : `
                        <button type="button"
                            id="main-profile-follow"
                            class="main-profile-edit">
                            ${profile.isFollowing ? "Following" : "Follow"}
                        </button>
                    `}
                </div>

                <h1>${escapeHTML(profile.name)}</h1>

                <p class="main-profile-username">
                    @${escapeHTML(profile.username)}
                </p>

                <p class="main-profile-bio">
                    ${escapeHTML(profile.bio || "No bio added yet.")}
                </p>

                <div class="main-profile-stats">
                    <div>
                        <strong>${Number(profile.posts_count || 0)}</strong>
                        <span>Posts</span>
                    </div>
                    <div>
                        <strong id="main-profile-followers">
                            ${Number(profile.followers_count || 0)}
                        </strong>
                        <span>Followers</span>
                    </div>
                    <div>
                        <strong>${Number(profile.following_count || 0)}</strong>
                        <span>Following</span>
                    </div>
                </div>

                <div class="main-profile-posts">
                    <h2>Posts</h2>

                    ${userPosts.length ? userPosts.map(post => {
                        let media = "";

                        if (post.image && post.media_type === "video") {
                            media = '<video controls muted playsinline class="main-profile-media" src="' +
                                escapeHTML(post.image) + '"></video>';
                        } else if (post.image) {
                            media = '<img class="main-profile-media" src="' +
                                escapeHTML(post.image) + '" alt="Post">';
                        }

                        return `
                            <article class="main-profile-post-card">
                                <small>${escapeHTML(formatDate(post.created_at))}</small>
                                ${post.content
                                    ? '<p>' + escapeHTML(post.content) + '</p>'
                                    : ""}
                                ${media}
                                <div class="profile-feed-stats">
                                    ${Number(post.likes_count)} Likes �
                                    ${Number(post.comments_count)} Comments
                                </div>
                            </article>
                        `;
                    }).join("") :
                    "<p class='profile-no-posts'>No posts shared yet.</p>"}
                </div>
            </div>
        `;

        page.hidden = false;

        if (isOwnProfile) {
            $("#main-profile-edit").addEventListener("click", () => {
                openMyProfile();
            });

            // Cover upload - own profile only
            $("#main-cover-change").addEventListener("click", () => {
                $("#main-cover-file").click();
            });

            $("#main-cover-file").addEventListener("change", async event => {
                const file = event.target.files[0];
                if (!file) return;

                if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                    notify("Select JPG, PNG or WEBP.", "error");
                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    notify("Cover photo must be 5 MB or less.", "error");
                    return;
                }

                const button = $("#main-cover-change");
                button.disabled = true;
                button.textContent = "Uploading...";

                try {
                    const formData = new FormData();
                    formData.append("image", file);

                    const uploaded = await api("/api/upload/image", {
                        method: "POST",
                        body: formData
                    });

                    await api("/api/users/me", {
                        method: "PUT",
                        body: JSON.stringify({
                            name: profile.name,
                            bio: profile.bio || "",
                            profile_image: profile.profile_image || "",
                            cover_image: uploaded.image
                        })
                    });

                    notify("Cover photo saved successfully!");
                    await openMainProfilePage();

                } catch (error) {
                    notify(error.message, "error");
                    button.disabled = false;
                    button.textContent = "Change Cover";
                }
            });

            $("#main-cover-remove")?.addEventListener("click", async () => {
                if (!confirm("Remove your cover photo?")) return;

                try {
                    await api("/api/users/me", {
                        method: "PUT",
                        body: JSON.stringify({
                            name: profile.name,
                            bio: profile.bio || "",
                            profile_image: profile.profile_image || "",
                            cover_image: ""
                        })
                    });

                    notify("Cover photo removed.");
                    await openMainProfilePage();

                } catch (error) {
                    notify(error.message, "error");
                }
            });

        } else {
            // Follow another user's profile
            $("#main-profile-follow").addEventListener("click", async () => {
                const button = $("#main-profile-follow");

                button.disabled = true;

                try {
                    const data = await api(
                        "/api/users/" + profile.id + "/follow",
                        { method: "POST" }
                    );

                    profile.isFollowing = data.following;
                    profile.followers_count = data.followersCount;

                    button.textContent = data.following
                        ? "Following"
                        : "Follow";

                    $("#main-profile-followers").textContent =
                        Number(data.followersCount);

                } catch (error) {
                    notify(error.message, "error");
                } finally {
                    button.disabled = false;
                }
            });
        }

        main.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        notify(error.message, "error");
    }
}

function closeMainProfilePage() {
    const page = $("#main-profile-page");
    if (page) page.hidden = true;

    $(".welcome-banner").hidden = false;
    $(".stories-section").hidden = false;
    $(".feed-section").hidden = false;
    $(".main-footer").hidden = false;
}

// HOME NAVIGATION
document.querySelectorAll('a.nav-item[href="/"]').forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        closeMainProfilePage();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});


// ==========================================
// INITIALIZE HEYO
// ==========================================

async function initializeHeyo() {
    try {
        await api("/api/health");

        await refreshUser();

        await loadFeed();

        console.log("Heyo initialized successfully!");

    } catch (error) {
        console.error("Heyo initialization failed:", error);

        $("#posts-container").innerHTML = `
            <div class="empty-state">
                <h3>Heyo is getting ready</h3>
                <p>Please refresh the page in a moment.</p>
            </div>
        `;
    }
}

initializeHeyo();
