import React, { useState, useEffect } from 'react';
import { Download, Search, Calendar, FileSpreadsheet, Filter } from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { formatOrgDate, formatOrgTime } from '../../utils/dateUtils';
import { getMockDB } from '../../services/mockDatabase';

export function ReportsPage() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const db = getMockDB();
      // Join attendance with user profiles
      const enriched = db.attendance.map((att) => {
        const u = db.users.find((user) => user.id === att.user_id);
        return {
          ...att,
          fullName: u?.full_name || 'Unknown',
          employeeId: u?.employee_id || 'N/A',
          department: u?.department || 'General',
          avatarUrl: u?.avatar_url,
        };
      });
      setRecords(enriched);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleExport = async () => {
    await attendanceService.exportCsvReport();
  };

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Attendance Reports & Analytics
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Filter, inspect audit records, and export CSV logs for organizational compliance.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 flex items-center gap-2 transition"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      {/* Report Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Employee</th>
                <th className="py-4 px-6">Check-in Time</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Verification Method</th>
                <th className="py-4 px-6 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-4 px-6 font-medium text-slate-900 dark:text-white">
                    {formatOrgDate(r.attendance_date)}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900 dark:text-white">{r.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{r.employeeId} • {r.department}</div>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-700 dark:text-slate-300">
                    {formatOrgTime(r.check_in_time)}
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-600 dark:text-slate-400">
                    {r.verification_method}
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-bold text-emerald-500">
                    {r.confidence_score ? `${Math.round(r.confidence_score * 100)}%` : '96%'}
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
