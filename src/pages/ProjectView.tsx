import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { issueService, projectService, userService } from '../services/firebaseService';
import { Issue, IssueStatus, Priority, Project, User } from '../types';
import { KanbanBoard } from '../components/KanbanBoard';
import { IssueModal } from '../components/IssueModal';
import { Button } from '../components/ui/button';
import { Plus, Filter, Users, MoreHorizontal, Search, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ProjectChat } from '../components/ProjectChat';

export const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isAddIssueOpen, setIsAddIssueOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [newMemberId, setNewMemberId] = useState('');
  
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssuePriority, setNewIssuePriority] = useState<Priority>('MEDIUM');
  const [newIssueAssignee, setNewIssueAssignee] = useState<string>('unassigned');
  const [allSystemUsers, setAllSystemUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      const unsubIssues = issueService.subscribeToIssues(projectId, setIssues);
      const unsubProject = projectService.getProject(projectId, (proj) => {
        setProject(proj);
        userService.getUsers(proj.members).then(setMembers);
      });
      return () => {
        unsubIssues();
        unsubProject();
      };
    }
  }, [projectId]);

  useEffect(() => {
    if (isManageMembersOpen) {
      const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
      setAllSystemUsers(Object.values(profiles) as User[]);
    }
  }, [isManageMembersOpen]);

  const handleCreateIssue = async () => {
    if (!projectId || !userProfile || !newIssueTitle) return;

    await issueService.createIssue(projectId, {
      title: newIssueTitle,
      priority: newIssuePriority,
      status: 'TODO',
      description: '',
      reporterId: userProfile.uid,
      assigneeId: newIssueAssignee === 'unassigned' ? '' : newIssueAssignee,
      order: issues.length,
    });

    setNewIssueTitle('');
    setNewIssuePriority('MEDIUM');
    setNewIssueAssignee('unassigned');
    setIsAddIssueOpen(false);
  };

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const handleAddMember = async () => {
    if (!project || !newMemberId) return;
    if (project.members.includes(newMemberId)) return;
    
    await projectService.updateProject(project.id, {
      members: [...project.members, newMemberId]
    });
    setNewMemberId('');
  };

  const handleRemoveMember = async (uid: string) => {
    if (!project || project.members.length <= 1) return;
    await projectService.updateProject(project.id, {
      members: project.members.filter(m => m !== uid)
    });
  };

  const filteredIssues = issues.filter(issue => 
    (searchQuery === '' || issue.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (memberFilter === null || issue.assigneeId === memberFilter)
  );

  const stats = {
    todo: issues.filter(i => i.status === 'TODO').length,
    progress: issues.filter(i => i.status === 'IN_PROGRESS').length,
    done: issues.filter(i => i.status === 'DONE').length
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Project Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 border-gray-200">
              {project?.key || 'PROJ'}
            </Badge>
            <div className="h-px w-4 bg-gray-300" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Project Workspace</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#172B4D]">{project?.name || 'Project Workspace'}</h1>
          <p className="text-gray-500 font-medium">{project?.description || 'Collaborate on tasks and track progress.'}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-2">
            {members.slice(0, 5).map((member) => (
              <Avatar key={member.uid} className="w-8 h-8 border-2 border-white ring-1 ring-gray-100">
                <AvatarImage src={member.photoURL} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold">{member.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white ring-1 ring-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                +{members.length - 5}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsManageMembersOpen(true)}>
            <Users size={14} className="mr-2" />
            Members
          </Button>
          <Dialog open={isAddIssueOpen} onOpenChange={setIsAddIssueOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0052CC] hover:bg-[#0747A6] shadow-lg shadow-blue-500/20">
                <Plus size={16} className="mr-2" />
                Create Issue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Issue</DialogTitle>
                <DialogDescription>Add a new task to this project board.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="issue-title" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Summary</Label>
                  <Input 
                    id="issue-title" 
                    value={newIssueTitle} 
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    placeholder="Short description of the task"
                    className="bg-gray-50/50 border-none shadow-sm h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Priority</Label>
                  <Select value={newIssuePriority} onValueChange={(v) => setNewIssuePriority(v as Priority)}>
                    <SelectTrigger id="priority" className="bg-gray-50/50 border-none shadow-sm h-10">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="assignee" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assignee</Label>
                  <Select value={newIssueAssignee} onValueChange={setNewIssueAssignee}>
                    <SelectTrigger id="assignee" className="bg-gray-50/50 border-none shadow-sm h-10">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map(member => (
                        <SelectItem key={member.uid} value={member.uid}>{member.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddIssueOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateIssue} className="bg-[#0052CC]">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsChatOpen(true)}
            className="border-blue-100 hover:bg-blue-50 text-blue-600"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Button>
        </div>
      </div>

      {/* Filters & Stats Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <Input 
              placeholder="Search issues..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 border-gray-200 text-sm"
            />
          </div>
          <div className="h-4 w-px bg-gray-200 hidden md:block" />
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
             <Button 
                variant={memberFilter === null ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 text-xs font-bold uppercase tracking-wider"
                onClick={() => setMemberFilter(null)}
             >
                All
             </Button>
             {members.slice(0, 3).map(member => (
               <Button 
                key={member.uid}
                variant={memberFilter === member.uid ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 text-xs font-medium px-2"
                onClick={() => setMemberFilter(memberFilter === member.uid ? null : member.uid)}
               >
                 <Avatar className="w-4 h-4 mr-1.5">
                   <AvatarImage src={member.photoURL} />
                   <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
                 </Avatar>
                 {member.displayName.split(' ')[0]}
               </Button>
             ))}
          </div>
        </div>

        <div className="flex items-center gap-6 px-2">
           <div className="flex flex-col">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.2em]">To Do</span>
              <span className="text-sm font-bold text-gray-400">{stats.todo}</span>
           </div>
           <div className="flex flex-col">
              <span className="text-[8px] font-bold text-blue-400 uppercase tracking-[0.2em]">Doing</span>
              <span className="text-sm font-bold text-[#0052CC]">{stats.progress}</span>
           </div>
           <div className="flex flex-col">
              <span className="text-[8px] font-bold text-green-400 uppercase tracking-[0.2em]">Done</span>
              <span className="text-sm font-bold text-green-600">{stats.done}</span>
           </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <KanbanBoard 
          projectId={projectId!} 
          issues={filteredIssues} 
          onIssueClick={handleIssueClick}
          members={members}
        />
      </div>

      {/* Modals */}
      <IssueModal 
        issue={selectedIssue} 
        isOpen={!!selectedIssue} 
        onClose={() => setSelectedIssue(null)} 
        project={project}
        members={members}
      />

      <Dialog open={isManageMembersOpen} onOpenChange={setIsManageMembersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Members</DialogTitle>
            <DialogDescription>Add or remove members from this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Add From Directory</Label>
              <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-1 bg-gray-50/50">
                {allSystemUsers.filter(u => !(project?.members || []).includes(u.uid)).map(user => (
                  <div 
                    key={user.uid} 
                    className="flex items-center justify-between p-2 rounded-md hover:bg-white cursor-pointer group"
                    onClick={async () => {
                      if (project) {
                        await projectService.updateProject(project.id, {
                          members: [...project.members, user.uid]
                        });
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{user.displayName}</span>
                    </div>
                    <Plus size={14} className="text-gray-400 group-hover:text-blue-600" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Current Members</Label>
              <div className="space-y-2">
                {members.map(member => (
                  <div key={member.uid} className="flex items-center justify-between p-2 rounded-md bg-white border shadow-sm">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.photoURL} />
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {member.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.displayName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{member.uid}</p>
                      </div>
                    </div>
                    {member.uid !== userProfile?.uid && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.uid)} className="text-destructive h-7 px-2">Remove</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {project && (
        <ProjectChat 
          projectId={project.id} 
          members={members} 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
        />
      )}
    </div>
  );
};
