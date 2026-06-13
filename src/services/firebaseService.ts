import { Project, Issue, Comment, User, Activity, Message, TimeLog, Sprint } from '../types';

// Helper to manage local storage
const getStorage = (key: string) => JSON.parse(localStorage.getItem(`local_db_${key}`) || '[]');
const setStorage = (key: string, data: any) => localStorage.setItem(`local_db_${key}`, JSON.stringify(data));

// Mocking snapshots with simple callbacks
const listeners: Record<string, ((data: any) => void)[]> = {};
const notify = (key: string) => {
  if (listeners[key]) {
    const data = getStorage(key);
    listeners[key].forEach(callback => callback(data));
  }
};

export const activityService = {
  logActivity: async (activity: Partial<Activity>) => {
    const activities = getStorage('activities');
    const newActivity = {
      ...activity,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    activities.push(newActivity);
    setStorage('activities', activities);
    notify(`activities_${activity.projectId}`);
    return newActivity;
  },

  subscribeToProjectActivity: (projectId: string, limitCount: number = 20, callback: (activities: Activity[]) => void) => {
    const key = `activities_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    // Initial call
    const activities = getStorage('activities')
      .filter((a: any) => a.projectId === projectId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitCount);
    callback(activities);
    
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
    
    const issues = getStorage('issues').filter((i: any) => i.projectId === projectId);
    callback(issues);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  createIssue: async (projectId: string, issue: Partial<Issue>) => {
    const issues = getStorage('issues');
    const projectIssues = issues.filter((i: any) => i.projectId === projectId);
    const newIssue = {
      ...issue,
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: issue.order || 0,
      type: issue.type || 'TASK',
      checklist: issue.checklist || [],
      issueIndex: projectIssues.length + 1,
      sprintId: issue.sprintId || '',
    };
    issues.push(newIssue);
    setStorage('issues', issues);
    
    await activityService.logActivity({
      projectId,
      issueId: newIssue.id,
      userId: issue.reporterId,
      type: 'ISSUE_CREATED',
      newValue: issue.title
    });

    notify(`issues_${projectId}`);
    return newIssue;
  },

  updateIssue: async (projectId: string, issueId: string, updates: Partial<Issue>, userId: string) => {
    const issues = getStorage('issues');
    const index = issues.findIndex((i: any) => i.id === issueId);
    if (index !== -1) {
      issues[index] = { ...issues[index], ...updates, updatedAt: new Date().toISOString() };
      setStorage('issues', issues);
      
      if (updates.status) {
        await activityService.logActivity({
          projectId,
          issueId,
          userId,
          type: 'STATUS_CHANGED',
          newValue: updates.status
        });
      }
      
      notify(`issues_${projectId}`);
    }
  },

  deleteIssue: async (projectId: string, issueId: string) => {
    const issues = getStorage('issues');
    const filtered = issues.filter((i: any) => i.id !== issueId);
    setStorage('issues', filtered);
    notify(`issues_${projectId}`);
  },
};

export const projectService = {
  subscribeToProjects: (userId: string, callback: (projects: Project[]) => void) => {
    const key = `projects_${userId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    const projects = getStorage('projects').filter((p: any) => p.members.includes(userId));
    callback(projects);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  createProject: async (project: Partial<Project>) => {
    const projects = getStorage('projects');
    const newProject = {
      ...project,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    projects.push(newProject);
    setStorage('projects', projects);
    
    // Notify all members
    newProject.members.forEach((m: string) => notify(`projects_${m}`));
    return newProject;
  },

  getProject: (projectId: string, callback: (project: Project) => void) => {
    const key = `project_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    const project = getStorage('projects').find((p: any) => p.id === projectId);
    if (project) callback(project);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  updateProject: async (projectId: string, updates: Partial<Project>) => {
    const projects = getStorage('projects');
    const index = projects.findIndex((p: any) => p.id === projectId);
    if (index !== -1) {
      projects[index] = { ...projects[index], ...updates };
      setStorage('projects', projects);
      notify(`project_${projectId}`);
      projects[index].members.forEach((m: string) => notify(`projects_${m}`));
    }
  },

  deleteProject: async (projectId: string) => {
    const projects = getStorage('projects');
    const project = projects.find((p: any) => p.id === projectId);
    const filtered = projects.filter((p: any) => p.id !== projectId);
    setStorage('projects', filtered);
    if (project) {
       project.members.forEach((m: string) => notify(`projects_${m}`));
    }
  }
};

export const chatService = {
  subscribeToMessages: (projectId: string, callback: (messages: Message[]) => void) => {
    const key = `messages_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    const messages = getStorage('messages').filter((m: any) => m.projectId === projectId);
    callback(messages);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  sendMessage: async (projectId: string, message: Partial<Message>) => {
    const messages = getStorage('messages');
    const newMessage = {
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      createdAt: new Date().toISOString(),
    };
    messages.push(newMessage);
    setStorage('messages', messages);
    notify(`messages_${projectId}`);
    return newMessage;
  }
};

export const userService = {
  getUsers: async (userIds: string[]) => {
    if (!userIds || !Array.isArray(userIds)) return [];
    const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
    return userIds.map(id => profiles[id]).filter(Boolean);
  }
};

export const commentService = {
  subscribeToComments: (projectId: string, issueId: string, callback: (comments: Comment[]) => void) => {
    const key = `comments_${issueId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    const comments = getStorage('comments').filter((c: any) => c.issueId === issueId);
    callback(comments);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  addComment: async (projectId: string, issueId: string, comment: Partial<Comment>) => {
    const comments = getStorage('comments');
    const newComment = {
      ...comment,
      id: Math.random().toString(36).substr(2, 9),
      issueId,
      createdAt: new Date().toISOString(),
    };
    comments.push(newComment);
    setStorage('comments', comments);
    
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
    
    const logs = getStorage('timeLogs').filter((l: any) => l.projectId === projectId);
    callback(logs);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  logTime: async (projectId: string, log: Partial<TimeLog>) => {
    const logs = getStorage('timeLogs');
    const newLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      createdAt: new Date().toISOString(),
    } as TimeLog;
    logs.push(newLog);
    setStorage('timeLogs', logs);
    
    // Also update elapsed time in the issue itself
    const issues = getStorage('issues');
    const index = issues.findIndex((i: any) => i.id === log.issueId);
    if (index !== -1) {
      const currentSpent = issues[index].timeSpent || 0;
      issues[index].timeSpent = currentSpent + (log.timeSpent || 0);
      issues[index].updatedAt = new Date().toISOString();
      setStorage('issues', issues);
      notify(`issues_${projectId}`);
    }

    notify(`timelogs_${projectId}`);
    return newLog;
  }
};

export const sprintService = {
  subscribeToSprints: (projectId: string, callback: (sprints: Sprint[]) => void) => {
    const key = `sprints_${projectId}`;
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    
    const sprints = getStorage('sprints').filter((s: any) => s.projectId === projectId);
    callback(sprints);
    
    return () => {
      listeners[key] = listeners[key].filter(c => c !== callback);
    };
  },

  createSprint: async (projectId: string, name: string) => {
    const sprints = getStorage('sprints');
    const newSprint: Sprint = {
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      name,
      status: 'PLANNING',
      createdAt: new Date().toISOString(),
    };
    sprints.push(newSprint);
    setStorage('sprints', sprints);
    notify(`sprints_${projectId}`);
    return newSprint;
  },

  startSprint: async (projectId: string, sprintId: string, durationWeeks: number) => {
    const sprints = getStorage('sprints');
    const index = sprints.findIndex((s: any) => s.id === sprintId);
    if (index !== -1) {
      // Complete other active sprints
      sprints.forEach((s: any) => {
        if (s.projectId === projectId && s.status === 'ACTIVE') {
          s.status = 'COMPLETED';
          s.endDate = new Date().toISOString();
        }
      });
      
      sprints[index].status = 'ACTIVE';
      sprints[index].startDate = new Date().toISOString();
      sprints[index].endDate = new Date(Date.now() + durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      
      setStorage('sprints', sprints);
      notify(`sprints_${projectId}`);
      
      // Update active sprint ID inside current project context issues
      notify(`issues_${projectId}`);
    }
  },

  completeSprint: async (projectId: string, sprintId: string) => {
    const sprints = getStorage('sprints');
    const index = sprints.findIndex((s: any) => s.id === sprintId);
    if (index !== -1) {
      sprints[index].status = 'COMPLETED';
      sprints[index].endDate = new Date().toISOString();
      setStorage('sprints', sprints);
      
      // Move incomplete issues back to backlog
      const issues = getStorage('issues');
      let updated = false;
      issues.forEach((i: any) => {
        if (i.projectId === projectId && i.sprintId === sprintId && i.status !== 'DONE') {
          i.sprintId = '';
          updated = true;
        }
      });
      if (updated) {
        setStorage('issues', issues);
        notify(`issues_${projectId}`);
      }
      
      notify(`sprints_${projectId}`);
    }
  }
};
