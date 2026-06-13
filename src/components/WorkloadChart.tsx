import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Issue, User } from '../types';

interface WorkloadChartProps {
  issues: Issue[];
  members: User[];
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ issues, members }) => {
  const data = members.map(member => {
    const taskCount = issues.filter(i => i.assigneeId === member.uid).length;
    const doneCount = issues.filter(i => i.assigneeId === member.uid && i.status === 'DONE').length;
    
    return {
      name: member.displayName.split(' ')[0],
      tasks: taskCount,
      done: doneCount,
      pending: taskCount - doneCount
    };
  });

  const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  return (
    <div className="h-[300px] w-full bg-white dark:bg-card p-4 rounded-xl border border-border">
       <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Team Workload</h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
          />
          <Tooltip 
             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
             cursor={{ fill: '#f8fafc' }}
          />
          <Bar dataKey="tasks" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
