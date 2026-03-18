import { NextRequest, NextResponse } from 'next/server';

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '文件超过 20MB 限制' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
    }

    // Read file content as base64 for text extraction
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return NextResponse.json({
      success: true,
      name: file.name,
      size: file.size,
      type: file.type,
      content: base64,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 });
  }
}
