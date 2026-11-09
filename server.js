
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const pool = require("./config/db");


const multer = require("multer");
const crypto = require("crypto");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "public", "uploads"));
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const filename = crypto.randomBytes(16).toString("hex") + extension;
        cb(null, filename);
    }
});

const imageUpload = multer({
    storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const allowed = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Only JPG, PNG and WEBP images are allowed."));
        }

        cb(null, true);
    }
});


const postMediaUpload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowed = {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/webp": [".webp"],
            "video/mp4": [".mp4"],
            "video/webm": [".webm"]
        };

        const extension = path.extname(file.originalname).toLowerCase();
        const extensions = allowed[file.mimetype];

        if (!extensions || !extensions.includes(extension)) {
            return cb(new Error("Only JPG, PNG, WEBP, MP4 and WEBM files are allowed."));
        }

        cb(null, true);
    }
});

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    name: "heyo.sid",
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

app.use(express.static(path.join(__dirname, "public")));

// ===============================
// MIDDLEWARE
// ===============================

const asyncRoute = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Please log in first."
        });
    }

    next();
};

const clean = (value, max = 255) =>
    String(value ?? "").trim().slice(0, max);

const validEmail = (email) =>
    /^\S+@\S+\.\S+$/.test(email);

// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", asyncRoute(async (req, res) => {
    await pool.query("SELECT 1");

    res.json({
        app: "Heyo",
        status: "ok",
        database: "connected"
    });
}));

// ===============================
// AUTHENTICATION
// ===============================


// ==========================================
// REGISTER
// ==========================================

app.post("/api/auth/register", asyncRoute(async (req, res) => {
    const name = clean(req.body.name, 100);
    const username = clean(req.body.username, 50).toLowerCase();
    const email = clean(req.body.email, 150).toLowerCase() || null;
    const phone = clean(req.body.phone, 20).replace(/[\s()-]/g, "") || null;
    const password = String(req.body.password || "");

    if (name.length < 2) {
        return res.status(400).json({
            error: "Name must contain at least 2 characters."
        });
    }

    if (!/^[a-z0-9_]{3,50}$/.test(username)) {
        return res.status(400).json({
            error: "Invalid username. Use 3-50 letters, numbers or underscores."
        });
    }

    // Exactly one contact method is required
    if ((!email && !phone) || (email && phone)) {
        return res.status(400).json({
            error: "Enter either an email address or a phone number, not both."
        });
    }

    if (email && !validEmail(email)) {
        return res.status(400).json({
            error: "Enter a valid email address."
        });
    }

    if (phone && !/^\+?[1-9]\d{6,14}$/.test(phone)) {
        return res.status(400).json({
            error: "Enter a valid phone number with country code."
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: "Password must contain at least 8 characters."
        });
    }

    const [existing] = await pool.execute(
        `SELECT id FROM users
         WHERE username = ?
         OR (email IS NOT NULL AND email = ?)
         OR (phone IS NOT NULL AND phone = ?)`,
        [username, email, phone]
    );

    if (existing.length) {
        return res.status(409).json({
            error: "Username, email or phone number already exists."
        });
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
        `INSERT INTO users
        (name, username, email, phone, password)
        VALUES (?, ?, ?, ?, ?)`,
        [name, username, email, phone, hash]
    );

    req.session.user = {
        id: result.insertId,
        name,
        username,
        email,
        phone,
        bio: null,
        profile_image: null
    };

    res.status(201).json({
        message: "Welcome to Heyo!",
        user: req.session.user
    });
}));

// ==========================================
// LOGIN WITH EMAIL OR PHONE
// ==========================================

app.post("/api/auth/login", asyncRoute(async (req, res) => {
    const identity = clean(
        req.body.identity || req.body.email || req.body.phone,
        150
    );

    const password = String(req.body.password || "");

    if (!identity || !password) {
        return res.status(400).json({
            error: "Enter your email or phone number and password."
        });
    }

    const normalizedIdentity = identity.toLowerCase();
    const normalizedPhone = identity.replace(/[\s()-]/g, "");

    const [rows] = await pool.execute(
        `SELECT id, name, username, email, phone,
                bio, profile_image, cover_image, password
         FROM users
         WHERE email = ? OR phone = ?
         LIMIT 1`,
        [normalizedIdentity, normalizedPhone]
    );

    if (!rows.length) {
        return res.status(401).json({
            error: "Incorrect email/phone number or password."
        });
    }

    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
        return res.status(401).json({
            error: "Incorrect email/phone number or password."
        });
    }

    req.session.user = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        profile_image: user.profile_image,
        cover_image: user.cover_image
    };

    res.json({
        message: "Login successful. Welcome to Heyo!",
        user: req.session.user
    });
}));
// CURRENT USER
app.get("/api/auth/me", asyncRoute(async (req, res) => {
    if (!req.session.user) {
        return res.json({ user: null });
    }

    const [rows] = await pool.execute(
        "SELECT id, name, username, email, bio, profile_image, cover_image FROM users WHERE id = ?",
        [req.session.user.id]
    );

    if (!rows.length) {
        return res.json({ user: null });
    }

    req.session.user = rows[0];

    res.json({
        user: req.session.user
    });
}));
// LOGOUT
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: "Could not log out."
            });
        }

        res.clearCookie("heyo.sid");

        res.json({
            message: "Logged out successfully."
        });
    });
});

