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
            font: "Calibri",
            size: 24, // 12pt
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 spacing
              after: 200,
            },
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

function createTable(node: AstNode): Table {
  const rows: TableRow[] = [];
  
  if (node.children) {
    node.children.forEach((rowNode, rowIndex) => {
      if (rowNode.type === 'tableRow') {
        const cells: TableCell[] = [];
        const isHeader = rowIndex === 0;

        if (rowNode.children) {
          rowNode.children.forEach((cellNode) => {
            if (cellNode.type === 'tableCell') {
               const textRuns = extractTextRuns(cellNode.children || []);
               
               cells.push(new TableCell({
                 children: [new Paragraph({ 
                   children: textRuns,
                   alignment: AlignmentType.LEFT
                 })],
                 width: {
                   size: 100,
                   type: WidthType.PERCENTAGE,
                 },
                 shading: isHeader ? {
                   fill: "E6E6E6", // Light gray for header
                 } : undefined,
                 verticalAlign: AlignmentType.CENTER,
                 margins: {
                   top: 100,
                   bottom: 100,
                   left: 100,
                   right: 100,
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
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
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
