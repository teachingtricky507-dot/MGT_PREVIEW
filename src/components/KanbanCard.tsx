import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Issue, Priority, User } from '../types';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { AlertCircle, ArrowUp, ArrowDown, Minus, Calendar, AlignLeft } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { motion } from 'motion/react';

interface KanbanCardProps {
  issue: Issue;
  isOverlay?: boolean;
  onClick?: () => void;
  assignee?: User;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ issue, isOverlay, onClick, assignee }) => {
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
              <p className="text-[13px] font-medium text-[#172B4D] leading-tight group-hover:text-[#0052CC] transition-colors line-clamp-2">
                {issue.title}
              </p>
              {issue.description && <AlignLeft size={12} className="text-gray-300 mt-0.5" />}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 p-1 -m-1 rounded hover:bg-gray-100 transition-colors">
                {getPriorityIcon(issue.priority)}
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                  {issue.id.substring(0, 4).toUpperCase()}
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
            </div>

            <div className="flex -space-x-1 items-center">
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
