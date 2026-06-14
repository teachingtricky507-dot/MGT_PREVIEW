import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectService, issueService, timeLogService, userService } from '../services/firebaseService';
import { Project, Issue, TimeLog, User } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Plus, Calendar, UserCheck, Flame, ShieldAlert, Award } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export const Timesheets: React.FC = () => {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<User[]>([]);

  // Log Form State
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [logHours, setLogHours] = useState('1');
  const [logMinutes, setLogMinutes] = useState('0');
  const [logDescription, setLogDescription] = useState('');
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Load project context
  useEffect(() => {
    if (userProfile) {
      const unsub = projectService.subscribeToProjects(userProfile.uid, (projs) => {
        setProjects(projs);
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id);
          
          // Gather all members
          const uniqueMemberIds = new Set<string>();
          projs.forEach(p => p.members.forEach(m => uniqueMemberIds.add(m)));
          userService.getUsers(Array.from(uniqueMemberIds)).then(setTeamMembers);

          // Subscriptions for logs & issues
          const issueUnsubs: (() => void)[] = [];
          const logUnsubs: (() => void)[] = [];
          const mergedIssues: Record<string, Issue[]> = {};
          const mergedLogs: Record<string, TimeLog[]> = {};

          projs.forEach((proj) => {
            const unsubIssues = issueService.subscribeToIssues(proj.id, (pIssues) => {
              mergedIssues[proj.id] = pIssues;
              setIssues(Object.values(mergedIssues).flat());
            });
            issueUnsubs.push(unsubIssues);

            const unsubLogs = timeLogService.subscribeToTimeLogs(proj.id, (pLogs) => {
              mergedLogs[proj.id] = pLogs;
              setTimeLogs(Object.values(mergedLogs).flat());
            });
            logUnsubs.push(unsubLogs);
          });

          return () => {
            issueUnsubs.forEach(u => u());
            logUnsubs.forEach(u => u());
          };
        }
      });
      return unsub;
    }
  }, [userProfile]);

  // Load project's issues when selected project changes
  const projectIssues = issues.filter(i => i.projectId === selectedProjectId);
  
  useEffect(() => {
    if (projectIssues.length > 0) {
      setSelectedIssueId(projectIssues[0].id);
    } else {
      setSelectedIssueId('');
    }
  }, [selectedProjectId, issues]);

  const handleLogTime = async () => {
    if (!userProfile) {
      toast.error('User profile not found');
      return;
    }
    if (!selectedProjectId) {
      toast.error('Please select a project first');
      return;
    }
    if (!selectedIssueId || selectedIssueId === 'no-issues') {
      toast.error('Please select a valid issue to log work hours against. If no issues exist, create one first in the backlog/board page.');
      return;
    }

    const totalMinutes = (parseInt(logHours) || 0) * 60 + (parseInt(logMinutes) || 0);
    if (totalMinutes <= 0) {
      toast.error('Please enter a valid time log duration (hours/minutes must be greater than 0)');
      return;
    }

    try {
      await timeLogService.logTime(selectedProjectId, {
        issueId: selectedIssueId,
        userId: userProfile.uid,
        timeSpent: totalMinutes,
        description: logDescription,
        date: logDate,
      });

      toast.success('Time logged successfully!');
      setIsLogOpen(false);
      setLogDescription('');
      setLogHours('1');
      setLogMinutes('0');
    } catch (error) {
      toast.error('Failed to log time');
    }
  };

  // Compile Week Data for Recharts (Monday to Sunday)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekChartData = weekDays.map((day) => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    const dayLogs = timeLogs.filter(log => log.date === formattedDate && log.userId === userProfile?.uid);
    const totalMinutes = dayLogs.reduce((acc, log) => acc + log.timeSpent, 0);
    return {
      name: format(day, 'EEE'),
      date: format(day, 'MMM d'),
      Hours: parseFloat((totalMinutes / 60).toFixed(2)),
      totalMinutes: totalMinutes,
    };
  });

  const weekTotalMinutes = weekChartData.reduce((acc, d) => acc + d.totalMinutes, 0);
  const weekTotalHrs = Math.floor(weekTotalMinutes / 60);
  const weekTotalMins = weekTotalMinutes % 60;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hrs = Math.floor(data.totalMinutes / 60);
      const mins = data.totalMinutes % 60;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
          <p className="font-bold text-[#172B4D] mb-1">{data.date}</p>
          <p className="text-[#0052CC] font-bold">{hrs}h {mins}m logged</p>
        </div>
      );
    }
    return null;
  };

  // Calculate workload allocation per user
  const workloadData = teamMembers.map((member) => {
    // Sum estimated active work assigned to member (todo, in_progress, testing)
    const activeMemberIssues = issues.filter(i => i.assigneeId === member.uid && i.status !== 'DONE');
    const totalEstTimeMinutes = activeMemberIssues.reduce((acc, i) => acc + (i.estimatedTime || 120), 0); // 2hr default
    const totalEstHours = Math.round(totalEstTimeMinutes / 60);

    let loadStatus: 'available' | 'balanced' | 'overloaded' = 'available';
    let loadBadge = 'Available';
    let loadColor = 'bg-gray-100 text-gray-700 border-gray-200';
    let cardAccent = 'border-l-4 border-l-gray-300';
    let loadIcon = <UserCheck className="w-4 h-4 text-gray-500" />;

    if (totalEstHours >= 30) {
      loadStatus = 'overloaded';
      loadBadge = 'Overloaded';
      loadColor = 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20';
      cardAccent = 'border-l-4 border-l-red-500';
      loadIcon = <Flame className="w-4 h-4 text-red-500 animate-pulse" />;
    } else if (totalEstHours >= 10) {
      loadStatus = 'balanced';
      loadBadge = 'Balanced';
      loadColor = 'bg-green-50 text-green-700 border-green-100';
      cardAccent = 'border-l-4 border-l-green-500';
      loadIcon = <Award className="w-4 h-4 text-green-500" />;
    }

    return {
      member,
      totalEstHours,
      activeCount: activeMemberIssues.length,
      loadBadge,
      loadColor,
      cardAccent,
      loadIcon,
    };
  });

  // Calculate unassigned workload
  const unassignedIssues = issues.filter(i => (!i.assigneeId || i.assigneeId === 'unassigned') && i.status !== 'DONE');
  if (unassignedIssues.length > 0) {
    const unassignedEstTime = unassignedIssues.reduce((acc, i) => acc + (i.estimatedTime || 120), 0);
    const unassignedHours = Math.round(unassignedEstTime / 60);
    workloadData.push({
      member: { uid: 'unassigned', displayName: 'Unassigned', email: 'Needs to be assigned', photoURL: '' } as User,
      totalEstHours: unassignedHours,
      activeCount: unassignedIssues.length,
      loadBadge: 'Unassigned',
      loadColor: 'bg-gray-100 text-gray-700 border-gray-200',
      cardAccent: 'border-l-4 border-l-gray-300',
      loadIcon: <ShieldAlert className="w-4 h-4 text-gray-500" />
    });
  }

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <div className="h-[1px] w-4 bg-gray-300" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resource Planning</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#172B4D]">Timesheets & Workload</h1>
          <p className="text-gray-500 font-medium">Log hours, monitor team resource allocation, and optimize sprint velocity.</p>
        </div>

        <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0052CC] hover:bg-[#0747A6] shadow-lg shadow-blue-500/20 h-11 px-6 font-bold">
              <Plus size={16} className="mr-2" />
              Log Work Time
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Log Work Hours</DialogTitle>
              <DialogDescription>Record logged time for active project tickets.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="proj" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="proj" className="bg-gray-50 border-none shadow-sm h-10">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="issue" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Issue / Ticket</Label>
                <Select value={selectedIssueId} onValueChange={setSelectedIssueId}>
                  <SelectTrigger id="issue" className="bg-gray-50 border-none shadow-sm h-10">
                    <SelectValue placeholder="Select issue" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectIssues.map(i => (
                      <SelectItem key={i.id} value={i.id}>[{i.priority}] {i.title}</SelectItem>
                    ))}
                    {projectIssues.length === 0 && (
                      <SelectItem value="no-issues" disabled>No issues in project</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="hours" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hours</Label>
                  <Input id="hours" type="number" min="0" max="24" value={logHours} onChange={(e) => setLogHours(e.target.value)} className="bg-gray-50 border-none h-10 shadow-sm" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="minutes" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Minutes</Label>
                  <Input id="minutes" type="number" min="0" max="59" value={logMinutes} onChange={(e) => setLogMinutes(e.target.value)} className="bg-gray-50 border-none h-10 shadow-sm" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="date" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Work Date</Label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <Input id="date" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="pl-9 bg-gray-50 border-none h-10 shadow-sm" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-xs font-bold text-gray-500 uppercase tracking-widest">What did you do?</Label>
                <Input id="description" value={logDescription} onChange={(e) => setLogDescription(e.target.value)} placeholder="e.g. Fixed login styling" className="bg-gray-50 border-none h-10 shadow-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleLogTime} 
                className="bg-[#0052CC]"
                disabled={!selectedIssueId || selectedIssueId === 'no-issues'}
              >
                Submit Log
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white p-6">
          <CardHeader className="p-0 pb-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-bold text-[#172B4D]">Logged Hours This Week</CardTitle>
                <CardDescription>Visual breakdown of hours you logged (Mon - Sun)</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold text-blue-600 bg-blue-50/50">
                {weekTotalHrs}h {weekTotalMins}m Total Time Logged
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F4F5F7" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} 
                  tickFormatter={(val) => {
                    const h = Math.floor(val);
                    const m = Math.round((val - h) * 60);
                    if (h === 0 && m === 0) return '0';
                    return m > 0 ? `${h}h ${m}m` : `${h}h`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F4F5F7' }} />
                <Bar dataKey="Hours" fill="#0052CC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Quick Stats */}
        <Card className="border-none shadow-sm bg-white p-6 flex flex-col justify-between">
          <div>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-bold text-[#172B4D]">Log Summary</CardTitle>
              <CardDescription>Your log status for today</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              {(() => {
                const todayFormatted = format(new Date(), 'yyyy-MM-dd');
                const todayLogs = timeLogs.filter(log => log.date === todayFormatted && log.userId === userProfile?.uid);
                const totalMinutes = todayLogs.reduce((acc, log) => acc + log.timeSpent, 0);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <span className="text-sm font-semibold text-gray-500">Hours Logged Today</span>
                      <span className="text-2xl font-bold text-[#172B4D]">{hrs}h {mins}m</span>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Today's Activities</span>
                      {todayLogs.map(log => {
                        const issue = issues.find(i => i.id === log.issueId);
                        return (
                          <div key={log.id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border bg-gray-50/50">
                            <span className="font-semibold text-[#172B4D] truncate max-w-[150px]">{issue?.title || 'Unknown Ticket'}</span>
                            <span className="text-gray-500 font-bold shrink-0">{Math.floor(log.timeSpent / 60)}h {log.timeSpent % 60}m</span>
                          </div>
                        );
                      })}
                      {todayLogs.length === 0 && (
                        <p className="text-xs text-gray-400 italic py-2">No work hours logged yet today.</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Team Resource Allocation / Heatmap */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-[1px] w-4 bg-gray-300" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resource Matrix</span>
          </div>
          <h2 className="text-2xl font-bold text-[#172B4D]">Team Workload Allocation</h2>
          <p className="text-sm text-gray-400 font-medium">Calculates active task estimation weights for each member to prevent burnout.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workloadData.map((data, idx) => (
            <Card key={idx} className={`border-none shadow-sm bg-white overflow-hidden ${data.cardAccent}`}>
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-gray-100">
                      <AvatarImage src={data.member.photoURL} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-bold">
                        {data.member.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-sm font-bold text-[#172B4D]">{data.member.displayName}</h4>
                      <p className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{data.member.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider py-0.5 px-2 ${data.loadColor}`}>
                    {data.loadIcon}
                    <span>{data.loadBadge}</span>
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <span>Sprint Active Workload</span>
                    <span className="text-[#172B4D]">{data.totalEstHours} hrs estimated</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        data.totalEstHours >= 30 ? 'bg-red-500' : data.totalEstHours >= 10 ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${Math.min(100, (data.totalEstHours / 40) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400">
                    <span>{data.activeCount} open tasks</span>
                    <span>Max limit 40 hrs</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
