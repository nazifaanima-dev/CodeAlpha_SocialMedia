
# Heyo - Social Media Platform

Heyo is a full-stack social media platform developed as part of the CodeAlpha Full Stack Development Internship (Task 2).

It allows users to create accounts, build profiles, share posts, upload photos and videos, interact with other users, and connect through a follow system.

## Features

### Authentication
- User Registration and Login
- Email or Phone Number Registration
- Email or Phone Number Login
- Secure Password Hashing
- Session-based Authentication
- Logout

### User Profiles
- Personal Profile
- Profile Photo Upload
- Cover Photo Upload
- Display Name and Bio Editing
- Posts, Followers and Following Statistics
- Public User Profiles
- Follow and Unfollow Users

### Posts and Media
- Create Text Posts
- Upload Images (JPG, PNG, WEBP)
- Upload Videos (MP4, WEBM)
- Video Preview
- Video Autoplay and Loop
- Edit Own Posts
- Delete Own Posts
- Facebook-style Post Options Menu

### Social Interactions
- Like and Unlike Posts
- Add Comments
- Delete Own Comments
- Share Post Links
- View Other Users' Posts

### User Interface
- Modern Dark Theme
- Responsive Layout
- Mobile-friendly Design
- Profile Pages
- Notifications
- Interactive Feed

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- REST API

### Database
- MySQL
- mysql2/promise

### Security and Utilities
- bcryptjs
- express-session
- Helmet
- Multer
- dotenv

## Project Structure

```text
CodeAlpha_SocialMedia/
|
|-- config/
|   |-- db.js
|
|-- public/
|   |-- uploads/
|   |-- index.html
|   |-- style.css
|   |-- app.js
|
|-- server.js
|-- package.json
|-- package-lock.json
|-- .env.example
|-- .gitignore
|-- README.md
```

## Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project Folder

```bash
cd CodeAlpha_SocialMedia
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create the MySQL Database

Create a database named:

```sql
CREATE DATABASE codealpha_socialmedia;
```

Configure the required database tables before starting the application.

### 5. Configure Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as a reference.

Configure:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_secure_random_secret

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=codealpha_socialmedia
```

### 6. Start the Application

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

### 7. Open in Browser

```text
http://localhost:3000
```

## Media Upload Limits

| Media | Supported Formats | Maximum Size |
|---|---|---|
| Profile Photo | JPG, PNG, WEBP | 5 MB |
| Cover Photo | JPG, PNG, WEBP | 5 MB |
| Post Image | JPG, PNG, WEBP | 5 MB |
| Post Video | MP4, WEBM | 50 MB |

## Database

The application uses MySQL to manage:

- Users
- Posts
- Comments
- Likes
- Followers
- Profile Information
- Uploaded Media References

## Security

- Password hashing with bcryptjs
- Session-based authentication
- Protected API endpoints
- Environment-based configuration
- Upload file validation
- Helmet security middleware

## Project Information

**Project Name:** Heyo

**Internship Organization:** CodeAlpha

**Internship Domain:** Full Stack Development

**Assigned Task:** Task 2 - Social Media Platform

**Frontend:** HTML, CSS, JavaScript

**Backend:** Node.js and Express.js

**Database:** MySQL

## Author

Developed as a CodeAlpha Full Stack Development Internship Project.

## License

This project is developed for educational and internship purposes.
