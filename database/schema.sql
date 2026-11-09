
CREATE DATABASE IF NOT EXISTS codealpha_socialmedia
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE codealpha_socialmedia;

-- =====================================
-- 1. USERS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS users (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(150) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    bio TEXT DEFAULT NULL,
    profile_image VARCHAR(255) DEFAULT NULL,
    cover_image VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY username (username),
    UNIQUE KEY email (email),
    UNIQUE KEY unique_phone (phone)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- =====================================
-- 2. POSTS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS posts (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user_id INT(11) NOT NULL,
    content TEXT NOT NULL,
    image VARCHAR(255) DEFAULT NULL,
    media_type VARCHAR(10) NOT NULL DEFAULT 'image',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY user_id (user_id),

    CONSTRAINT posts_ibfk_1
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- =====================================
-- 3. COMMENTS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS comments (
    id INT(11) NOT NULL AUTO_INCREMENT,
    post_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY post_id (post_id),
    KEY user_id (user_id),

    CONSTRAINT comments_ibfk_1
    FOREIGN KEY (post_id)
    REFERENCES posts (id)
    ON DELETE CASCADE,

    CONSTRAINT comments_ibfk_2
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- =====================================
-- 4. LIKES TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS likes (
    id INT(11) NOT NULL AUTO_INCREMENT,
    post_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY unique_like (post_id, user_id),
    KEY user_id (user_id),

    CONSTRAINT likes_ibfk_1
    FOREIGN KEY (post_id)
    REFERENCES posts (id)
    ON DELETE CASCADE,

    CONSTRAINT likes_ibfk_2
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- =====================================
-- 5. FOLLOWS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS follows (
    id INT(11) NOT NULL AUTO_INCREMENT,
    follower_id INT(11) NOT NULL,
    following_id INT(11) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY unique_follow (follower_id, following_id),
    KEY following_id (following_id),

    CONSTRAINT follows_ibfk_1
    FOREIGN KEY (follower_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

    CONSTRAINT follows_ibfk_2
    FOREIGN KEY (following_id)
    REFERENCES users (id)
    ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
