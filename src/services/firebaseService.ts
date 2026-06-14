import { Project, Issue, Comment, User, Activity, Message, TimeLog, Sprint } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const sendSystemNotification = async (userId: string, title: string, message: string) => {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      read: false,
      type: 'info',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to send system notification", error);
  }
};

// Mocking snapshots with simple callbacks
const listeners: Record<string, ((data: any) => void)[]> = {};
const notify = (key: string) => {
  if (listeners[key]) {
    const parts = key.split('_');
    const type = parts[0];
    const id = parts[1];
    
    if (type === 'issues') {
      fetch(`/api/projects/${id}/issues`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'projects') {
      fetch(`/api/projects?userId=${id}`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'project') {
      fetch(`/api/projects/${id}`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'messages') {
      fetch(`/api/projects/${id}/messages`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'comments') {
      fetch(`/api/issues/${id}/comments`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'timelogs') {
      fetch(`/api/projects/${id}/timelogs`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'sprints') {
      fetch(`/api/projects/${id}/sprints`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    } else if (type === 'activities') {
      fetch(`/api/projects/${id}/activities`)
        .then(res => res.json())
        .then(data => listeners[key].forEach(callback => callback(data)))
        .catch(console.error);
    }
  }
};

export const activityService = {
  logActivity: async (activity: Partial<Activity>) => {
    const newActivity = {
      ...activity,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    
    try {
      await fetch(`/api/projects/${activity.projectId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivity)
      });
    } catch (e) {
      console.error(e);
    }

    notify(`activities_${activity.projectId}`);
    return newActivity;
  },

  subscribeToProjectActivity: (projectId: string, limitCount: number = 20, callback: (activities: Activity[]) => void) => {
    const key = `activities_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects/${projectId}/activities`)
      .then(res => res.json())
      .then(data => {
        const sorted = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted.slice(0, limitCount));
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  }
};

export const issueService = {
  subscribeToIssues: (projectId: string, callback: (issues: Issue[]) => void) => {
    const key = `issues_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects/${projectId}/issues`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  createIssue: async (projectId: string, issue: Partial<Issue>) => {
    let indexCount = 1;
    try {
      const issuesRes = await fetch(`/api/projects/${projectId}/issues`);
      if (issuesRes.ok) {
        const list = await issuesRes.json();
        indexCount = list.length + 1;
      }
    } catch (e) {}

    const newIssue = {
      ...issue,
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: issue.order || 0,
      type: issue.type || 'TASK',
      checklist: issue.checklist || [],
      issueIndex: indexCount,
      sprintId: issue.sprintId || '',
    };

    const res = await fetch(`/api/projects/${projectId}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIssue)
    });

    if (!res.ok) {
      throw new Error("Failed to create issue in database");
    }
    
    await activityService.logActivity({
      projectId,
      issueId: newIssue.id,
      userId: issue.reporterId,
      type: 'ISSUE_CREATED',
      newValue: issue.title
    });

    if (newIssue.assigneeId) {
      await sendSystemNotification(
        newIssue.assigneeId,
        'New Task Assigned',
        `You have been assigned a new task: ${newIssue.title}`
      );
    }

    notify(`issues_${projectId}`);
    return newIssue;
  },

  updateIssue: async (projectId: string, issueId: string, updates: Partial<Issue>, userId: string) => {
    let oldAssignee = "";
    try {
      const issuesRes = await fetch(`/api/projects/${projectId}/issues`);
      if (issuesRes.ok) {
        const issues = await issuesRes.json();
        const found = issues.find((i: any) => i.id === issueId);
        if (found) oldAssignee = found.assigneeId || "";
      }
    } catch (e) { console.error(e); }

    await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, updatedAt: new Date().toISOString() })
    });
    
    if (updates.status) {
      await activityService.logActivity({
        projectId,
        issueId,
        userId,
        type: 'STATUS_CHANGED',
        newValue: updates.status
      });
    }
    
    const newAssignee = updates.assigneeId;
    if (newAssignee !== undefined && newAssignee !== oldAssignee && newAssignee !== '') {
      try {
        const issuesRes = await fetch(`/api/projects/${projectId}/issues`);
        if (issuesRes.ok) {
          const issues = await issuesRes.json();
          const found = issues.find((i: any) => i.id === issueId);
          if (found) {
            await sendSystemNotification(
              newAssignee,
              'Task Assigned to You',
              `Task "${found.title}" has been assigned to you by a teammate`
            );
          }
        }
      } catch (e) { console.error(e); }
    }

    notify(`issues_${projectId}`);
  },

  deleteIssue: async (projectId: string, issueId: string) => {
    await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
      method: 'DELETE'
    });
    notify(`issues_${projectId}`);
  },
};

export const projectService = {
  subscribeToProjects: (userId: string, callback: (projects: Project[]) => void) => {
    const key = `projects_${userId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  createProject: async (project: Partial<Project>) => {
    const newProject = {
      ...project,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });

    if (!res.ok) {
      throw new Error("Failed to create project");
    }
    
    // Notify all members
    newProject.members?.forEach((m: string) => notify(`projects_${m}`));
    return newProject;
  },

  getProject: (projectId: string, callback: (project: Project) => void) => {
    const key = `project_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => console.error(err));
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  updateProject: async (projectId: string, updates: Partial<Project>) => {
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    notify(`project_${projectId}`);
    
    if (updates.members) {
      updates.members.forEach((m: string) => notify(`projects_${m}`));
    }
  },

  deleteProject: async (projectId: string) => {
    let members: string[] = [];
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const p = await res.json();
        members = p.members || [];
      }
    } catch (e) {}

    await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE'
    });

    members.forEach((m: string) => notify(`projects_${m}`));
  }
};