// ===============================
// USER PROFILES

// ==========================================
// HEYO IMAGE UPLOAD API
// ==========================================

app.post(
    "/api/upload/image",
    requireAuth,
    imageUpload.single("image"),
    asyncRoute(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                error: "Please select an image."
            });
        }

        const imageUrl = "/uploads/" + req.file.filename;

        res.status(201).json({
            message: "Image uploaded successfully!",
            image: imageUrl
        });
    })
);

// ===============================


app.post(
    "/api/upload/post-media",
    requireAuth,
    postMediaUpload.single("media"),
    asyncRoute(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                error: "Please select an image or video."
            });
        }

        const mediaType = req.file.mimetype.startsWith("video/")
            ? "video"
            : "image";

        res.status(201).json({
            message: "Media uploaded successfully!",
            media: "/uploads/" + req.file.filename,
            mediaType
        });
    })
);

// VIEW PROFILE
app.get("/api/users/:username", asyncRoute(async (req, res) => {
    const username = clean(req.params.username, 50).toLowerCase();

    const [rows] = await pool.execute(`
        SELECT
            u.id,
            u.name,
            u.username,
            u.bio,
            u.profile_image,
            u.cover_image,
            u.created_at,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS posts_count,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count
        FROM users u
        WHERE u.username = ?
    `, [username]);

    if (!rows.length) {
        return res.status(404).json({
            error: "User not found."
        });
    }

    const profile = rows[0];
    let isFollowing = false;

    if (req.session.user) {
        const [follow] = await pool.execute(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
            [req.session.user.id, profile.id]
        );

        isFollowing = follow.length > 0;
    }

    res.json({
        profile: {
            ...profile,
            isFollowing
        }
    });
}));

// UPDATE MY PROFILE
app.put("/api/users/me", requireAuth, asyncRoute(async (req, res) => {
    const name = clean(req.body.name, 100);
    const bio = clean(req.body.bio, 500);
    const profileImage = clean(req.body.profile_image, 255);

    if (name.length < 2) {
        return res.status(400).json({
            error: "Name must contain at least 2 characters."
        });
    }

    await pool.execute(
        "UPDATE users SET name = ?, bio = ?, profile_image = ?, cover_image = ? WHERE id = ?",
        [name, bio, profileImage || null, clean(req.body.cover_image, 255) || null, req.session.user.id]
    );

    req.session.user.name = name;
    req.session.user.bio = bio;
    req.session.user.profile_image = profileImage || null;
    req.session.user.cover_image = clean(req.body.cover_image, 255) || null;

    res.json({
        message: "Profile updated successfully.",
        user: req.session.user
    });
}));

// ===============================
// POSTS
// ===============================

// NEWS FEED
app.get("/api/posts", asyncRoute(async (req, res) => {
    const currentUserId = req.session.user?.id || 0;

    const [posts] = await pool.execute(`
        SELECT
            p.id,
            p.content,
            p.image,
            p.media_type,
            p.created_at,
            u.id AS user_id,
            u.name AS author_name,
            u.username,
            u.profile_image,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
            EXISTS(
                SELECT 1 FROM likes
                WHERE post_id = p.id AND user_id = ?
            ) AS is_liked
        FROM posts p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
        LIMIT 100
    `, [currentUserId]);

    res.json(posts);
}));

// CREATE POST
app.post("/api/posts", requireAuth, asyncRoute(async (req, res) => {
    const content = clean(req.body.content, 5000);
    const image = clean(req.body.image, 255);
    const mediaType = req.body.media_type === "video" ? "video" : "image";

    if (!content && !image) {
        return res.status(400).json({
            error: "Write something or add media."
        });
    }

    const [result] = await pool.execute(
        "INSERT INTO posts (user_id, content, image, media_type) VALUES (?, ?, ?, ?)",
        [req.session.user.id, content, image || null, mediaType]
    );

    res.status(201).json({
        message: "Post published!",
        postId: result.insertId
    });
}));

// EDIT POST
app.put("/api/posts/:id", requireAuth, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const content = clean(req.body.content, 5000);
    const image = clean(req.body.image, 255);
    const mediaType = req.body.media_type === "video" ? "video" : "image";

    if (!Number.isInteger(id) || id < 1 || (!content && !image)) {
        return res.status(400).json({
            error: "Invalid post information."
        });
    }

    const [result] = await pool.execute(
        "UPDATE posts SET content = ?, image = ?, media_type = ? WHERE id = ? AND user_id = ?",
        [content, image || null, mediaType, id, req.session.user.id]
    );

    if (!result.affectedRows) {
        return res.status(404).json({
            error: "Post not found or you do not own this post."
        });
    }

    res.json({
        message: "Post updated."
    });
}));

