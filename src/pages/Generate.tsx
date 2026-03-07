import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2, CheckCircle, AlertCircle, Download, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateReportStream } from '../services/gemini';
import { saveAs } from 'file-saver';
import { cn } from '../lib/utils';
import { exportToWord } from '../lib/markdownToDocx';

interface FileWithPreview extends File {
  preview?: string;
}

export default function Generate() {
  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    description: ''
  });
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024, // 100MB
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!formData.companyName) {
      setError("请输入企业名称");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress('');
    setIsComplete(false);

    try {
      // Convert files to base64
      const filePromises = files.map(file => {
        return new Promise<{ mimeType: string; data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({
              mimeType: file.type,
              data: base64
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const processedFiles = await Promise.all(filePromises);

      const result = await generateReportStream({
        companyName: formData.companyName,
        website: formData.website,
        description: formData.description,
        files: processedFiles,
        // onProgress removed to prevent streaming display
      });

      setProgress(result); // Set the full content at once

      // Save to history
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          website: formData.website,
          description: formData.description,
          content: result
        })
      });

      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError("报告生成失败，请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!progress) return;

    try {
      const blob = await exportToWord(progress, `${formData.companyName}_深度尽调报告.docx`);
      saveAs(blob, `${formData.companyName}_深度尽调报告.docx`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("导出失败，请重试");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">生成新报告</h2>
        <p className="text-slate-500">输入企业详细信息以生成全面的深度尽调报告。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input Form */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  企业名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="例如：某某科技有限公司"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  官网地址
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  企业简介
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="请输入企业的基本情况、主营业务等..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              附件上传 (选填)
            </label>
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-medium">
                拖拽文件到此处，或点击选择文件
              </p>
              <p className="text-xs text-slate-400 mt-1">
                支持 PDF, Word, 图片 (最大 100MB)
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.companyName}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2",
              isGenerating || !formData.companyName
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在生成报告...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                生成报告
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              报告预览
              {isGenerating && <span className="text-xs font-normal text-indigo-600 animate-pulse">• AI 正在撰写...</span>}
              {isComplete && <span className="text-xs font-normal text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> 已完成</span>}
            </h3>
            {progress && (
              <button
                onClick={handleExport}
                className="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
              >
                <Download className="w-4 h-4" />
                导出 Word
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            {isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-12 h-12 mb-4 animate-spin text-indigo-500" />
                <p className="text-slate-600 font-medium">AI 正在深入分析并撰写报告...</p>
                <p className="text-sm text-slate-400 mt-2">这可能需要几分钟时间，请耐心等待</p>
              </div>
            ) : progress ? (
              <article className="prose prose-slate prose-sm max-w-none 
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
                  {progress}
                </ReactMarkdown>
              </article>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <FileText className="w-16 h-16 mb-4 opacity-20" />
                <p>生成的报告将显示在这里</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
