import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from './ui/badge';

interface KanbanColumnProps {
  id: string;
  title: string;
  issueIds: string[];
  children: React.ReactNode;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, issueIds, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'Column',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 bg-[#F4F5F7] rounded-lg border-2 border-transparent transition-all ${
        isOver ? 'bg-blue-50 border-[#4C9AFF]/20' : ''
      }`}
    >
      <div className="p-3 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {title}
        </h3>
        <Badge variant="secondary" className="text-[10px] bg-gray-200 text-gray-700 font-bold border-none h-5 min-w-5 justify-center">
          {issueIds.length}
        </Badge>
      </div>
      <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};
