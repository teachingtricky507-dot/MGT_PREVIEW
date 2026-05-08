import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export const Settings: React.FC = () => {
  const { userProfile, updateProfile } = useAuth();
  const [copied, setCopied] = React.useState(false);
  const [name, setName] = React.useState(userProfile?.displayName || '');
  const [isSaving, setIsSaving] = React.useState(false);

  const copyId = () => {
    if (userProfile?.uid) {
      navigator.clipboard.writeText(userProfile.uid);
      setCopied(true);
      toast.success('User ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await updateProfile(name);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-gray-500">Manage your account and preferences</p>
        </div>
        <Button 
          className="bg-[#0052CC] hover:bg-[#0747A6]" 
          onClick={handleSave}
          disabled={isSaving || name === userProfile?.displayName}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your public profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={userProfile?.photoURL} />
              <AvatarFallback className="bg-[#0747A6] text-white text-xl">
                {userProfile?.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm" disabled>Change photo (Local Only)</Button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input 
                id="displayName" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={userProfile?.email} readOnly className="bg-gray-50 opacity-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collaboration</CardTitle>
          <CardDescription>Share this ID with teammates to be added to projects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="userId">Your User ID</Label>
            <div className="flex gap-2">
              <Input id="userId" value={userProfile?.uid} readOnly className="font-mono text-xs bg-gray-50" />
              <Button variant="outline" size="icon" onClick={copyId}>
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </Button>
            </div>
            <p className="text-xs text-gray-400">Teammates can use this ID to add you to their project members list.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
