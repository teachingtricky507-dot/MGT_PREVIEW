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

  // AI API Credentials State
  const [geminiKey1, setGeminiKey1] = React.useState(localStorage.getItem('gemini_api_key') || '');
  const [geminiKey2, setGeminiKey2] = React.useState(localStorage.getItem('gemini_api_key_2') || '');
  const [geminiKey3, setGeminiKey3] = React.useState(localStorage.getItem('gemini_api_key_3') || '');
  const [geminiKey4, setGeminiKey4] = React.useState(localStorage.getItem('gemini_api_key_4') || '');
  const [groqKey, setGroqKey] = React.useState(localStorage.getItem('groq_api_key') || '');

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
      localStorage.setItem('gemini_api_key', geminiKey1);
      localStorage.setItem('gemini_api_key_2', geminiKey2);
      localStorage.setItem('gemini_api_key_3', geminiKey3);
      localStorage.setItem('gemini_api_key_4', geminiKey4);
      localStorage.setItem('groq_api_key', groqKey);
      toast.success('Profile and API keys updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = 
    name !== userProfile?.displayName ||
    geminiKey1 !== (localStorage.getItem('gemini_api_key') || '') ||
    geminiKey2 !== (localStorage.getItem('gemini_api_key_2') || '') ||
    geminiKey3 !== (localStorage.getItem('gemini_api_key_3') || '') ||
    geminiKey4 !== (localStorage.getItem('gemini_api_key_4') || '') ||
    groqKey !== (localStorage.getItem('groq_api_key') || '');

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
          disabled={isSaving || !hasChanges}
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

      <Card>
        <CardHeader>
          <CardTitle>AI API Credentials</CardTitle>
          <CardDescription>Configure multiple API keys for Google Gemini auto-rotation and Groq provider fallback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="geminiKey1" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Primary Gemini API Key</Label>
              <Input 
                id="geminiKey1" 
                type="password" 
                value={geminiKey1} 
                onChange={(e) => setGeminiKey1(e.target.value)} 
                placeholder="AIzaSy... (Falls back to .env if empty)" 
                className="font-mono text-xs h-10" 
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="geminiKey2" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Backup Gemini API Key 2</Label>
              <Input 
                id="geminiKey2" 
                type="password" 
                value={geminiKey2} 
                onChange={(e) => setGeminiKey2(e.target.value)} 
                placeholder="AIzaSy... (Used if primary fails)" 
                className="font-mono text-xs h-10" 
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="geminiKey3" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Backup Gemini API Key 3</Label>
              <Input 
                id="geminiKey3" 
                type="password" 
                value={geminiKey3} 
                onChange={(e) => setGeminiKey3(e.target.value)} 
                placeholder="AIzaSy..." 
                className="font-mono text-xs h-10" 
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="geminiKey4" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Backup Gemini API Key 4</Label>
              <Input 
                id="geminiKey4" 
                type="password" 
                value={geminiKey4} 
                onChange={(e) => setGeminiKey4(e.target.value)} 
                placeholder="AIzaSy..." 
                className="font-mono text-xs h-10" 
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="groqKey" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Groq API Key (Llama-3 Fallback)</Label>
              <Input 
                id="groqKey" 
                type="password" 
                value={groqKey} 
                onChange={(e) => setGroqKey(e.target.value)} 
                placeholder="gsk_... (Used if all Gemini keys fail)" 
                className="font-mono text-xs h-10" 
              />
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Note: Keys stored here are kept securely in local browser storage and used for client-side API requests.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
