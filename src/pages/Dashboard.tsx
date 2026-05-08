import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectService, issueService, activityService, userService } from '../services/firebaseService';
import { Project, Issue, Activity as ActivityType, User } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, Folder, Users, Clock, Layout, CheckCircle2, AlertCircle, BarChart3, Activity, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ActivityFeed } from '../components/ActivityFeed';

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityType[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile) {
      const unsubProjects = projectService.subscribeToProjects(userProfile.uid, (projs) => {
        setProjects(projs);
        
        const issueUnsubs: (() => void)[] = [];
        const activityUnsubs: (() => void)[] = [];
        const mergedIssues: Record<string, Issue[]> = {};
        const mergedActivities: Record<string, ActivityType[]> = {};
        
        // Track all unique member IDs across all projects
        const allMemberIds = new Set<string>();
        projs.forEach(p => p.members.forEach(m => allMemberIds.add(m)));
        
        // Fetch users for these IDs
        userService.getUsers(Array.from(allMemberIds)).then(setTeamMembers);

        projs.forEach(project => {
          // Subscribe to Issues
          const unsubIssues = issueService.subscribeToIssues(project.id, (projectIssues) => {
            mergedIssues[project.id] = projectIssues;
            setAllIssues(Object.values(mergedIssues).flat());
          });
          issueUnsubs.push(unsubIssues);

          // Subscribe to Activity
          const unsubActivity = activityService.subscribeToProjectActivity(project.id, 10, (projectActivities) => {
            mergedActivities[project.id] = projectActivities;
            setAllActivities(Object.values(mergedActivities).flat());
          });
          activityUnsubs.push(unsubActivity);
        });

        return () => {
          issueUnsubs.forEach(u => u());
          activityUnsubs.forEach(u => u());
        };
      });
      return unsubProjects;
    }
  }, [userProfile]);

  useEffect(() => {
    // Load all local users for the selection list
    const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
    setAllSystemUsers(Object.values(profiles) as User[]);
  }, [isDialogOpen]);

  const assignedToMe = allIssues.filter(i => i.assigneeId === userProfile?.uid && i.status !== 'DONE');
  const completedIssues = allIssues.filter(i => i.status === 'DONE');
  const completionRate = allIssues.length > 0 ? Math.round((completedIssues.length / allIssues.length) * 100) : 0;

  const stats = {
    todo: allIssues.filter(i => i.status === 'TODO').length,
    inProgress: allIssues.filter(i => i.status === 'IN_PROGRESS').length,
    testing: allIssues.filter(i => i.status === 'TESTING').length,
    done: allIssues.filter(i => i.status === 'DONE').length,
  };

  const priorityStats = {
    low: allIssues.filter(i => i.priority === 'LOW').length,
    medium: allIssues.filter(i => i.priority === 'MEDIUM').length,
    high: allIssues.filter(i => i.priority === 'HIGH').length,
    urgent: allIssues.filter(i => i.priority === 'URGENT').length,
  };

  const addMember = () => {
    if (memberId && !members.includes(memberId)) {
      setMembers([...members, memberId]);
      setMemberId('');
    }
  };

  const removeMember = (id: string) => {
    setMembers(members.filter(m => m !== id));
  };

  const handleCreateProject = async () => {
    if (!userProfile || !newProjectName || !newProjectKey) return;
    
    await projectService.createProject({
      name: newProjectName,
      key: newProjectKey.toUpperCase(),
      description: '',
      ownerId: userProfile.uid,
      members: [userProfile.uid, ...members],
    });
    
    setNewProjectName('');
    setNewProjectKey('');
    setMembers([]);
    setIsDialogOpen(false);
  };

  const handleUpdateProject = async () => {
    if (!projectToEdit || !newProjectName || !newProjectKey) return;
    
    await projectService.updateProject(projectToEdit.id, {
      name: newProjectName,
      key: newProjectKey.toUpperCase(),
      members: [userProfile!.uid, ...members],
    });
    
    setNewProjectName('');
    setNewProjectKey('');
    setMembers([]);
    setIsEditDialogOpen(false);
    setProjectToEdit(null);
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      await projectService.deleteProject(projectId);
    }
  };

  const openEditDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToEdit(project);
    setNewProjectName(project.name);
    setNewProjectKey(project.key);
    setMembers(project.members.filter(m => m !== userProfile?.uid));
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-10 pb-12 font-sans">
      {/* Header Section */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 bg-[#172B4D]" />
          <span className="text-[10px] font-bold text-[#172B4D] uppercase tracking-widest">Control Room</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[#172B4D]">
          Hello, {userProfile?.displayName.split(' ')[0]}.
        </h1>
        <p className="text-gray-500 font-medium">Here's a calm overview of everything in motion.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'PROJECTS', value: projects.length, desc: 'Active workspaces', icon: Layout },
          { label: 'TOTAL ISSUES', value: allIssues.length, desc: `${allIssues.filter(i => i.status !== 'DONE').length} open`, icon: Activity },
          { label: 'ASSIGNED TO YOU', value: assignedToMe.length, desc: 'Open tasks on your plate', icon: Users },
          { label: 'COMPLETION', value: `${completionRate}%`, desc: `${completedIssues.length} done`, icon: CheckCircle2 },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-[1px] w-4 bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</span>
              </div>
              <CardTitle className="text-3xl font-bold text-[#172B4D]">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-400 font-medium">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Status Breakdown */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <div className="h-[1px] w-4 bg-gray-300" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">By Status</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
             {[
               { label: 'TO DO', value: stats.todo, color: 'bg-gray-400' },
               { label: 'IN PROGRESS', value: stats.inProgress, color: 'bg-[#0052CC]' },
               { label: 'TESTING', value: stats.testing, color: 'bg-orange-400' },
               { label: 'DONE', value: stats.done, color: 'bg-green-500' },
             ].map((item, i) => (
               <div key={i} className="space-y-1.5">
                 <div className="flex justify-between items-center text-[10px] font-bold">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-gray-600 tracking-wider">{item.label}</span>
                   </div>
                   <span className="text-[#172B4D]">{item.value}</span>
                 </div>
                 <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                   <div 
                    className={`h-full ${item.color} transition-all duration-1000 ease-out`} 
                    style={{ width: `${allIssues.length > 0 ? (item.value / allIssues.length) * 100 : 0}%` }}
                   />
                 </div>
               </div>
             ))}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <div className="h-[1px] w-4 bg-gray-300" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">By Priority</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'LOW', value: priorityStats.low, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                { label: 'MEDIUM', value: priorityStats.medium, color: 'bg-orange-50 text-orange-700 border-orange-100' },
                { label: 'HIGH', value: priorityStats.high, color: 'bg-red-50 text-red-700 border-red-100' },
                { label: 'URGENT', value: priorityStats.urgent, color: 'bg-red-900 text-white border-red-900' },
              ].map((item, i) => (
                <div key={i} className={`p-4 rounded-lg border flex flex-col justify-between ${item.color}`}>
                  <span className="text-[10px] font-bold tracking-widest uppercase mb-4">{item.label}</span>
                  <span className="text-2xl font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Section */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-6 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <div className="h-[1px] w-4 bg-gray-300" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Activity</span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <ActivityFeed activities={allActivities} users={teamMembers} />
        </CardContent>
      </Card>

      {/* Projects List Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <div className="h-[1px] w-4 bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">All Projects</span>
             </div>
             <h2 className="text-3xl font-bold text-[#172B4D]">Projects</h2>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger
              render={
                <Button className="bg-[#0052CC] hover:bg-[#0747A6] h-11 px-6 text-sm font-bold shadow-lg shadow-blue-500/20">
                  <Plus size={18} className="mr-2" />
                  New Project
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new project</DialogTitle>
                <DialogDescription>
                  Set up a new workspace for your team.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input 
                    id="name" 
                    value={newProjectName} 
                    onChange={(e) => {
                      setNewProjectName(e.target.value);
                      if (!newProjectKey) {
                        setNewProjectKey(e.target.value.substring(0, 3).toUpperCase());
                      }
                    }} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="key">Project Key</Label>
                  <Input 
                    id="key" 
                    value={newProjectKey} 
                    onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                    maxLength={5}
                  />
                  <p className="text-xs text-gray-400">Usually 3-5 uppercase letters.</p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Select Members</Label>
                  <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-1 bg-gray-50/50">
                    {allSystemUsers.filter(u => u.uid !== userProfile?.uid).map(user => (
                      <div 
                        key={user.uid} 
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${members.includes(user.uid) ? 'bg-blue-100 border-blue-200' : 'hover:bg-white'}`}
                        onClick={() => {
                          if (members.includes(user.uid)) {
                            setMembers(members.filter(m => m !== user.uid));
                          } else {
                            setMembers([...members, user.uid]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${members.includes(user.uid) ? 'bg-blue-600' : 'bg-gray-300'}`} />
                          <span className="text-sm font-medium">{user.displayName}</span>
                        </div>
                        {members.includes(user.uid) && <Plus size={14} className="rotate-45 text-blue-600" />}
                      </div>
                    ))}
                    {allSystemUsers.length <= 1 && (
                      <p className="text-xs text-gray-400 text-center py-4">No other members found. Add them in the Members page first.</p>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">Click to add/remove members from the project.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateProject}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Create New Project Card - Always First */}
          <Card 
            className="group cursor-pointer border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center p-8 min-h-[200px]"
            onClick={() => setIsDialogOpen(true)}
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus className="text-blue-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Add More Project</h3>
            <p className="text-sm text-gray-400 mt-1">Start a new workspace</p>
          </Card>

          {projects.length > 0 ? (
            projects.map((project) => {
              const projectIssues = allIssues.filter(i => i.projectId === project.id);
              const projectDone = projectIssues.filter(i => i.status === 'DONE').length;
              const projectProgress = projectIssues.length > 0 ? Math.round((projectDone / projectIssues.length) * 100) : 0;

              return (
                <Card 
                  key={project.id} 
                  className="cursor-pointer border-none shadow-sm hover:shadow-md transition-all group bg-white"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardHeader className="pb-3 border-b border-gray-50">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                           {project.key}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-[1px] w-3 bg-gray-300" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{project.members.length} members</span>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-gray-400 hover:text-gray-900"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical size={16} />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => openEditDialog(project, e)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            <span>Edit Project</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Project</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-[#172B4D] group-hover:text-[#0052CC] transition-colors truncate">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || 'No description provided.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                     <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-gray-400">Progress</span>
                          <span className="text-[#172B4D]">{projectProgress}%</span>
                        </div>
                        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#0052CC] transition-all duration-500" 
                            style={{ width: `${projectProgress}%` }}
                          />
                        </div>
                     </div>
                     <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        <div className="flex items-center gap-1.5">
                           <span>{projectIssues.length} issues</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <span>{projectDone} done</span>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center bg-white rounded-lg border-2 border-dashed border-gray-200">
              <Folder className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first project.</p>
              <div className="mt-6">
                <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update your workspace details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input 
                id="edit-name" 
                value={newProjectName} 
                onChange={(e) => setNewProjectName(e.target.value)} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-key">Project Key</Label>
              <Input 
                id="edit-key" 
                value={newProjectKey} 
                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                maxLength={5}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Manage Members</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-1 bg-gray-50/50">
                {allSystemUsers.filter(u => u.uid !== userProfile?.uid).map(user => (
                  <div 
                    key={user.uid} 
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${members.includes(user.uid) ? 'bg-blue-100 border-blue-200' : 'hover:bg-white'}`}
                    onClick={() => {
                      if (members.includes(user.uid)) {
                        setMembers(members.filter(m => m !== user.uid));
                      } else {
                        setMembers([...members, user.uid]);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${members.includes(user.uid) ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium">{user.displayName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateProject} className="bg-[#0052CC]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