// DELETE POST
app.delete("/api/posts/:id", requireAuth, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    const [result] = await pool.execute(
        "DELETE FROM posts WHERE id = ? AND user_id = ?",
        [id, req.session.user.id]
    );

    if (!result.affectedRows) {
        return res.status(404).json({
            error: "Post not found or you do not own this post."
        });
    }

    res.json({
        message: "Post deleted."
    });
}));

// ===============================
// LIKE / UNLIKE
// ===============================

app.post("/api/posts/:id/like", requireAuth, asyncRoute(async (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.session.user.id;

    const [posts] = await pool.execute(
        "SELECT id FROM posts WHERE id = ?",
        [postId]
    );

    if (!posts.length) {
        return res.status(404).json({
            error: "Post not found."
        });
    }

    const [existing] = await pool.execute(
        "SELECT id FROM likes WHERE post_id = ? AND user_id = ?",
        [postId, userId]
    );

    let liked;

    if (existing.length) {
        await pool.execute(
            "DELETE FROM likes WHERE post_id = ? AND user_id = ?",
            [postId, userId]
        );

        liked = false;
    } else {
        await pool.execute(
            "INSERT INTO likes (post_id, user_id) VALUES (?, ?)",
            [postId, userId]
        );

        liked = true;
    }

    const [[count]] = await pool.execute(
        "SELECT COUNT(*) AS total FROM likes WHERE post_id = ?",
        [postId]
    );

    res.json({
        liked,
        likesCount: count.total
    });
}));

// ===============================
// COMMENTS
// ===============================

// GET COMMENTS
app.get("/api/posts/:id/comments", asyncRoute(async (req, res) => {
    const postId = Number(req.params.id);

    const [comments] = await pool.execute(`
        SELECT
            c.id,
            c.comment,
            c.created_at,
            u.id AS user_id,
            u.name,
            u.username,
            u.profile_image
        FROM comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `, [postId]);

    res.json(comments);
}));

// ADD COMMENT
app.post("/api/posts/:id/comments", requireAuth, asyncRoute(async (req, res) => {
    const postId = Number(req.params.id);
    const comment = clean(req.body.comment, 2000);

    if (!comment) {
        return res.status(400).json({
            error: "Comment cannot be empty."
        });
    }

    const [posts] = await pool.execute(
        "SELECT id FROM posts WHERE id = ?",
        [postId]
    );

    if (!posts.length) {
        return res.status(404).json({
            error: "Post not found."
        });
    }

    const [result] = await pool.execute(
        "INSERT INTO comments (post_id, user_id, comment) VALUES (?, ?, ?)",
        [postId, req.session.user.id, comment]
    );

    res.status(201).json({
        message: "Comment added.",
        commentId: result.insertId
    });
}));

// DELETE OWN COMMENT
app.delete("/api/comments/:id", requireAuth, asyncRoute(async (req, res) => {
    const [result] = await pool.execute(
        "DELETE FROM comments WHERE id = ? AND user_id = ?",
        [Number(req.params.id), req.session.user.id]
    );

    if (!result.affectedRows) {
        return res.status(404).json({
            error: "Comment not found or you do not own it."
        });
    }

    res.json({
        message: "Comment deleted."
    });
}));

// ===============================
// FOLLOW / UNFOLLOW
// ===============================

app.post("/api/users/:id/follow", requireAuth, asyncRoute(async (req, res) => {
    const targetId = Number(req.params.id);
    const currentId = req.session.user.id;

    if (!Number.isInteger(targetId) || targetId < 1 || targetId === currentId) {
        return res.status(400).json({
            error: "Invalid follow request."
        });
    }

    const [users] = await pool.execute(
        "SELECT id FROM users WHERE id = ?",
        [targetId]
    );

    if (!users.length) {
        return res.status(404).json({
            error: "User not found."
        });
    }

    const [existing] = await pool.execute(
        "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
        [currentId, targetId]
    );

    let following;

    if (existing.length) {
        await pool.execute(
            "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
            [currentId, targetId]
        );

        following = false;
    } else {
        await pool.execute(
            "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
            [currentId, targetId]
        );

        following = true;
    }

    const [[count]] = await pool.execute(
        "SELECT COUNT(*) AS total FROM follows WHERE following_id = ?",
        [targetId]
    );

    res.json({
        following,
        followersCount: count.total
    });
}));

// ===============================
// API 404
// ===============================

app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API endpoint not found."
    });
});

// ===============================
// ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
    console.error("Heyo API Error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(error.status || 500).json({
        error: error.status
            ? error.message
            : "Something went wrong. Please try again."
    });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log(`Heyo is running at http://localhost:${PORT}`);
});
