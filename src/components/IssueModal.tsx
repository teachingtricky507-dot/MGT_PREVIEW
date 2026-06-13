import React, { useState, useEffect } from 'react';
import { Issue, Comment, Priority, IssueStatus, IssueType, ChecklistItem, Sprint } from '../types';
import { commentService, issueService, sprintService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
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
import { MessageSquare, Clock, Shield, Trash2, Send, Calendar, Sparkles, Loader2, Play, Square, Paperclip, FileIcon, X, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { User, Project } from '../types';
import { aiService } from '../services/aiService';
import { uploadService } from '../services/uploadService';
import { toast } from 'sonner';

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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSuggestingPriority, setIsSuggestingPriority] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(issue?.timeSpent || 0);
  const [isUploading, setIsUploading] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isDecomposingAI, setIsDecomposingAI] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);

  useEffect(() => {
    if (issue && isOpen) {
      const unsubComments = commentService.subscribeToComments(issue.projectId, issue.id, setComments);
      const unsubSprints = sprintService.subscribeToSprints(issue.projectId, setSprints);
      setDescription(issue.description || '');
      setTitle(issue.title || '');
      return () => {
        unsubComments();
        unsubSprints();
      };
    }
  }, [issue, isOpen]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 60000); // Update every minute
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

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

  const handleTypeChange = async (type: IssueType) => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { type }, userProfile.uid);
  };

  const handleSprintChange = async (sprintId: string) => {
    if (!userProfile) return;
    await issueService.updateIssue(issue.projectId, issue.id, { 
      sprintId: sprintId === 'backlog' ? '' : sprintId 
    }, userProfile.uid);
  };

  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    if (!userProfile) return;
    const newChecklist = (issue.checklist || []).map(item => 
      item.id === itemId ? { ...item, completed } : item
    );
    await issueService.updateIssue(issue.projectId, issue.id, { checklist: newChecklist }, userProfile.uid);
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!userProfile) return;
    const newChecklist = (issue.checklist || []).filter(item => item.id !== itemId);
    await issueService.updateIssue(issue.projectId, issue.id, { checklist: newChecklist }, userProfile.uid);
  };

  const handleCreateChecklistItem = async () => {
    if (!userProfile || !newSubtaskText.trim()) return;
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newSubtaskText.trim(),
      completed: false
    };
    const newChecklist = [...(issue.checklist || []), newItem];
    await issueService.updateIssue(issue.projectId, issue.id, { checklist: newChecklist }, userProfile.uid);
    setNewSubtaskText('');
  };

  const handleAIDecompose = async () => {
    setIsDecomposingAI(true);
    try {
      const items = await aiService.decomposeTaskIntoSubtasks(issue.title, description || issue.description || '');
      const newItems = items.map(text => ({
        id: Math.random().toString(36).substr(2, 9),
        text,
        completed: false
      }));
      const newChecklist = [...(issue.checklist || []), ...newItems];
      await issueService.updateIssue(issue.projectId, issue.id, { checklist: newChecklist }, userProfile.uid);
      toast.success('AI decomposed task successfully');
    } catch (error) {
      toast.error('Failed to decompose task using AI');
    } finally {
      setIsDecomposingAI(false);
    }
  };

  const handleToggleTimer = async () => {
    if (!userProfile) return;
    if (isTimerRunning) {
      setIsTimerRunning(false);
      await issueService.updateIssue(issue.projectId, issue.id, { timeSpent: elapsedTime }, userProfile.uid);
      toast.success(`Logged ${elapsedTime} minutes`);
    } else {
      setIsTimerRunning(true);
      toast.info('Timer started');
    }
  };

  const { unreadCount, sendNotification } = useNotifications();

  const handleAddComment = async () => {
    if (!userProfile || !newComment.trim()) return;
    
    const commentData = {
      content: newComment,
      authorId: userProfile.uid,
    };

    await commentService.addComment(issue.projectId, issue.id, commentData);

    // Detect @mentions
    const mentions = newComment.match(/@(\w+)/g);
    if (mentions) {
      mentions.forEach(mention => {
        const username = mention.substring(1);
        const mentionedUser = members.find(m => m.displayName.toLowerCase().includes(username.toLowerCase()));
        if (mentionedUser && mentionedUser.uid !== userProfile.uid) {
          sendNotification(
            mentionedUser.uid,
            'You were mentioned',
            `${userProfile.displayName} mentioned you in a comment on ${issue.title}`
          );
        }
      });
    }

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    setIsUploading(true);
    try {
      const attachment = await uploadService.uploadFile(issue.projectId, issue.id, file);
      const newAttachments = [...(issue.attachments || []), attachment];
      await issueService.updateIssue(issue.projectId, issue.id, { attachments: newAttachments }, userProfile.uid);
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async (index: number) => {
    if (!userProfile) return;
    const newAttachments = [...(issue.attachments || [])];
    newAttachments.splice(index, 1);
    await issueService.updateIssue(issue.projectId, issue.id, { attachments: newAttachments }, userProfile.uid);
  };

  const handleAIDescription = async () => {
    if (!issue.title) return;
    setIsGeneratingAI(true);
    try {
      const generated = await aiService.generateIssueDescription(issue.title);
      setDescription(generated);
      setIsEditingDescription(true);
      toast.success('Description generated by AI');
    } catch (error) {
      toast.error('Failed to generate AI description');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAISuggestPriority = async () => {
    setIsSuggestingPriority(true);
    try {
      const suggested = await aiService.suggestPriority(issue.title, description) as Priority;
      await handlePriorityChange(suggested);
      toast.success(`AI suggested ${suggested} priority`);
    } catch (error) {
      toast.error('Failed to suggest priority');
    } finally {
      setIsSuggestingPriority(false);
    }
  };

  const assignee = members.find(m => m.uid === issue.assigneeId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest mb-2">
            <span className="font-bold text-[#0052CC]">{project?.key || 'PROJ'}-{issue.issueIndex || 1}</span>
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#172B4D]">Description</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={handleAIDescription}
                    disabled={isGeneratingAI}
                  >
                    {isGeneratingAI ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    AI GENERATE
                  </Button>
                </div>
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

              {/* Subtask Checklist Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#172B4D]">Checklist</span>
                    {(issue.checklist || []).length > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-bold bg-blue-50 text-blue-700">
                        {Math.round(
                          ((issue.checklist || []).filter(item => item.completed).length /
                            (issue.checklist || []).length) *
                            100
                        )}% Done
                      </Badge>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={handleAIDecompose}
                    disabled={isDecomposingAI}
                  >
                    {isDecomposingAI ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    AI DECOMPOSE (SUBTASKS)
                  </Button>
                </div>

                {/* Progress Bar */}
                {(issue.checklist || []).length > 0 && (
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300" 
                      style={{ 
                        width: `${((issue.checklist || []).filter(item => item.completed).length / 
                          (issue.checklist || []).length) * 100}%` 
                       }}
                    />
                  </div>
                )}

                {/* Checklist Items */}
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {(issue.checklist || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 group transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input 
                          type="checkbox"
                          checked={item.completed}
                          onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span className={`text-sm ${item.completed ? 'line-through text-gray-400 font-medium' : 'text-gray-700 font-medium'} truncate`}>
                          {item.text}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}

                  {(!issue.checklist || issue.checklist.length === 0) && (
                    <p className="text-xs text-gray-400 italic py-2">No subtasks yet. Add one below or use AI to decompose.</p>
                  )}
                </div>

                {/* Add Item form */}
                <div className="flex gap-2">
                  <Input 
                    placeholder="Add checklist item..." 
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    className="bg-gray-50 border-none h-8 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateChecklistItem();
                      }
                    }}
                  />
                  <Button size="sm" className="h-8 text-xs font-bold" onClick={handleCreateChecklistItem}>Add</Button>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                      <Paperclip size={18} className="text-[#172B4D]" />
                      <h4 className="text-sm font-semibold text-[#172B4D]">Attachments</h4>
                   </div>
                   <div className="relative">
                      <Input 
                        type="file" 
                        className="hidden" 
                        id="file-upload" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <Label 
                        htmlFor="file-upload" 
                        className="cursor-pointer text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        UPLOAD
                      </Label>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   {issue.attachments?.map((file, i) => (
                     <div key={i} className="group relative flex items-center gap-3 p-2 rounded-lg border bg-white hover:border-blue-200 transition-all">
                        <div className="p-2 bg-gray-50 rounded text-gray-500">
                           <FileIcon size={16} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <p className="text-xs font-bold truncate text-[#172B4D]">{file.name}</p>
                           <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600"
                           >
                              <FileIcon size={14} />
                           </a>
                           <button 
                            onClick={() => handleRemoveAttachment(i)}
                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                           >
                              <X size={14} />
                           </button>
                        </div>
                     </div>
                   ))}
                   {(!issue.attachments || issue.attachments.length === 0) && (
                     <div className="col-span-2 py-4 text-center border-2 border-dashed rounded-lg text-gray-400 text-xs italic">
                        No attachments yet.
                     </div>
                   )}
                </div>
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
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Issue Type</Label>
                <Select value={issue.type || 'TASK'} onValueChange={(v) => handleTypeChange(v as IssueType)}>
                  <SelectTrigger className="bg-white border-gray-200 uppercase text-xs font-bold w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TASK" className="uppercase text-xs font-bold text-blue-600">Task</SelectItem>
                    <SelectItem value="BUG" className="uppercase text-xs font-bold text-red-600">Bug</SelectItem>
                    <SelectItem value="FEATURE" className="uppercase text-xs font-bold text-green-600">Feature</SelectItem>
                    <SelectItem value="EPIC" className="uppercase text-xs font-bold text-purple-600">Epic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Priority</Label>
                  <button 
                    className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                    onClick={handleAISuggestPriority}
                    disabled={isSuggestingPriority}
                  >
                    {isSuggestingPriority ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                    AI SUGGEST
                  </button>
                </div>
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
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Sprint</Label>
                <Select value={issue.sprintId || 'backlog'} onValueChange={handleSprintChange}>
                  <SelectTrigger className="bg-white border-gray-200 w-full text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog" className="text-xs font-semibold">Backlog</SelectItem>
                    {sprints.filter(s => s.status !== 'COMPLETED').map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs font-semibold">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Time Tracking</Label>
                <div className="bg-white border border-gray-200 rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Clock size={14} className={isTimerRunning ? "text-blue-500 animate-pulse" : "text-gray-400"} />
                       <span className="text-sm font-bold">{Math.floor(elapsedTime / 60)}h {elapsedTime % 60}m</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant={isTimerRunning ? "destructive" : "secondary"}
                      className="h-7 px-3 text-[10px] font-bold"
                      onClick={handleToggleTimer}
                    >
                      {isTimerRunning ? <Square size={12} className="mr-1.5" /> : <Play size={12} className="mr-1.5" />}
                      {isTimerRunning ? "STOP" : "START"}
                    </Button>
                  </div>
                  <div className="space-y-1">
                     <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                        <span>Progress</span>
                        <span>{issue.estimatedTime ? Math.round((elapsedTime / issue.estimatedTime) * 100) : 0}%</span>
                     </div>
                     <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-500" 
                          style={{ width: `${issue.estimatedTime ? Math.min(100, (elapsedTime / issue.estimatedTime) * 100) : 0}%` }}
                        />
                     </div>
                  </div>
                </div>
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
