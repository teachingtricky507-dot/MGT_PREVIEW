export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE';
export type IssueType = 'BUG' | 'FEATURE' | 'TASK' | 'EPIC';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  emailVerified?: boolean;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  ownerId: string;
  members: string[];
  createdAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  type?: IssueType;
  checklist?: ChecklistItem[];
  assigneeId?: string;
  reporterId: string;
  dueDate?: string;
  order: number;
  timeSpent?: number;
  estimatedTime?: number;
  attachments?: { name: string; url: string; size: number; type: string }[];
  issueIndex?: number;
  sprintId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED';
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface TimeLog {
  id: string;
  projectId: string;
  issueId: string;
  userId: string;
  timeSpent: number; // in minutes
  description?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export type ActivityType = 'ISSUE_CREATED' | 'STATUS_CHANGED' | 'ASSIGNEE_CHANGED' | 'COMMENT_ADDED';

export interface Activity {
  id: string;
  projectId: string;
  issueId?: string;
  userId: string;
  type: ActivityType;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  content: string;
  createdAt: string;
}
