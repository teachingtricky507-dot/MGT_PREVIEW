import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Issue } from '../types';
import { format, subDays } from 'date-fns';

interface CumulativeFlowChartProps {
  issues: Issue[];
}

export const CumulativeFlowChart: React.FC<CumulativeFlowChartProps> = ({ issues }) => {
  const data = useMemo(() => {
    const chartData = [];
    const total = issues.length;
    const doneCount = issues.filter(i => i.status === 'DONE').length;
    const progressCount = issues.filter(i => i.status === 'IN_PROGRESS').length;
    const testingCount = issues.filter(i => i.status === 'TESTING').length;
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const formattedDate = format(date, 'MMM d');
      
      const fraction = (6 - i) / 6; // 0 to 1
      const simulatedDone = Math.round(doneCount * fraction);
      const simulatedTesting = Math.round(testingCount * (0.5 + 0.5 * fraction) + (doneCount - simulatedDone) * 0.4);
      const simulatedProgress = Math.round(progressCount * (0.8 + 0.2 * fraction) + (testingCount - simulatedTesting) * 0.3);
      
      const finalDone = Math.max(0, Math.min(total, simulatedDone));
      const finalTesting = Math.max(0, Math.min(total - finalDone, simulatedTesting));
      const finalProgress = Math.max(0, Math.min(total - finalDone - finalTesting, simulatedProgress));
      const finalTodo = Math.max(0, total - finalDone - finalTesting - finalProgress);

      chartData.push({
        date: formattedDate,
        'To Do': finalTodo,
        'In Progress': finalProgress,
        'Testing': finalTesting,
        'Done': finalDone,
      });
    }

    return chartData;
  }, [issues]);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Flow Analysis</span>
        <h3 className="text-sm font-bold text-[#172B4D]">Cumulative Flow Diagram (CFD)</h3>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F4F5F7" />
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
            />
            <Tooltip 
              contentStyle={{ background: '#FFF', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
              labelStyle={{ fontWeight: 'bold', fontSize: 11, color: '#172B4D' }}
            />
            <Legend 
              verticalAlign="top" 
              height={36} 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: '#6B7280' }}
            />
            <Area type="monotone" dataKey="To Do" stackId="1" stroke="#9CA3AF" fill="#E5E7EB" />
            <Area type="monotone" dataKey="In Progress" stackId="1" stroke="#0052CC" fill="#DEEBFF" />
            <Area type="monotone" dataKey="Testing" stackId="1" stroke="#F59E0B" fill="#FEF3C7" />
            <Area type="monotone" dataKey="Done" stackId="1" stroke="#10B981" fill="#D1FAE5" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
