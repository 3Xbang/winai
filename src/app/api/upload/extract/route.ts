import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: '无文件内容' }, { status: 400 });
    }

    const buffer = Buffer.from(content, 'base64');
    const ext = name?.split('.').pop()?.toLowerCase();

    if (ext === 'txt') {
      return NextResponse.json({ text: buffer.toString('utf-8') });
    }

    if (ext === 'docx' || ext === 'doc') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return NextResponse.json({ text: result.value });
      } catch {
        // mammoth not available, fallback to XML stripping
        const raw = buffer.toString('latin1');
        const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return NextResponse.json({ text: text.slice(0, 10000) });
      }
    }

    return NextResponse.json(
      { text: '', error: 'PDF/图片文件请切换到"粘贴文本"标签，手动粘贴合同内容' },
      { status: 422 },
    );
  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json({ error: '文件解析失败' }, { status: 500 });
  }
}
