import React from 'react';
import { Activity, User } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { 
  MessageSquare, 
  CircleDot, 
  UserPlus, 
  PlusCircle,
  Clock
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface ActivityFeedProps {
  activities: Activity[];
  users: User[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, users }) => {
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 15);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ISSUE_CREATED': return <PlusCircle size={14} className="text-blue-500" />;
      case 'STATUS_CHANGED': return <CircleDot size={14} className="text-orange-500" />;
      case 'ASSIGNEE_CHANGED': return <UserPlus size={14} className="text-purple-500" />;
      case 'COMMENT_ADDED': return <MessageSquare size={14} className="text-green-500" />;
      default: return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'ISSUE_CREATED': return `created issue: ${activity.newValue}`;
      case 'STATUS_CHANGED': return `changed status to ${activity.newValue}`;
      case 'ASSIGNEE_CHANGED': return `assigned to ${activity.newValue}`;
      case 'COMMENT_ADDED': return `commented: "${activity.newValue}..."`;
      default: return 'did something';
    }
  };

  if (activities.length === 0) {
    return (
      <div className="py-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500 font-medium">No recent activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedActivities.map((activity) => {
        const user = users.find(u => u.uid === activity.userId);
        return (
          <div key={activity.id} className="flex gap-4 group">
            <div className="relative">
              <Avatar className="w-8 h-8 ring-2 ring-white">
                <AvatarImage src={user?.photoURL} />
                <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-[10px]">
                  {user?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                {getActivityIcon(activity.type)}
              </div>
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#172B4D] group-hover:text-[#0052CC] transition-colors">
                  {user?.displayName || 'Unknown User'}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : 'just now'}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                {getActivityText(activity)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
