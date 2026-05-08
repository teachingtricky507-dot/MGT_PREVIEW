import React, { useState, useEffect } from 'react';
import { Issue, Comment, Priority, IssueStatus } from '../types';
import { commentService, issueService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { MessageSquare, Clock, Shield, Trash2, Send, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { User, Project } from '../types';

// Create textarea UI component since we don't have it yet
const TextareaUI = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        ref={ref}
        {...props}
      />
    )
  }
)
TextareaUI.displayName = "Textarea"

interface IssueModalProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  members: User[];
}

export const IssueModal: React.FC<IssueModalProps> = ({ issue, isOpen, onClose, project, members }) => {
  const { userProfile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(issue?.description || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(issue?.title || '');

  useEffect(() => {
    if (issue && isOpen) {
      const unsub = commentService.subscribeToComments(issue.projectId, issue.id, setComments);
      setDescription(issue.description || '');
      setTitle(issue.title || '');
      return unsub;
    }
  }, [issue, isOpen]);

  if (!issue) return null;

  const handleStatusChange = async (status: IssueStatus) => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { status }, userProfile.uid);
  };

  const handlePriorityChange = async (priority: Priority) => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { priority }, userProfile.uid);
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { 
      assigneeId: assigneeId === 'unassigned' ? '' : assigneeId 
    }, userProfile.uid);
  };

  const handleDueDateChange = async (dueDate: string) => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { dueDate }, userProfile.uid);
  };

  const handleAddComment = async () => {
    if (!userProfile || !newComment.trim()) return;
    await commentService.addComment(issue.projectId, issue.id, {
      content: newComment,
      authorId: userProfile.uid,
    });
    setNewComment('');
  };

  const handleSaveDescription = async () => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { description }, userProfile.uid);
    setIsEditingDescription(false);
  };

  const handleSaveTitle = async () => {
    if (!userProfile || !title.trim()) return;
    await issueService.updateIssue(issue.projectId, issue.id, { title }, userProfile.uid);
    setIsEditingTitle(false);
  };

  const handleDeleteIssue = async () => {
    if (confirm('Are you sure you want to delete this issue?')) {
      await issueService.deleteIssue(issue.projectId, issue.id);
      onClose();
    }
  };

  const assignee = members.find(m => m.uid === issue.assigneeId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest mb-2">
            <span className="font-bold text-[#0052CC]">{project?.key}-{issue.id.substring(0, 4)}</span>
            <span>/</span>
            <span>{project?.name}</span>
          </div>
          {isEditingTitle ? (
            <div className="flex gap-2 items-center">
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="text-xl font-bold bg-white"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveTitle}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)}>Cancel</Button>
            </div>
          ) : (
            <DialogTitle 
              className="text-xl font-bold text-[#172B4D] leading-tight mb-2 hover:bg-gray-100 p-1 rounded cursor-text transition-colors"
              onClick={() => setIsEditingTitle(true)}
            >
              {issue.title}
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Info */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <section>
                <h4 className="text-sm font-semibold text-[#172B4D] mb-3">Description</h4>
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <TextareaUI
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[150px] bg-white border-2 border-[#4C9AFF]"
                      placeholder="Add a more detailed description..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveDescription}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingDescription(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditingDescription(true)}
                    className="p-3 rounded hover:bg-gray-100 cursor-pointer min-h-[100px] transition-colors text-sm text-gray-700 whitespace-pre-wrap"
                  >
                    {issue.description || <span className="text-gray-400 italic">Add a description...</span>}
                  </div>
                )}
              </section>

              <Separator />

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={18} className="text-[#172B4D]" />
                  <h4 className="text-sm font-semibold text-[#172B4D]">Comments</h4>
                </div>
                
                <div className="flex gap-3 mb-6">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={userProfile?.photoURL} />
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {userProfile?.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <TextareaUI
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="bg-[#F4F5F7] border-transparent focus:bg-white min-h-[60px]"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                        <Send size={14} className="mr-2" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 group">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-gray-200 text-xs">U</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#172B4D]">Team Member</span>
                          <span className="text-xs text-gray-500">
                             {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : 'just now'}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-700 leading-relaxed">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="w-80 border-l bg-[#F4F5F7]/50 p-6 space-y-6 shrink-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Status</Label>
                <Select value={issue.status} onValueChange={(v) => handleStatusChange(v as IssueStatus)}>
                  <SelectTrigger className="bg-white border-gray-200 uppercase text-xs font-bold w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO" className="uppercase text-xs font-bold">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS" className="uppercase text-xs font-bold">In Progress</SelectItem>
                    <SelectItem value="TESTING" className="uppercase text-xs font-bold">Testing</SelectItem>
                    <SelectItem value="DONE" className="uppercase text-xs font-bold">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Priority</Label>
                <Select value={issue.priority} onValueChange={(v) => handlePriorityChange(v as Priority)}>
                  <SelectTrigger className="bg-white border-gray-200 uppercase text-xs font-bold w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW" className="uppercase text-xs font-bold">Low</SelectItem>
                    <SelectItem value="MEDIUM" className="uppercase text-xs font-bold">Medium</SelectItem>
                    <SelectItem value="HIGH" className="uppercase text-xs font-bold text-orange-600">High</SelectItem>
                    <SelectItem value="URGENT" className="uppercase text-xs font-bold text-red-600">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Assignee</Label>
                <Select value={issue.assigneeId || 'unassigned'} onValueChange={handleAssigneeChange}>
                  <SelectTrigger className="bg-white border-gray-200 w-full text-sm">
                    <div className="flex items-center gap-2">
                       <Avatar className="w-5 h-5">
                          <AvatarImage src={assignee?.photoURL} />
                          <AvatarFallback className="bg-gray-300 text-[10px]">
                            {assignee ? assignee.displayName.charAt(0) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span>{assignee ? assignee.displayName : 'Unassigned'}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map(member => (
                      <SelectItem key={member.uid} value={member.uid}>
                        {member.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Due Date</Label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <Input 
                    type="date" 
                    className="pl-9 bg-white border-gray-200 text-sm h-10 w-full" 
                    value={issue.dueDate || ''}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-2"><Clock size={12}/> Created</span>
                  <span>just now</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                   <span className="flex items-center gap-2"><Clock size={12}/> Updated</span>
                   <span>just now</span>
                </div>
              </div>
            </div>
            
            <div className="pt-6 border-t font-sans">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-destructive hover:text-white hover:bg-destructive/90 px-2" 
                size="sm"
                onClick={handleDeleteIssue}
              >
                <Trash2 size={16} className="mr-2" />
                Delete Issue
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
