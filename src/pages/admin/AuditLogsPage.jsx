import React, { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, User, Activity } from 'lucide-react';
import { userService } from '../../services/userService';
import { formatOrgDate, formatOrgTime } from '../../utils/dateUtils';

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      const data = await userService.getAuditLogs();
      setLogs(data);
      setLoading(false);
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Biometric & Attendance Audit Trail
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Immutable system audit logs tracking biometric enrollment, consent state changes, and attendance records.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Action</th>
                <th className="py-4 px-6">Performed By</th>
                <th className="py-4 px-6">Details / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-4 px-6 text-slate-500 dark:text-slate-400">
                    {formatOrgDate(log.created_at)} {formatOrgTime(log.created_at)}
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-slate-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-700 dark:text-slate-300">
                    {log.performed_by || 'SYSTEM'}
                  </td>
                  <td className="py-4 px-6 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {JSON.stringify(log.metadata || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
