import React, { useMemo, useState } from 'react';
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
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Issue, IssueStatus, Priority, User } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { issueService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Columns, User as UserIcon, AlertCircle, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';

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
  projectKey?: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId, issues, onIssueClick, members, projectKey }) => {
  const { userProfile } = useAuth();
  const [activeIssue, setActiveIssue] = React.useState<Issue | null>(null);
  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'priority'>('status');

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
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveAnIssue = active.data.current?.type === 'Issue';
    const isOverAnIssue = over.data.current?.type === 'Issue';

    if (!isActiveAnIssue) return;

    // Dragging issue over another issue
    if (isActiveAnIssue && isOverAnIssue) {
      const activeIndex = issues.findIndex((i) => i.id === activeId);
      const overIndex = issues.findIndex((i) => i.id === overId);
      
      if (issues[activeIndex].status !== issues[overIndex].status) {
        await issueService.updateIssue(projectId, activeId as string, {
          status: issues[overIndex].status,
        }, userProfile.uid);
      }
    }

    // Dragging issue over a column
    const isOverAColumn = over.data.current?.type === 'Column';
    if (isActiveAnIssue && isOverAColumn) {
      const activeIndex = issues.findIndex((i) => i.id === activeId);
      
      if (overId.includes('__')) {
        const [groupVal, status] = overId.split('__');
        const updates: any = { status: status as IssueStatus };
        
        if (groupBy === 'assignee') {
          updates.assigneeId = groupVal === 'unassigned' ? '' : groupVal;
        } else if (groupBy === 'priority') {
          updates.priority = groupVal as Priority;
        }
        
        // Only trigger update if values actually changed
        const hasStatusChanged = issues[activeIndex].status !== status;
        const hasAssigneeChanged = groupBy === 'assignee' && issues[activeIndex].assigneeId !== updates.assigneeId;
        const hasPriorityChanged = groupBy === 'priority' && issues[activeIndex].priority !== updates.priority;

        if (hasStatusChanged || hasAssigneeChanged || hasPriorityChanged) {
          await issueService.updateIssue(projectId, activeId as string, updates, userProfile.uid);
        }
      } else {
        if (issues[activeIndex].status !== overId) {
          await issueService.updateIssue(projectId, activeId as string, {
            status: overId as IssueStatus,
          }, userProfile.uid);
        }
      }
    }
  };

  const onDragEnd = async () => {
    setActiveIssue(null);
  };

  // Compile lanes based on Group By state
  const swimlanes = useMemo(() => {
    if (groupBy === 'assignee') {
      const lanes = members.map((member) => ({
        id: member.uid,
        title: member.displayName,
        avatar: (
          <Avatar className="w-5 h-5 border">
            <AvatarImage src={member.photoURL} />
            <AvatarFallback className="text-[9px] font-bold">{member.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
        ),
        issues: issues.filter((i) => i.assigneeId === member.uid),
      }));

      // Add Unassigned lane if any issues are unassigned
      const unassignedIssues = issues.filter((i) => !i.assigneeId);
      if (unassignedIssues.length > 0 || issues.length === 0) {
        lanes.push({
          id: 'unassigned',
          title: 'Unassigned',
          avatar: (
            <div className="w-5 h-5 rounded-full bg-white border border-dashed border-gray-300 flex items-center justify-center">
              <UserIcon className="w-3 h-3 text-gray-400" />
            </div>
          ),
          issues: unassignedIssues,
        });
      }
      return lanes;
    }

    if (groupBy === 'priority') {
      const priorities: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
      return priorities.map((prio) => {
        let pIcon = <AlertCircle size={14} className="text-gray-400" />;
        let pColor = 'text-gray-500';
        if (prio === 'URGENT') { pIcon = <AlertCircle size={14} className="text-red-500" />; pColor = 'text-red-600'; }
        if (prio === 'HIGH') { pIcon = <ArrowUp size={14} className="text-red-600" />; pColor = 'text-red-600'; }
        if (prio === 'MEDIUM') { pIcon = <ArrowUp size={14} className="text-orange-500" />; pColor = 'text-orange-600'; }
        if (prio === 'LOW') { pIcon = <ArrowDown size={14} className="text-blue-500" />; pColor = 'text-blue-600'; }

        return {
          id: prio,
          title: prio,
          avatar: pIcon,
          issues: issues.filter((i) => i.priority === prio),
        };
      });
    }

    return [];
  }, [groupBy, issues, members]);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Board Controls */}
      <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm self-start">
        <Columns size={14} className="text-gray-400" />
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Group By:</span>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
          <SelectTrigger className="border-none bg-gray-50 shadow-none h-8 text-xs font-bold w-32 uppercase text-gray-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status" className="uppercase text-xs font-bold">Status</SelectItem>
            <SelectItem value="assignee" className="uppercase text-xs font-bold">Assignee</SelectItem>
            <SelectItem value="priority" className="uppercase text-xs font-bold">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board Layout */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          {groupBy === 'status' ? (
            /* Standard Column view */
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
                            projectKey={projectKey}
                          />
                        ))}
                    </div>
                  </SortableContext>
                </KanbanColumn>
              ))}
            </div>
          ) : (
            /* Swimlane Rows view */
            <div className="space-y-8 pb-8 min-w-[1150px]">
              {/* Header column labels */}
              <div className="flex gap-4 pl-2">
                {COLUMNS.map(col => (
                  <div key={col.id} className="w-72 shrink-0 border-b pb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{col.title}</span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {swimlanes.map((lane) => (
                <div key={lane.id} className="space-y-2.5">
                  <div className="flex items-center gap-2.5 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100 self-start text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    {lane.avatar}
                    <span>{lane.title}</span>
                    <Badge className="bg-gray-200 text-gray-500 font-bold hover:bg-gray-200 h-5 text-[10px] min-w-5 justify-center border-none">
                      {lane.issues.length}
                    </Badge>
                  </div>

                  <div className="flex gap-4">
                    {COLUMNS.map((col) => {
                      const laneColId = `${lane.id}__${col.id}`;
                      const colIssues = lane.issues.filter(i => i.status === col.id);
                      return (
                        <KanbanColumn
                          key={laneColId}
                          id={laneColId}
                          title={col.title}
                          issueIds={colIssues.map((i) => i.id)}
                          hideHeader
                        >
                          <SortableContext
                            items={colIssues.map((i) => i.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="flex flex-col gap-2.5 min-h-[70px]">
                              {colIssues.map((issue) => (
                                <KanbanCard 
                                  key={issue.id} 
                                  issue={issue} 
                                  onClick={() => onIssueClick?.(issue)}
                                  assignee={members.find(m => m.uid === issue.assigneeId)}
                                  projectKey={projectKey}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </KanbanColumn>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drag Overlay */}
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
                projectKey={projectKey}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};
