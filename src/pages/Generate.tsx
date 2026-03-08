import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2, CheckCircle, AlertCircle, Download, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          website: formData.website,
          description: formData.description,
          files: processedFiles,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      const result = data.content;

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
      const blob = await exportToWord(progress, `${formData.companyName}深度尽调报告.docx`);
      saveAs(blob, `${formData.companyName}深度尽调报告.docx`);
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

      <div className="space-y-8">
        {/* Input Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                基本信息
              </h3>
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
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                附件资料
              </h3>
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  附件上传 (选填)
                </label>
                <div
                  {...getRootProps()}
                  className={cn(
                    "flex-1 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[200px]",
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
                  <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
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
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.companyName}
            className={cn(
              "w-full md:w-1/3 py-4 px-6 rounded-xl font-bold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-3",
              isGenerating || !formData.companyName
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98]"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                正在生成报告...
              </>
            ) : (
              <>
                <FileText className="w-6 h-6" />
                开始生成深度尽调报告
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100 justify-center">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Preview Section - Full Width */}
        <div className="bg-slate-100 rounded-xl shadow-lg border border-slate-200 flex flex-col min-h-[800px] overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              报告预览
              {isGenerating && <span className="text-sm font-normal text-indigo-600 animate-pulse ml-2">• AI 正在撰写...</span>}
              {isComplete && <span className="text-sm font-normal text-green-600 flex items-center gap-1 ml-2"><CheckCircle className="w-4 h-4"/> 已完成</span>}
            </h3>
            {progress && (
              <button
                onClick={handleExport}
                className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                导出 Word 文档
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                <Loader2 className="w-16 h-16 mb-6 animate-spin text-indigo-500" />
                <p className="text-lg text-slate-700 font-medium">AI 正在深入分析并撰写报告...</p>
                <p className="text-slate-500 mt-2">正在分析行业数据、产业链结构及风险因素</p>
                <p className="text-sm text-slate-400 mt-1">这可能需要 1-3 分钟，请耐心等待</p>
              </div>
            ) : progress ? (
              <div className="bg-white shadow-2xl p-[2.54cm] min-h-[29.7cm] w-[21cm] mx-auto" style={{ fontFamily: '"Microsoft YaHei", sans-serif' }}>
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
                  {progress}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <FileText className="w-12 h-12 text-slate-300" />
                </div>
                <p className="text-lg font-medium text-slate-500">生成的报告将显示在这里</p>
                <p className="text-sm text-slate-400 mt-2">请在上方填写信息并点击生成</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
