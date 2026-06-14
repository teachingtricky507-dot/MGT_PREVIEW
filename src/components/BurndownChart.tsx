import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Issue } from '../types';
import { format, subDays, isAfter, startOfDay } from 'date-fns';

interface BurndownChartProps {
  issues: Issue[];
}

export const BurndownChart: React.FC<BurndownChartProps> = ({ issues }) => {
  // Generate last 7 days of data
  const data = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'MMM dd');
    
    // Count issues created on or before this day that were NOT done on this day
    // (This is a simplified simulation since we don't have historical status changes)
    const remaining = issues.filter(issue => {
      const createdDate = new Date(issue.createdAt);
      const isCreated = isAfter(date, startOfDay(createdDate)) || format(date, 'yyyy-MM-dd') === format(createdDate, 'yyyy-MM-dd');
      const isDone = issue.status === 'DONE'; // Ideally we'd check IF it was done ON THIS DATE
      return isCreated && !isDone;
    }).length;

    return {
      name: dateStr,
      remaining: remaining,
      ideal: Math.max(0, issues.length - (i * (issues.length / 6)))
    };
  });

  return (
    <div className="h-[300px] w-full bg-white dark:bg-card p-4 rounded-xl border border-border">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Burndown Chart</h4>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-blue-500" />
             <span className="text-[10px] font-bold text-muted-foreground uppercase">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-gray-300" />
             <span className="text-[10px] font-bold text-muted-foreground uppercase">Ideal</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
          />
          <Area 
            type="monotone" 
            dataKey="remaining" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRemaining)" 
            animationDuration={1500}
          />
          <Line 
            type="monotone" 
            dataKey="ideal" 
            stroke="#e2e8f0" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
