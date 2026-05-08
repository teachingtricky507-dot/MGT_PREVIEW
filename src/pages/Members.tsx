import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectService, userService } from '../services/firebaseService';
import { User, Project } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Mail, Copy, Check, Filter, UserPlus, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

export const Members: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    
    const loadMembers = () => {
      // 1. Get all members from local_profiles (Global directory)
      const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
      const globalMembers = Object.values(profiles) as User[];
      
      // 2. Get members from projects (for cross-referencing if needed)
      if (userProfile) {
        unsub = projectService.subscribeToProjects(userProfile.uid, (projs) => {
          setProjects(projs);
          // Combine and set members
          setMembers(globalMembers);
        });
      }
    };
    
    loadMembers();
    
    return () => {
      if (unsub) unsub();
    };
  }, [userProfile, refreshTrigger]);

  const handleCreateMember = () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const uid = newName.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substr(2, 4);
    const newMember: User = {
      uid,
      displayName: newName,
      email: newEmail,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
      createdAt: new Date().toISOString(),
    };

    const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
    profiles[uid] = newMember;
    localStorage.setItem('local_profiles', JSON.stringify(profiles));
    
    setRefreshTrigger(prev => prev + 1);
    setIsCreateModalOpen(false);
    setNewName('');
    setNewEmail('');
    toast.success('Member created successfully');
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('User ID copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMembers = members.filter(m => 
    m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 font-sans">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 bg-[#172B4D]" />
          <span className="text-[10px] font-bold text-[#172B4D] uppercase tracking-widest">Directory</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[#172B4D]">Members</h1>
        <p className="text-gray-500 font-medium">Manage your team and collaborations.</p>
      </div>

      {/* Current User Profile Card */}
      <Card className="border-none shadow-lg bg-gradient-to-br from-[#172B4D] to-[#0052CC] text-white overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Avatar className="w-24 h-24 ring-4 ring-white/20 shadow-2xl">
              <AvatarImage src={userProfile?.photoURL} />
              <AvatarFallback className="bg-white/10 text-white text-3xl font-bold">
                {userProfile?.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-[0.2em]">Current Session</span>
                <h2 className="text-3xl font-bold tracking-tight">{userProfile?.displayName}</h2>
                <div className="flex items-center justify-center md:justify-start gap-2 text-blue-100 mt-1">
                  <Mail size={14} />
                  <span className="text-sm font-medium">{userProfile?.email}</span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-lg flex items-center gap-3 w-full md:w-auto">
                   <div className="space-y-0.5 flex-1">
                      <span className="text-[8px] font-bold text-blue-300 uppercase tracking-widest block">Your Unique ID</span>
                      <code className="text-xs font-mono text-white/90">{userProfile?.uid}</code>
                   </div>
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 hover:bg-white/10 text-white"
                    onClick={() => userProfile && copyId(userProfile.uid)}
                   >
                    {copiedId === userProfile?.uid ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                   </Button>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg flex flex-col justify-center w-full md:w-auto">
                  <span className="text-[8px] font-bold text-blue-300 uppercase tracking-widest block">Joined</span>
                  <span className="text-xs font-bold">{userProfile ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={logout}
                  className="bg-red-500/80 hover:bg-red-500 h-10 px-6 font-bold uppercase tracking-wider text-[10px]"
                >
                  <LogOut size={14} className="mr-2" />
                  Logout
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/10 animate-pulse">
                <UserPlus size={48} className="text-white/20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input 
              placeholder="Search members by name or email..." 
              className="pl-10 bg-white border-none shadow-sm h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 border-none shadow-sm bg-white">
            <Filter size={16} className="mr-2" />
            Filter
          </Button>
        </div>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger
            render={
              <Button className="h-11 bg-[#0052CC] hover:bg-[#0747A6] shadow-lg shadow-blue-500/20">
                <UserPlus size={16} className="mr-2" />
                Add New Member
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Member</DialogTitle>
              <DialogDescription>Add a new person to your local team directory.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="memberName">Full Name</Label>
                <Input 
                  id="memberName" 
                  placeholder="e.g. John Doe" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberEmail">Email Address</Label>
                <Input 
                  id="memberEmail" 
                  type="email" 
                  placeholder="e.g. john@example.com" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateMember} className="bg-[#0052CC]">Create Member</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => (
          <Card key={member.uid} className="border-none shadow-sm hover:shadow-md transition-all group bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-gray-50 relative">
               <div className="flex items-center gap-4">
                 <Avatar className="w-12 h-12 ring-2 ring-white shadow-sm">
                   <AvatarImage src={member.photoURL} />
                   <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">
                     {member.displayName.charAt(0)}
                   </AvatarFallback>
                 </Avatar>
                 <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-[#172B4D] group-hover:text-[#0052CC] transition-colors line-clamp-1">
                      {member.displayName}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                       <Mail size={12} />
                       <span>{member.email}</span>
                    </div>
                 </div>
               </div>
               
               {member.uid === userProfile?.uid && (
                 <div className="absolute top-4 right-4">
                    <span className="text-[8px] font-bold uppercase tracking-widest bg-gray-100 text-gray-400 px-2 py-1 rounded">You</span>
                 </div>
               )}
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
               <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Shared Projects</span>
                  <div className="flex flex-wrap gap-1.5">
                    {projects.filter(p => p.members.includes(member.uid)).map(p => (
                      <div key={p.id} className="px-2 py-0.5 bg-blue-50 text-[#0052CC] rounded text-[10px] font-bold uppercase tracking-wider">
                        {p.key}
                      </div>
                    ))}
                  </div>
               </div>

               <div className="pt-2">
                 <Button 
                   variant="outline" 
                   className="w-full justify-between h-9 text-xs font-bold font-mono text-gray-500 hover:text-[#0052CC] border-dashed border-gray-200"
                   onClick={() => copyId(member.uid)}
                 >
                   <span className="truncate">{member.uid}</span>
                   {copiedId === member.uid ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                 </Button>
               </div>
            </CardContent>
          </Card>
        ))}

        {filteredMembers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-xl shadow-sm border border-dashed border-gray-200">
             <Search className="mx-auto h-12 w-12 text-gray-200" />
             <h3 className="mt-4 text-lg font-bold text-[#172B4D]">No members found</h3>
             <p className="mt-1 text-sm text-gray-500">Try a different search term or check your projects.</p>
          </div>
        )}
      </div>
    </div>
  );
};
