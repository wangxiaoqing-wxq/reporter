import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GenerateOptions {
  companyName: string;
  website?: string;
  description?: string;
  files?: { mimeType: string; data: string }[];
  onProgress?: (chunk: string) => void;
}

export async function generateReportStream(options: GenerateOptions): Promise<string> {
  const { companyName, website, description, files, onProgress } = options;

  const prompt = `
    你是一位专业的投资分析师和尽职调查专家。
    请为以下企业生成一份详尽的《AI 深度尽调报告》：
    
    **企业名称**: ${companyName}
    ${website ? `**官网地址**: ${website}` : ''}
    ${description ? `**企业简介**: ${description}` : ''}
    
    ${files && files.length > 0 ? `我已上传了 ${files.length} 份附件供参考。请分析这些文件以提取相关信息。` : ''}

    **报告结构要求**:
    报告必须严格遵循以下结构，并包含所有章节：

    # ${companyName} - 深度尽调报告

    ## 释义
    *提供一般释义（表格）和专业术语释义（15-20 个，表格）。*

    ## 摘要
    *提取各章节结论性内容。*

    ## 目录
    *列出章节目录。*

    ## 一、企业信息：信息收集
    *基本信息、历史沿革、股东情况等。*

    ## 二、行业分析：行业概述
    *   **产业链概述**：分析上游（重点分析成本）、下游（影响企业未来发展，着重分析增长驱动因素，判断其增速）、发展趋势。
    *   **行业政策**：相关法规和政策。

    ## 三、市场规模与增速
    *当前规模、历史数据及未来预测。*

    ## 四、风险预警
    *   市场风险
    *   政策风险
    *   技术风险
    *   财务风险
    *   竞争风险

    ## 五、AI 总结结论
    *   **公司关注重点方向**：关键发展方向。
    *   **行业“值得继续深入”的结论与理由**：（是/否/有条件），并给出详细理由。

    ## 附录：信息信源
    *按 A/B/C 级可信度分级列出信源。*

    **分析要求**:
    1.  **深度研究**：利用你的知识库理解产业链、驱动因素和趋势。
    2.  **产业链分析**：重点关注上游成本和下游增长驱动因素。
    3.  **格式**：使用 Markdown 格式。适当时使用表格。保持专业、客观，并尽可能引用数据。
    4.  **语言**：全篇使用中文（简体）。
  `;

  const contents = [
    { text: prompt }
  ];

  if (files) {
    files.forEach(file => {
      contents.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      } as any);
    });
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview",
      contents: contents as any,
      config: {
        responseMimeType: "text/plain",
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        if (onProgress) {
          onProgress(fullText);
        }
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
}
