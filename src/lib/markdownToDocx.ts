import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  BorderStyle, 
  WidthType,
  AlignmentType,
  Indent
} from 'docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

// Define types for AST nodes since we might not have full types for mdast in this environment
interface AstNode {
  type: string;
  children?: AstNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  align?: string[]; // For tables
}

export async function exportToWord(content: string, filename: string) {
  // Parse Markdown to AST
  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(content) as AstNode;

  const docChildren: (Paragraph | Table)[] = [];

  // Process AST nodes
  processNodes(ast.children || [], docChildren);

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: "Microsoft YaHei", // Better for Chinese
            size: 24, // 12pt
            color: "333333",
          },
          paragraph: {
            spacing: {
              line: 360, // 1.5 spacing
              after: 200,
            },
            alignment: AlignmentType.JUSTIFIED,
          },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          run: {
            font: "Microsoft YaHei",
            size: 36, // 18pt
            bold: true,
            color: "2E4053", // Dark Blue
          },
          paragraph: {
            spacing: { before: 480, after: 240 },
            border: {
              bottom: { color: "EAECEE", space: 1, value: "single", size: 6 },
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          run: {
            font: "Microsoft YaHei",
            size: 32, // 16pt
            bold: true,
            color: "2874A6", // Medium Blue
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          run: {
            font: "Microsoft YaHei",
            size: 28, // 14pt
            bold: true,
            color: "1F618D",
          },
          paragraph: {
            spacing: { before: 320, after: 160 },
          },
        },
      ],
    },
    sections: [{
      properties: {},
      children: docChildren
    }]
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

function processNodes(nodes: AstNode[], docChildren: (Paragraph | Table)[], listDepth = 0) {
  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        docChildren.push(createHeading(node));
        break;
      case 'paragraph':
        docChildren.push(createParagraph(node));
        break;
      case 'list':
        processList(node, docChildren, listDepth);
        break;
      case 'table':
        docChildren.push(createTable(node));
        break;
      default:
        // Ignore other types or handle if needed
        break;
    }
  }
}

function createHeading(node: AstNode): Paragraph {
  const textRuns = extractTextRuns(node.children || []);
  let headingLevel = HeadingLevel.HEADING_1;
  
  switch (node.depth) {
    case 1: headingLevel = HeadingLevel.TITLE; break;
    case 2: headingLevel = HeadingLevel.HEADING_1; break;
    case 3: headingLevel = HeadingLevel.HEADING_2; break;
    case 4: headingLevel = HeadingLevel.HEADING_3; break;
    case 5: headingLevel = HeadingLevel.HEADING_4; break;
    case 6: headingLevel = HeadingLevel.HEADING_5; break;
  }

  return new Paragraph({
    children: textRuns,
    heading: headingLevel,
    spacing: { before: 240, after: 120 },
  });
}

function createParagraph(node: AstNode): Paragraph {
  const textRuns = extractTextRuns(node.children || []);
  return new Paragraph({
    children: textRuns,
    spacing: { after: 200 },
  });
}

function processList(node: AstNode, docChildren: (Paragraph | Table)[], depth: number) {
  const ordered = node.ordered || false;
  
  if (node.children) {
    node.children.forEach((listItem, index) => {
      if (listItem.type === 'listItem') {
        // List items usually contain a paragraph as the first child
        const itemChildren = listItem.children || [];
        
        itemChildren.forEach(child => {
           if (child.type === 'paragraph') {
             const textRuns = extractTextRuns(child.children || []);
             docChildren.push(new Paragraph({
               children: textRuns,
               bullet: {
                 level: depth, // 0-based level
               },
               // If it's ordered, we might need numbering, but docx handles bullets/numbering via levels mostly
             }));
           } else if (child.type === 'list') {
             // Nested list
             processList(child, docChildren, depth + 1);
           }
        });
      }
    });
  }
}

// Helper to calculate text length from AST nodes
function getTextLength(nodes: AstNode[]): number {
  let length = 0;
  for (const node of nodes) {
    if (node.type === 'text') {
      length += (node.value || '').length;
    } else if (node.children) {
      length += getTextLength(node.children);
    }
  }
  return length;
}

