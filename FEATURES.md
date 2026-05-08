# Emergent - Project Management Features

Emergent is a high-performance project management application built for teams who value precision and speed. Below is a detailed list of the core features currently implemented in the application.

## 🔐 Authentication & Security
- **Simple Login**: Focused Email/Password authentication system for maximum reliability and speed.
- **Secure Onboarding**: Dedicated signup flow with real-time validation (password strength, email-in-use checks).
- **Password Recovery**: Integrated password reset flow via automated email.
- **Protected Routes**: Client-side and server-side (Firestore Rules) security ensuring users only access projects they are members of.

## 📊 Project Management
- **Project Creation**: Create projects with unique keys (e.g., "PROJ-") and descriptions.
- **Project Directory**: A clean dashboard view of all active projects with progress indicators.
- **Team Management**: Add members to projects using their unique User IDs.
- **Project Activity**: A live audit log of everything happening in a project (status changes, issue creation, etc.).

## 🎫 Issue Tracking (Kanban)
- **Kanban Board**: Drag-and-drop-ready interface for moving tasks between "Backlog", "To Do", "In Progress", and "Done".
- **Advanced Issue Details**: 
    - Priority levels (Low, Medium, High, Urgent).
    - Status tracking.
    - Assignee management (link issues to specific project members).
    - Rich descriptions.
- **Real-time Synchronization**: Powered by Firebase, all team members see issue updates instantly without refreshing.

## 💬 Collaboration Tools
- **Project Team Chat**: A dedicated real-time chat sidebar for every project.
- **Member Directory**: A global "Members" tab to view teammates, their contact details, and shared projects.
- **ID Sharing**: Quick-copy functionality for User IDs to facilitate easy team expansion.

## 🎨 UI/UX & Design
- **Modern "Atlassian-inspired" Aesthetic**: High-contrast typography, subtle grids, and a professional blue-tinted color palette.
- **Responsive Design**: Fully functional across desktop, tablet, and mobile devices.
- **Motion & Transitions**: Smooth route transitions and element entries using `motion`.
- **Toast Notifications**: Context-aware feedback for actions like "Issue Created", "Copied", or "Error".

## 🛠 Technical Stack
- **Frontend**: React 18+ with Vite and TypeScript.
- **Styling**: Tailwind CSS with custom thematic extensions.
- **Backend/Database**: Firebase Firestore (NoSQL) for real-time data.
- **Authentication**: Firebase Auth.
- **Icons**: Lucide React.
