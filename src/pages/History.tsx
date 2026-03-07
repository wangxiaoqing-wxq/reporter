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

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);

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

  const openDeleteModal = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setReportToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!reportToDelete) return;

    try {
      const res = await fetch(`/api/reports/${reportToDelete}`, { method: 'DELETE' });
      
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== reportToDelete));
        if (selectedReport?.id === reportToDelete) setSelectedReport(null);
      } else {
        console.error("Failed to delete report, status:", res.status);
        alert("删除失败，请重试");
      }
    } catch (error) {
      console.error("Failed to delete report", error);
      alert("删除出错，请检查网络");
    } finally {
      setDeleteModalOpen(false);
      setReportToDelete(null);
    }
  };

  const handleExport = async (report: Report, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      const blob = await exportToWord(report.content, `${report.companyName}深度尽调报告.docx`);
      saveAs(blob, `${report.companyName}深度尽调报告.docx`);
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
                      onClick={(e) => openDeleteModal(report.id, e)}
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
      <div className="flex-1 bg-slate-100 overflow-y-auto p-8 flex justify-center">
        {selectedReport ? (
          <div className="w-full max-w-[21cm]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{selectedReport.companyName}</h1>
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
            
            <div className="bg-white shadow-2xl p-[2.54cm] min-h-[29.7cm] w-[21cm]" style={{ fontFamily: '"Microsoft YaHei", sans-serif' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-[22pt] font-bold text-[#2E4053] mt-[24pt] mb-[12pt] border-b-2 border-[#EAECEE] pb-[4pt]" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-[18pt] font-bold text-[#2874A6] mt-[20pt] mb-[10pt] border-l-4 border-[#2874A6] pl-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-[15pt] font-bold text-[#1F618D] mt-[16pt] mb-[8pt]" {...props} />,
                  h4: ({node, ...props}) => <h4 className="text-[13pt] font-bold text-[#2E4053] mt-[14pt] mb-[6pt]" {...props} />,
                  p: ({node, ...props}) => <p className="text-[12pt] text-[#333333] leading-[1.6] mb-[10pt] text-justify" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-[2em] mb-[10pt]" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-[2em] mb-[10pt]" {...props} />,
                  li: ({node, ...props}) => <li className="text-[12pt] text-[#333333] leading-[1.6] mb-[4pt]" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-[#000000]" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#BDC3C7] pl-4 py-2 my-4 bg-slate-50 text-slate-600 italic" {...props} />,
                  table: ({node, ...props}) => (
                    <table className="w-full border-collapse my-[12pt] border-[2px] border-[#2E4053]" {...props} />
                  ),
                  thead: ({node, ...props}) => (
                    <thead className="bg-[#F2F4F4]" {...props} />
                  ),
                  tbody: ({node, ...props}) => (
                    <tbody {...props} />
                  ),
                  tr: ({node, ...props}) => (
                    <tr {...props} />
                  ),
                  th: ({node, ...props}) => (
                    <th className="border border-[#BDC3C7] p-[6pt] text-left text-[12pt] font-bold text-[#333333]" {...props} />
                  ),
                  td: ({node, ...props}) => (
                    <td className="border border-[#BDC3C7] p-[6pt] text-[12pt] text-[#333333] align-middle" {...props} />
                  ),
                }}
              >
                {selectedReport.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <FileText className="w-16 h-16 mb-4 opacity-20" />
            <p>选择一份报告以查看详情</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除</h3>
              <p className="text-slate-600 mb-6">
                确定要删除这份报告吗？此操作无法撤销。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
