import React, { useEffect, useState } from 'react';
import { Search, FileText, Trash2, Download, Eye, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Report } from '../types';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { exportToWord } from '../lib/markdownToDocx';

export default function History() {
  const [reports, setReports] = useState<Report[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [searchQuery]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const url = searchQuery 
        ? `/api/reports?search=${encodeURIComponent(searchQuery)}`
        : '/api/reports';
      const res = await fetch(url);
      const data = await res.json();
      setReports(data);
    } catch (error) {
      console.error("Failed to fetch reports", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这份报告吗？")) return;

    try {
      await fetch(`/api/reports/${id}`, { method: 'DELETE' });
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (error) {
      console.error("Failed to delete report", error);
    }
  };

  const handleExport = async (report: Report, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      const blob = await exportToWord(report.content, `${report.companyName}_深度尽调报告.docx`);
      saveAs(blob, `${report.companyName}_深度尽调报告.docx`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("导出失败，请重试");
    }
  };

  return (
    <div className="flex h-full">
      {/* List Column */}
      <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索报告..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">加载中...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>暂无报告。</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reports.map(report => (
                <li
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedReport?.id === report.id ? 'bg-indigo-50 hover:bg-indigo-50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-medium ${selectedReport?.id === report.id ? 'text-indigo-700' : 'text-slate-900'}`}>
                      {report.companyName}
                    </h3>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    {report.description || "无描述。"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleExport(report, e)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all"
                      title="导出 Word"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(report.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Detail Column */}
      <div className="flex-1 bg-slate-50 overflow-y-auto p-8">
        {selectedReport ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[800px] p-8">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{selectedReport.companyName}</h1>
                <p className="text-slate-500 text-sm mt-1">生成时间：{new Date(selectedReport.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => handleExport(selectedReport)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>
            </div>
            
            <article className="prose prose-slate max-w-none 
                prose-headings:text-slate-900 prose-headings:font-bold 
                prose-h1:text-2xl prose-h1:border-b prose-h1:pb-2 prose-h1:mb-6
                prose-h2:text-xl prose-h2:text-indigo-700 prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-lg prose-h3:text-slate-800
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-table:border-collapse prose-table:w-full prose-table:my-6 prose-table:shadow-sm
                prose-th:bg-slate-100 prose-th:p-3 prose-th:text-left prose-th:text-slate-700 prose-th:border prose-th:border-slate-200
                prose-td:p-3 prose-td:border prose-td:border-slate-200 prose-td:text-slate-600
                prose-li:text-slate-600
                prose-strong:text-slate-800 prose-strong:font-semibold">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedReport.content}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <FileText className="w-16 h-16 mb-4 opacity-20" />
            <p>选择一份报告以查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
}
