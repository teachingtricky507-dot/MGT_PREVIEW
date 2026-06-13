import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { issueService, projectService, userService, sprintService } from '../services/firebaseService';
import { Issue, IssueStatus, Priority, Project, User, Sprint } from '../types';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Clock } from 'lucide-react';
import { KanbanBoard } from '../components/KanbanBoard';
import { IssueModal } from '../components/IssueModal';
import { Button } from '../components/ui/button';
import { Plus, Filter, Users, MoreHorizontal, Search, MessageSquare, LayoutDashboard, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ProjectChat } from '../components/ProjectChat';
import { BurndownChart } from '../components/BurndownChart';
import { WorkloadChart } from '../components/WorkloadChart';
import { CumulativeFlowChart } from '../components/CumulativeFlowChart';

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
  const [viewMode, setViewMode] = useState<'board' | 'backlog' | 'reports'>('backlog');
  const [sprints, setSprints] = useState<Sprint[]>([]);

  useEffect(() => {
    if (projectId) {
      const unsubIssues = issueService.subscribeToIssues(projectId, setIssues);
      const unsubProject = projectService.getProject(projectId, (proj) => {
        setProject(proj);
        userService.getUsers(proj.members).then(setMembers);
      });
      const unsubSprints = sprintService.subscribeToSprints(projectId, setSprints);
      return () => {
        unsubIssues();
        unsubProject();
        unsubSprints();
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

  const activeSprint = sprints.find(s => s.status === 'ACTIVE');
  const boardIssues = activeSprint ? issues.filter(i => i.sprintId === activeSprint.id) : [];

  const filteredIssues = boardIssues.filter(issue => 
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
          
          <div className="flex bg-muted p-1 rounded-lg">
            <Button 
              variant={viewMode === 'backlog' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 px-3 text-xs font-bold"
              onClick={() => setViewMode('backlog')}
            >
              <Users size={14} className="mr-2" />
              Backlog
            </Button>
            <Button 
              variant={viewMode === 'board' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 px-3 text-xs font-bold"
              onClick={() => setViewMode('board')}
            >
              <LayoutDashboard size={14} className="mr-2" />
              Active Board
            </Button>
            <Button 
              variant={viewMode === 'reports' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 px-3 text-xs font-bold"
              onClick={() => setViewMode('reports')}
            >
              <BarChart3 size={14} className="mr-2" />
              Reports
            </Button>
          </div>
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

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        {viewMode === 'backlog' && (
          <div className="space-y-6 pb-12">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#172B4D]">Backlog Planner</h2>
              <Button 
                onClick={async () => {
                  const name = prompt("Enter sprint name:", `Sprint ${sprints.length + 1}`);
                  if (name && projectId) {
                    await sprintService.createSprint(projectId, name);
                    toast.success("Sprint created!");
                  }
                }}
                className="bg-[#0052CC] hover:bg-[#0747A6] h-9 text-xs font-bold shadow-lg shadow-blue-500/10"
              >
                <Plus size={14} className="mr-1.5" />
                Create Sprint
              </Button>
            </div>

            {/* Sprints List */}
            <div className="space-y-4">
              {sprints.filter(s => s.status !== 'COMPLETED').map(sprint => {
                const sprintIssues = issues.filter(i => i.sprintId === sprint.id);
                return (
                  <Card key={sprint.id} className="border border-gray-200 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="p-4 bg-gray-50 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-[#172B4D]">{sprint.name}</span>
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase ${
                          sprint.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {sprint.status}
                        </Badge>
                        <span className="text-xs text-gray-400 font-medium">({sprintIssues.length} issues)</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {sprint.status === 'PLANNING' ? (
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              if (confirm(`Start ${sprint.name}?`)) {
                                await sprintService.startSprint(projectId!, sprint.id, 2);
                                toast.success(`${sprint.name} started!`);
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 h-8 text-xs font-bold"
                          >
                            Start Sprint
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              if (confirm(`Complete ${sprint.name}? Incomplete issues will be moved back to backlog.`)) {
                                await sprintService.completeSprint(projectId!, sprint.id);
                                toast.success(`${sprint.name} completed!`);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs font-bold"
                          >
                            Complete Sprint
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-2 space-y-1 bg-white">
                      {sprintIssues.map(issue => (
                        <div 
                          key={issue.id} 
                          onClick={() => handleIssueClick(issue)}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer text-xs transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-mono text-[10px] font-bold text-blue-600">
                              {project?.key}-{issue.issueIndex || 1}
                            </span>
                            <span className="text-gray-400 font-bold uppercase text-[9px] font-mono">[{issue.type || 'TASK'}]</span>
                            <span className="font-semibold text-gray-700 text-xs truncate">{issue.title}</span>
                          </div>
                          
                          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                            <Select 
                              value={issue.sprintId || 'backlog'} 
                              onValueChange={async (val) => {
                                await issueService.updateIssue(projectId!, issue.id, { 
                                  sprintId: val === 'backlog' ? '' : val 
                                }, userProfile?.uid || '');
                                toast.success("Issue moved!");
                              }}
                            >
                              <SelectTrigger className="h-7 text-[10px] w-28 bg-gray-50 border-none shadow-none font-bold text-gray-600">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="backlog">Backlog</SelectItem>
                                {sprints.filter(s => s.status !== 'COMPLETED').map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                      {sprintIssues.length === 0 && (
                        <div className="py-6 text-center text-xs text-gray-400 italic">Drag/move issues here to plan this sprint.</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Backlog Section */}
            <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-4 bg-gray-50/50">
                <span className="text-sm font-bold text-[#172B4D]">Backlog ({issues.filter(i => !i.sprintId).length} issues)</span>
              </CardHeader>
              <CardContent className="p-2 space-y-1 bg-white">
                {issues.filter(i => !i.sprintId).map(issue => (
                  <div 
                    key={issue.id} 
                    onClick={() => handleIssueClick(issue)}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-mono text-[10px] font-bold text-blue-600">
                        {project?.key}-{issue.issueIndex || 1}
                      </span>
                      <span className="text-gray-400 font-bold uppercase text-[9px] font-mono">[{issue.type || 'TASK'}]</span>
                      <span className="font-semibold text-gray-700 text-xs truncate">{issue.title}</span>
                    </div>
                    
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      <Select 
                        value="backlog" 
                        onValueChange={async (val) => {
                          if (val !== 'backlog') {
                            await issueService.updateIssue(projectId!, issue.id, { sprintId: val }, userProfile?.uid || '');
                            toast.success("Issue moved to sprint!");
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-[10px] w-28 bg-gray-50 border-none shadow-none font-bold text-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="backlog">Backlog</SelectItem>
                          {sprints.filter(s => s.status !== 'COMPLETED').map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {issues.filter(i => !i.sprintId).length === 0 && (
                  <div className="py-6 text-center text-xs text-gray-400 italic">No issues in Backlog. Create one above!</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === 'board' && (
          !activeSprint ? (
            <div className="py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm max-w-xl mx-auto space-y-4">
              <Clock className="mx-auto h-12 w-12 text-gray-300 animate-pulse" />
              <h3 className="text-lg font-bold text-[#172B4D]">No Active Sprint</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto font-medium">Active Board only displays issues belonging to the active sprint. Plan and start a sprint in the Backlog first.</p>
              <Button onClick={() => setViewMode('backlog')} className="bg-[#0052CC] font-bold">Go to Backlog Planner</Button>
            </div>
          ) : (
            <KanbanBoard 
              projectId={projectId!} 
              issues={filteredIssues} 
              onIssueClick={handleIssueClick}
              members={members}
              projectKey={project?.key || 'PROJ'}
            />
          )
        )}

        {viewMode === 'reports' && (
          <div className="space-y-8 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <BurndownChart issues={issues} />
              <WorkloadChart issues={issues} members={members} />
              <div className="lg:col-span-2">
                <CumulativeFlowChart issues={issues} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Efficiency', value: '84%', desc: 'Tasks finished vs planned' },
                { label: 'Velocity', value: '12.4', desc: 'Avg issues per week' },
                { label: 'Cycle Time', value: '2.5d', desc: 'Avg time to complete' },
              ].map((stat, i) => (
                <div key={i} className="bg-white dark:bg-card p-6 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                  <div className="text-3xl font-bold mt-1 text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
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
