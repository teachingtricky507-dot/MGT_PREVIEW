import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  Settings, 
  Plus,
  ArrowRight
} from 'lucide-react';
import { Project } from '../types';
import { projectService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

export const CommandMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (open && userProfile) {
       projectService.subscribeToProjects(userProfile.uid, setProjects);
    }
  }, [open, userProfile]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.key.toLowerCase().includes(search.toLowerCase())
  );

  const runCommand = (action: () => void) => {
    action();
    setOpen(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-card border-none shadow-2xl top-[20%] translate-y-0">
        <div className="flex items-center border-b px-4 py-3 bg-muted/30">
          <Search className="mr-3 h-5 w-5 text-muted-foreground" />
          <input
            placeholder="Type a command or search projects..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-1">
             <kbd className="px-1.5 py-0.5 rounded border bg-white dark:bg-muted text-[10px] font-bold text-muted-foreground">ESC</kbd>
          </div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
          {search === '' && (
            <div className="px-2 py-1.5">
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Navigation</span>
            </div>
          )}
          
          <CommandItem 
            icon={<LayoutDashboard className="w-4 h-4" />} 
            label="Go to Dashboard" 
            shortcut="G D"
            onClick={() => runCommand(() => navigate('/'))} 
          />
          <CommandItem 
            icon={<Users className="w-4 h-4" />} 
            label="Manage Members" 
            shortcut="G M"
            onClick={() => runCommand(() => navigate('/members'))} 
          />
          <CommandItem 
            icon={<Settings className="w-4 h-4" />} 
            label="Settings" 
            shortcut="G S"
            onClick={() => runCommand(() => navigate('/settings'))} 
          />

          <div className="px-2 py-1.5 mt-2 border-t pt-3">
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Projects</span>
          </div>
          
          {filteredProjects.length > 0 ? (
            filteredProjects.map(p => (
              <CommandItem 
                key={p.id}
                icon={<div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center text-[8px] text-white font-bold">{p.key}</div>} 
                label={p.name} 
                onClick={() => runCommand(() => navigate(`/projects/${p.id}`))} 
              />
            ))
          ) : (
             <div className="p-4 text-center text-xs text-muted-foreground italic">No projects found matching "{search}"</div>
          )}
        </div>
        
        <div className="bg-muted/30 px-4 py-2 border-t flex items-center justify-between">
           <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1"><ArrowRight size={10}/> Navigate</span>
              <span className="flex items-center gap-1"><ArrowRight size={10}/> Select</span>
           </div>
           <span className="text-[10px] text-muted-foreground font-bold">EMERGENT v1.0</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CommandItem: React.FC<{ icon: React.ReactNode, label: string, shortcut?: string, onClick: () => void }> = ({ icon, label, shortcut, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium text-foreground transition-colors group"
  >
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">{icon}</div>
      <span>{label}</span>
    </div>
    {shortcut && <span className="text-[10px] text-muted-foreground font-mono">{shortcut}</span>}
  </button>
);