export const chatService = {
  subscribeToMessages: (projectId: string, callback: (messages: Message[]) => void) => {
    const key = `messages_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects/${projectId}/messages`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  sendMessage: async (projectId: string, message: Partial<Message>) => {
    const newMessage = {
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      createdAt: new Date().toISOString(),
    };
    
    await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMessage)
    });

    notify(`messages_${projectId}`);
    return newMessage;
  }
};

export const userService = {
  getUsers: async (userIds: string[]) => {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return [];
    try {
      const res = await fetch('/api/auth/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("Failed to get users profiles:", err);
    }
    return [];
  },
  createMember: async (displayName: string, email: string): Promise<User> => {
    const res = await fetch('/api/auth/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email })
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create member');
    }
    return await res.json();
  },
  deleteUser: async (uid: string): Promise<void> => {
    const res = await fetch(`/api/auth/users/${uid}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete user');
    }
  }
};

export const commentService = {
  subscribeToComments: (projectId: string, issueId: string, callback: (comments: Comment[]) => void) => {
    const key = `comments_${issueId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/issues/${issueId}/comments`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  addComment: async (projectId: string, issueId: string, comment: Partial<Comment>) => {
    const newComment = {
      ...comment,
      id: Math.random().toString(36).substr(2, 9),
      issueId,
      createdAt: new Date().toISOString(),
    };
    
    await fetch(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComment)
    });
    
    await activityService.logActivity({
      projectId,
      issueId,
      userId: comment.authorId,
      type: 'COMMENT_ADDED',
      newValue: comment.content?.substring(0, 50)
    });

    notify(`comments_${issueId}`);
    return newComment;
  },
};

export const timeLogService = {
  subscribeToTimeLogs: (projectId: string, callback: (logs: TimeLog[]) => void) => {
    const key = `timelogs_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects/${projectId}/timelogs`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  logTime: async (projectId: string, log: Partial<TimeLog>) => {
    const newLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      createdAt: new Date().toISOString(),
    } as TimeLog;
    
    await fetch(`/api/projects/${projectId}/timelogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog)
    });
    
    try {
      const issuesRes = await fetch(`/api/projects/${projectId}/issues`);
      if (issuesRes.ok) {
        const issues = await issuesRes.json();
        const existing = issues.find((i: any) => i.id === log.issueId);
        if (existing) {
          const newSpent = (existing.timeSpent || 0) + (log.timeSpent || 0);
          await fetch(`/api/projects/${projectId}/issues/${log.issueId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeSpent: newSpent, updatedAt: new Date().toISOString() })
          });
        }
      }
    } catch (err) {
      console.error(err);
    }

    notify(`issues_${projectId}`);
    notify(`timelogs_${projectId}`);
    return newLog;
  }
};

export const sprintService = {
  subscribeToSprints: (projectId: string, callback: (sprints: Sprint[]) => void) => {
    const key = `sprints_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    fetch(`/api/projects/${projectId}/sprints`)
      .then(res => res.json())
      .then(data => {
        callback(data);
      })
      .catch(err => {
        console.error(err);
        callback([]);
      });
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  createSprint: async (projectId: string, name: string) => {
    const newSprint: Sprint = {
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      name,
      status: 'PLANNING',
      createdAt: new Date().toISOString(),
    };
    
    await fetch(`/api/projects/${projectId}/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSprint)
    });

    notify(`sprints_${projectId}`);
    return newSprint;
  },

  startSprint: async (projectId: string, sprintId: string, durationWeeks: number) => {
    await fetch(`/api/projects/${projectId}/sprints/${sprintId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationWeeks })
    });
    
    notify(`sprints_${projectId}`);
    notify(`issues_${projectId}`);
  },

  completeSprint: async (projectId: string, sprintId: string) => {
    await fetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    notify(`sprints_${projectId}`);
    notify(`issues_${projectId}`);
  }
};
