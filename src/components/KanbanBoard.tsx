import React, { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Issue, IssueStatus, Priority, User } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { issueService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

const COLUMNS: { id: IssueStatus; title: string }[] = [
  { id: 'TODO', title: 'To Do' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'TESTING', title: 'Testing' },
  { id: 'DONE', title: 'Done' },
];

interface KanbanBoardProps {
  projectId: string;
  issues: Issue[];
  onIssueClick?: (issue: Issue) => void;
  members: User[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId, issues, onIssueClick, members }) => {
  const { userProfile } = useAuth();
  const [activeIssue, setActiveIssue] = React.useState<Issue | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const issue = issues.find((i) => i.id === active.id);
    if (issue) setActiveIssue(issue);
  };

  const onDragOver = async (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !userProfile) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAnIssue = active.data.current?.type === 'Issue';
    const isOverAnIssue = over.data.current?.type === 'Issue';

    if (!isActiveAnIssue) return;

    // Dragging issue over another issue
    if (isActiveAnIssue && isOverAnIssue) {
      const activeIndex = issues.findIndex((i) => i.id === activeId);
      const overIndex = issues.findIndex((i) => i.id === overId);
      
      if (issues[activeIndex].status !== issues[overIndex].status) {
        // Move to new status
        await issueService.updateIssue(projectId, activeId as string, {
          status: issues[overIndex].status,
        }, userProfile.uid);
      }
    }

    // Dragging issue over a column
    const isOverAColumn = over.data.current?.type === 'Column';
    if (isActiveAnIssue && isOverAColumn) {
      const activeIndex = issues.findIndex((i) => i.id === activeId);
      if (issues[activeIndex].status !== overId) {
        await issueService.updateIssue(projectId, activeId as string, {
          status: overId as IssueStatus,
        }, userProfile.uid);
      }
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Handle final sorting if needed (optional for simplicity here)
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            issueIds={issues.filter((i) => i.status === col.id).map((i) => i.id)}
          >
            <SortableContext
              items={issues.filter((i) => i.status === col.id).map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3 min-h-[100px]">
                {issues
                  .filter((i) => i.status === col.id)
                  .map((issue) => (
                    <KanbanCard 
                      key={issue.id} 
                      issue={issue} 
                      onClick={() => onIssueClick?.(issue)}
                      assignee={members.find(m => m.uid === issue.assigneeId)}
                    />
                  ))}
              </div>
            </SortableContext>
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={{
        duration: 250,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeIssue ? (
          <KanbanCard 
            issue={activeIssue} 
            isOverlay 
            assignee={members.find(m => m.uid === activeIssue.assigneeId)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