function createTable(node: AstNode): Table {
  const rows: TableRow[] = [];
  
  // 1. Calculate column widths based on content
  const colMaxLengths: number[] = [];
  
  if (node.children) {
    node.children.forEach((rowNode) => {
      if (rowNode.type === 'tableRow' && rowNode.children) {
        rowNode.children.forEach((cellNode, colIndex) => {
          if (cellNode.type === 'tableCell') {
            const len = getTextLength(cellNode.children || []);
            colMaxLengths[colIndex] = Math.max(colMaxLengths[colIndex] || 0, len);
          }
        });
      }
    });
  }

  // 2. Calculate percentages
  // Min width per column (chars) to prevent too narrow columns
  const MIN_CHARS = 5; 
  // Max chars to cap the weight of very long columns
  const MAX_CHARS = 100;

  const weightedLengths = colMaxLengths.map(len => Math.min(Math.max(len, MIN_CHARS), MAX_CHARS));
  const totalWeight = weightedLengths.reduce((sum, len) => sum + len, 0);
  
  const colWidths = weightedLengths.map(len => Math.round((len / totalWeight) * 100));

  // Ensure total is 100% (distribute remainder)
  const currentTotal = colWidths.reduce((sum, w) => sum + w, 0);
  if (currentTotal !== 100 && colWidths.length > 0) {
    colWidths[colWidths.length - 1] += (100 - currentTotal);
  }

  if (node.children) {
    node.children.forEach((rowNode, rowIndex) => {
      if (rowNode.type === 'tableRow') {
        const cells: TableCell[] = [];
        const isHeader = rowIndex === 0;

        if (rowNode.children) {
          rowNode.children.forEach((cellNode, colIndex) => {
            if (cellNode.type === 'tableCell') {
               const textRuns = extractTextRuns(cellNode.children || []);
               
               // Use calculated width
               const widthPercent = colWidths[colIndex] || (100 / colMaxLengths.length);

               cells.push(new TableCell({
                 children: [new Paragraph({ 
                   children: textRuns,
                   alignment: AlignmentType.LEFT,
                   style: "Normal" // Ensure table text uses Normal style
                 })],
                 width: {
                   size: widthPercent,
                   type: WidthType.PERCENTAGE,
                 },
                 shading: isHeader ? {
                   fill: "F2F4F4", // Light gray/blueish for header
                 } : undefined,
                 verticalAlign: AlignmentType.CENTER,
                 margins: {
                   top: 120,
                   bottom: 120,
                   left: 120,
                   right: 120,
                 },
                 borders: {
                   top: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" },
                   bottom: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" },
                   left: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" },
                   right: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" },
                 }
               }));
            }
          });
        }

        rows.push(new TableRow({
          children: cells,
          tableHeader: isHeader,
        }));
      }
    });
  }

  return new Table({
    rows: rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: { // Outer borders
      top: { style: BorderStyle.SINGLE, size: 8, color: "2E4053" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "2E4053" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "2E4053" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "2E4053" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" },
    },
  });
}

function extractTextRuns(nodes: AstNode[]): TextRun[] {
  const runs: TextRun[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      runs.push(new TextRun({
        text: node.value || '',
      }));
    } else if (node.type === 'strong') {
      const childrenRuns = extractTextRuns(node.children || []);
      childrenRuns.forEach(run => {
        // We can't easily modify an existing TextRun object's properties after creation in a generic way 
        // without casting or recreating. 
        // Simpler approach: Create new TextRun with bold property.
        // But extractTextRuns returns TextRun[].
        // Let's just recurse and assume simple structure for now, or handle manually.
        // Better: pass style context down.
      });
      // Re-implementing recursion for style:
      runs.push(...extractStyledTextRuns([node], { bold: false, italic: false }));
    } else if (node.type === 'emphasis') {
      runs.push(...extractStyledTextRuns([node], { bold: false, italic: false }));
    } else if (node.type === 'link') {
       // Treat link as text for now
       runs.push(...extractStyledTextRuns(node.children || [], {}));
    } else {
       // Recurse for other inline types
       runs.push(...extractTextRuns(node.children || []));
    }
  }
  return runs;
}

// Helper to handle styles recursively
function extractStyledTextRuns(nodes: AstNode[], style: { bold?: boolean, italic?: boolean }): TextRun[] {
  const runs: TextRun[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      runs.push(new TextRun({
        text: node.value || '',
        bold: style.bold,
        italics: style.italic,
      }));
    } else if (node.type === 'strong') {
      runs.push(...extractStyledTextRuns(node.children || [], { ...style, bold: true }));
    } else if (node.type === 'emphasis') {
      runs.push(...extractStyledTextRuns(node.children || [], { ...style, italic: true }));
    } else {
      runs.push(...extractStyledTextRuns(node.children || [], style));
    }
  }
  return runs;
}
