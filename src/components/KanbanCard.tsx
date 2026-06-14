import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Issue, Priority, User } from '../types';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { AlertCircle, ArrowUp, ArrowDown, Minus, Calendar, AlignLeft, Bug, Sparkles, CheckSquare, Bookmark, Crown } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { motion } from 'motion/react';

interface KanbanCardProps {
  issue: Issue;
  isOverlay?: boolean;
  onClick?: () => void;
  assignee?: User;
  coordinator?: User;
  projectKey?: string;
  showStatus?: boolean;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ issue, isOverlay, onClick, assignee, coordinator, projectKey, showStatus }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: {
      type: 'Issue',
      issue,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case 'URGENT': return <AlertCircle className="text-red-500" size={14} />;
      case 'HIGH': return <ArrowUp className="text-red-600" size={14} />;
      case 'MEDIUM': return <ArrowUp className="text-orange-500" size={14} />;
      case 'LOW': return <ArrowDown className="text-blue-500" size={14} />;
      default: return <Minus className="text-gray-400" size={14} />;
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'BUG':
        return <Bug className="text-red-500 fill-red-500/10" size={12} />;
      case 'FEATURE':
        return <Sparkles className="text-green-500 fill-green-500/10" size={12} />;
      case 'EPIC':
        return <Bookmark className="text-purple-500 fill-purple-500/10" size={12} />;
      case 'TASK':
      default:
        return <CheckSquare className="text-blue-500 fill-blue-500/10" size={12} />;
    }
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-24 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-200"
      />
    );
  }

  return (
    <motion.div
      initial={isOverlay ? { scale: 1.05, rotate: -2 } : { scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`group select-none border-none shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing bg-white rounded-lg overflow-hidden ${
          isOverlay ? 'shadow-xl ring-2 ring-[#0052CC]/20' : ''
        }`}
      >
        <CardContent className="p-3.5 space-y-3.5">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-[#172B4D] leading-tight group-hover:text-[#0052CC] transition-colors line-clamp-2 font-sans">
                {issue.title}
              </p>
              {issue.description && <AlignLeft size={12} className="text-gray-300 mt-0.5" />}
            </div>
          </div>

          {issue.checklist && issue.checklist.length > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[9px] font-bold text-gray-400">
                <span className="flex items-center gap-1 font-mono">
                  <CheckSquare size={10} />
                  <span>SUBTASKS</span>
                </span>
                <span className="font-mono">
                  {issue.checklist.filter(item => item.completed).length}/{issue.checklist.length}
                </span>
              </div>
              <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ 
                    width: `${(issue.checklist.filter(item => item.completed).length / 
                      issue.checklist.length) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 -m-1 rounded hover:bg-gray-100 transition-colors">
                {getTypeIcon(issue.type)}
                {getPriorityIcon(issue.priority)}
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                  {projectKey || 'PROJ'}-{issue.issueIndex || 1}
                </span>
              </div>
              
              {issue.dueDate && (
                <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  issue.status !== 'DONE' && isPast(new Date(issue.dueDate)) && !isToday(new Date(issue.dueDate))
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <Calendar size={10} />
                  <span>{format(new Date(issue.dueDate), 'MMM d')}</span>
                </div>
              )}

              {showStatus && (
                <Badge className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 border-none shrink-0 ${
                  issue.status === 'DONE' ? 'bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/20' :
                  issue.status === 'TESTING' ? 'bg-orange-50 text-orange-700 hover:bg-orange-50' :
                  issue.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 hover:bg-blue-50 dark:bg-blue-950/20' :
                  'bg-gray-100 text-gray-500 hover:bg-gray-100'
                }`}>
                  {issue.status}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Coordinator badge */}
              {coordinator && (
                <div
                  title={`Coordinator: ${coordinator.displayName}`}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600"
                >
                  <Crown size={8} className="flex-shrink-0" />
                  <Avatar className="w-4 h-4 ring-1 ring-amber-300 flex-shrink-0">
                    <AvatarImage src={coordinator.photoURL} />
                    <AvatarFallback className="bg-amber-100 text-amber-700 text-[7px] font-bold">
                      {coordinator.displayName?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              {/* Assignee badge */}
              {issue.assigneeId ? (
                <Avatar className="w-5 h-5 ring-2 ring-white flex-shrink-0">
                  <AvatarImage src={assignee?.photoURL} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-[8px] font-bold">
                    {assignee?.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-5 h-5 rounded-full bg-white border border-dashed border-gray-300 flex items-center justify-center">
                   <div className="w-1 h-1 rounded-full bg-gray-200" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
