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
import { IssueModal } from '../components/IssueModal';
import { aiService } from '../services/aiService';
import { Sparkles, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityType[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isStandupOpen, setIsStandupOpen] = useState(false);
  const [standupText, setStandupText] = useState('');
  const [isGeneratingStandup, setIsGeneratingStandup] = useState(false);
  const navigate = useNavigate();

  const handleGenerateStandup = async () => {
    if (!userProfile) return;
    setIsGeneratingStandup(true);
    setIsStandupOpen(true);

    // Filter issues assigned to the user
    const myIssues = allIssues.filter(i => i.assigneeId === userProfile.uid);
    const completed = myIssues.filter(i => i.status === 'DONE').map(i => i.title);
    const inProgress = myIssues.filter(i => i.status === 'IN_PROGRESS' || i.status === 'TESTING').map(i => i.title);
    const blockers = myIssues.filter(i => i.priority === 'URGENT' || i.priority === 'HIGH').map(i => i.title);

    try {
      const standup = await aiService.generateDailyStandup(completed, inProgress, blockers);
      setStandupText(standup);
    } catch (error) {
      setStandupText("Failed to generate daily standup. Check your Gemini API Key.");
    } finally {
      setIsGeneratingStandup(false);
    }
  };

  const handleGenerateInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const insights = await aiService.getProjectInsights({
        totalIssues: allIssues.length,
        stats,
        priorityStats,
        projectCount: projects.length
      });
      setAiInsights(insights);
      toast.success("Insights generated successfully");
    } catch (error) {
      toast.error("Failed to generate insights");
      setAiInsights("Failed to load insights. Make sure your API keys are configured.");
    } finally {
      setIsLoadingInsights(false);
    }
  };

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

    // Close modal and clear state immediately for snappy UI
    setIsDialogOpen(false);
    const data = {
      name: newProjectName,
      key: newProjectKey.toUpperCase(),
      description: '',
      ownerId: userProfile.uid,
      members: [userProfile.uid, ...members],
    };
    
    setNewProjectName('');
    setNewProjectKey('');
    setMembers([]);

    await projectService.createProject(data);
  };

  const handleUpdateProject = async () => {
    if (!projectToEdit || !newProjectName || !newProjectKey) return;

    // Close modal and clear state immediately for snappy UI
    setIsEditDialogOpen(false);
    const projectId = projectToEdit.id;
    const data = {
      name: newProjectName,
      key: newProjectKey.toUpperCase(),
      members: [userProfile!.uid, ...members],
    };

    setNewProjectName('');
    setNewProjectKey('');
    setMembers([]);
    setProjectToEdit(null);

    await projectService.updateProject(projectId, data);
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

  const exportToCSV = () => {
    if (projects.length === 0) return;

    const headers = ['Project Name', 'Key', 'Members', 'Total Issues', 'Completion %'];
    const rows = projects.map(p => {
      const pIssues = allIssues.filter(i => i.projectId === p.id);
      const done = pIssues.filter(i => i.status === 'DONE').length;
      const progress = pIssues.length > 0 ? Math.round((done / pIssues.length) * 100) : 0;
      return [
        p.name,
        p.key,
        p.members.length,
        pIssues.length,
        `${progress}%`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `emergent_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully');
  };

  const renderFormattedInsights = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return (
      <div className="space-y-3 mt-2">
        {lines.map((line, idx) => {
          let content = line.trim();
          if (!content) return <div key={idx} className="h-1.5" />;
          
          // Check for headings
          if (content.startsWith('###')) {
            return (
              <h4 key={idx} className="text-xs font-bold text-blue-900 dark:text-blue-100 uppercase tracking-widest mt-4 mb-1.5 first:mt-0">
                {content.replace(/^###\s*/, '')}
              </h4>
            );
          }
          if (content.startsWith('##')) {
            return (
              <h3 key={idx} className="text-sm font-bold text-blue-900 dark:text-blue-100 mt-5 mb-2 first:mt-0">
                {content.replace(/^##\s*/, '')}
              </h3>
            );
          }
          if (content.startsWith('#')) {
            return (
              <h2 key={idx} className="text-base font-bold text-blue-950 dark:text-blue-50 mt-6 mb-2 first:mt-0">
                {content.replace(/^#\s*/, '')}
              </h2>
            );
          }
          
          // Check for lists
          const isBullet = content.startsWith('-') || content.startsWith('*');
          if (isBullet) {
            content = content.replace(/^[-*]\s*/, '');
          }
          
          // Parse bold text **word**
          const parts = content.split(/(\*\*.*?\*\*)/g);
          const elements = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-extrabold text-blue-950 dark:text-blue-50">{part.slice(2, -2)}</strong>;
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-3 text-xs text-blue-800 dark:text-blue-200">
                <span className="text-blue-500 shrink-0 mt-1.5 w-1 h-1 rounded-full bg-blue-500" />
                <span className="leading-relaxed">{elements}</span>
              </div>
            );
          }
          
          return (
            <p key={idx} className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              {elements}
            </p>
          );
        })}
      </div>
    );
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

      {/* AI Insights Card */}
      <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap border-b border-blue-100/50 dark:border-blue-800/50 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-300 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">AI Project Insights</h3>
                <p className="text-xs text-blue-600/80 dark:text-blue-400">Automated workspace intelligence & status summaries</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <Button
                onClick={handleGenerateInsights}
                disabled={isLoadingInsights}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold flex items-center gap-1.5 h-9"
              >
                {isLoadingInsights ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles size={14} />}
                Generate Insights
              </Button>
              <Button 
                onClick={handleGenerateStandup}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 h-9 shadow-sm"
              >
                <Sparkles size={14} />
                Standup Generator
              </Button>
            </div>
          </div>
          
          <div className="space-y-1">
            {isLoadingInsights ? (
              <div className="flex items-center gap-2 py-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running advanced analytics and compiling workspace health...</span>
              </div>
            ) : aiInsights ? (
              <div className="border-l-2 border-blue-200 dark:border-blue-800 pl-4 py-1">
                {renderFormattedInsights(aiInsights)}
              </div>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-400 italic font-medium py-1">
                Click "Generate Insights" to run project health analysis.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'PROJECTS', value: projects.length, desc: 'Active workspaces', icon: Layout },
          { label: 'ACTIVE ISSUES', value: allIssues.filter(i => i.status !== 'DONE').length, desc: `${allIssues.length} total across projects`, icon: Activity },
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
        {/* Status Breakdown (Donut Chart) */}
        <Card className="border-none shadow-sm bg-white overflow-hidden p-6 flex flex-col justify-between">
          <div>
            <CardHeader className="p-0 pb-6">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <div className="h-[1px] w-4 bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Breakdown</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const statusData = [
                  { name: 'To Do', value: stats.todo, color: '#9CA3AF' },
                  { name: 'In Progress', value: stats.inProgress, color: '#0052CC' },
                  { name: 'Testing', value: stats.testing, color: '#F97316' },
                  { name: 'Done', value: stats.done, color: '#10B981' },
                ].filter(d => d.value > 0);

                return (
                  <div className="h-64 w-full flex items-center justify-center">
                    {statusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No tasks created yet.</span>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </div>
        </Card>

        {/* Priority Distribution (Bar Chart) */}
        <Card className="border-none shadow-sm bg-white p-6 flex flex-col justify-between">
          <div>
            <CardHeader className="p-0 pb-6">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <div className="h-[1px] w-4 bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Priority Load</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const priorityData = [
                  { name: 'Low', count: priorityStats.low, color: '#3B82F6' },
                  { name: 'Medium', count: priorityStats.medium, color: '#F97316' },
                  { name: 'High', count: priorityStats.high, color: '#EF4444' },
                  { name: 'Urgent', count: priorityStats.urgent, color: '#7F1D1D' },
                ];

                return (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                      <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F4F5F7" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {priorityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </CardContent>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Assigned to You tasks list */}
        <Card className="border-none shadow-sm bg-white overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="pb-6 border-b border-gray-50 flex items-center justify-between flex-row">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                <div className="h-[1px] w-4 bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned to You</span>
              </div>
              <Badge className="bg-blue-100 text-blue-800 font-bold hover:bg-blue-100 h-5 text-[10px] rounded-full border-none">
                {assignedToMe.length} Open
              </Badge>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {assignedToMe.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 italic text-xs">
                    No active tasks assigned to you. Enjoy your clear day!
                  </div>
                ) : (
                  assignedToMe.map((issue) => {
                    const proj = projects.find(p => p.id === issue.projectId);
                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/10 cursor-pointer transition-all text-xs"
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 tracking-wider">
                            <span className="font-mono text-blue-600 uppercase">{proj?.key || 'PROJ'}-{issue.issueIndex || 1}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{proj?.name || 'Workspace'}</span>
                          </div>
                          <span className="font-semibold text-gray-700 truncate">{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 border-none ${
                            issue.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                            issue.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                            issue.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {issue.priority}
                          </Badge>
                          <Badge className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 border-none ${
                            issue.status === 'TESTING' ? 'bg-orange-50 text-orange-700' :
                            issue.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {issue.status === 'IN_PROGRESS' ? 'In Progress' : issue.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </div>
        </Card>

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
      </div>

      {/* Projects List Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-[1px] w-4 bg-gray-300" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">All Projects</span>
            </div>
            <h2 className="text-3xl font-bold text-[#172B4D] dark:text-white">Projects</h2>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={exportToCSV} className="h-11 px-4 text-sm font-bold">
              <Download size={18} className="mr-2" />
              Export CSV
            </Button>

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

      {/* AI Daily Standup Dialog */}
      <Dialog open={isStandupOpen} onOpenChange={setIsStandupOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-blue-600 w-5 h-5 animate-pulse" />
              <span>AI Daily Standup Generator</span>
            </DialogTitle>
            <DialogDescription>
              Gemini has compiled your updates based on issues assigned to you.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isGeneratingStandup ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-semibold text-gray-500">Drafting standup update...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[220px] p-3 text-sm border rounded-md font-sans bg-gray-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-pre-wrap"
                  value={standupText}
                  onChange={(e) => setStandupText(e.target.value)}
                />
                <p className="text-[10px] text-gray-400 font-medium">Tip: You can edit the text directly before copying.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStandupOpen(false)}>Close</Button>
            <Button
              disabled={isGeneratingStandup || !standupText}
              onClick={() => {
                navigator.clipboard.writeText(standupText);
                toast.success('Standup copied to clipboard!');
              }}
              className="bg-[#0052CC]"
            >
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedIssue && (
        <IssueModal
          issue={selectedIssue}
          isOpen={!!selectedIssue}
          onClose={() => setSelectedIssue(null)}
          project={projects.find((p) => p.id === selectedIssue.projectId) || null}
          members={teamMembers}
        />
      )}
    </div>
  );
};
