import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: '无文件内容' }, { status: 400 });
    }

    const buffer = Buffer.from(content, 'base64');
    const ext = name?.split('.').pop()?.toLowerCase();

    // For plain text files, decode directly
    if (ext === 'txt') {
      return NextResponse.json({ text: buffer.toString('utf-8') });
    }

    // For docx, extract raw text (basic extraction without mammoth)
    if (ext === 'docx') {
      // Basic: return buffer as utf8, docx XML will be messy but AI can parse it
      // For production, install mammoth: npm install mammoth
      const raw = buffer.toString('utf-8');
      // Extract text between XML tags
      const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return NextResponse.json({ text: text.slice(0, 10000) });
    }

    // For PDF and images, return a message asking user to paste text
    return NextResponse.json({
      text: '',
      error: 'PDF/图片文件请切换到"粘贴文本"标签，手动粘贴合同内容',
    }, { status: 422 });

  } catch (error) {
    return NextResponse.json({ error: '文件解析失败' }, { status: 500 });
  }
}
