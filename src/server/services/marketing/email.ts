/**
 * Email Marketing Service
 * Integrates with Amazon SES for sending newsletters and promotional emails.
 * Uses an interface pattern for testability (mock SES in tests).
 */

// --- Types ---

export interface EmailRecipient {
  email: string;
  name: string;
  locale?: 'zh' | 'th' | 'en';
}

export interface NewsletterContent {
  subject: string;
  articles: {
    title: string;
    summary: string;
    url: string;
  }[];
  legalUpdates?: string[];
}

export interface PromotionContent {
  subject: string;
  promotionTitle: string;
  description: string;
  discountPercent?: number;
  validUntil?: Date;
  ctaUrl: string;
  ctaText: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  sentCount: number;
  failedCount: number;
  errors?: string[];
}

export interface SESClient {
  sendEmail(params: {
    to: string[];
    subject: string;
    htmlBody: string;
    from: string;
  }): Promise<{ messageId: string; success: boolean }>;
}

// --- Template Rendering ---

const TEMPLATES: Record<string, string> = {
  'legal-newsletter': `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{{subject}}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">中泰法律资讯通讯</h1>
    <p style="margin: 5px 0 0;">China-Thailand Legal Newsletter</p>
  </div>
  <div style="padding: 20px;">
    <p>尊敬的 {{recipientName}}，</p>
    <p>以下是本期法律资讯精选：</p>
    {{articles}}
    {{#legalUpdates}}
    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
      <h3 style="margin-top: 0;">⚖️ 法律法规更新</h3>
      {{legalUpdates}}
    </div>
    {{/legalUpdates}}
  </div>
  <div style="background: #f7fafc; padding: 15px; text-align: center; font-size: 12px; color: #718096;">
    <p>此邮件由中泰智能法律专家系统发送</p>
    <p><a href="{{unsubscribeUrl}}">取消订阅</a></p>
  </div>
</body>
</html>`,

  'promotion': `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{{subject}}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">{{promotionTitle}}</h1>
    {{#discountPercent}}
    <p style="font-size: 36px; font-weight: bold; margin: 10px 0;">{{discountPercent}}% OFF</p>
    {{/discountPercent}}
  </div>
  <div style="padding: 20px;">
    <p>尊敬的 {{recipientName}}，</p>
    <p>{{description}}</p>
    {{#validUntil}}
    <p style="color: #e53e3e; font-weight: bold;">⏰ 优惠截止日期：{{validUntil}}</p>
    {{/validUntil}}
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ctaUrl}}" style="background: #4299e1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">{{ctaText}}</a>
    </div>
  </div>
  <div style="background: #f7fafc; padding: 15px; text-align: center; font-size: 12px; color: #718096;">
    <p>此邮件由中泰智能法律专家系统发送</p>
    <p><a href="{{unsubscribeUrl}}">取消订阅</a></p>
  </div>
</body>
</html>`,

  'welcome': `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>欢迎加入</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #2d3748; color: white; padding: 30px; text-align: center;">
    <h1 style="margin: 0;">欢迎加入中泰智能法律专家系统</h1>
  </div>
  <div style="padding: 20px;">
    <p>尊敬的 {{recipientName}}，</p>
    <p>感谢您注册中泰智能法律专家系统！您现在可以享受以下服务：</p>
    <ul>
      <li>每日3次免费法律咨询</li>
      <li>7天付费功能试用期</li>
      <li>中泰双法域法律分析</li>
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{dashboardUrl}}" style="background: #48bb78; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">开始使用</a>
    </div>
  </div>
  <div style="background: #f7fafc; padding: 15px; text-align: center; font-size: 12px; color: #718096;">
    <p>此邮件由中泰智能法律专家系统发送</p>
  </div>
</body>
</html>`,
};

export type TemplateName = 'legal-newsletter' | 'promotion' | 'welcome';

export function renderTemplate(
  templateName: TemplateName,
  variables: Record<string, string>
): string {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }

  let rendered = template;

  // Replace simple variables {{varName}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value);
  }

  // Handle conditional blocks {{#varName}}...{{/varName}}
  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  rendered = rendered.replace(conditionalRegex, (_match, varName, content) => {
    return variables[varName] ? content : '';
  });

  return rendered;
}

// --- Default SES Client (mock for development) ---

export function createMockSESClient(): SESClient {
  return {
    async sendEmail(params) {
      // In production, this would call AWS SES SDK
      // aws-sdk: ses.sendEmail({ Destination, Message, Source })
      console.log(`[MockSES] Sending email to ${params.to.length} recipients: ${params.subject}`);
      return {
        messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        success: true,
      };
    },
  };
}

const DEFAULT_FROM = 'noreply@china-thailand-legal.com';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.china-thailand-legal.com';

// --- Newsletter Sending ---

export async function sendNewsletter(
  recipients: EmailRecipient[],
  content: NewsletterContent,
  sesClient: SESClient = createMockSESClient()
): Promise<EmailResult> {
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  const articlesHtml = content.articles
    .map(
      (article) => `
    <div style="border-bottom: 1px solid #e2e8f0; padding: 15px 0;">
      <h3 style="margin: 0 0 5px;"><a href="${article.url}" style="color: #2b6cb0;">${article.title}</a></h3>
      <p style="color: #4a5568; margin: 0;">${article.summary}</p>
    </div>`
    )
    .join('');

  const legalUpdatesHtml = content.legalUpdates
    ? content.legalUpdates.map((update) => `<p>• ${update}</p>`).join('')
    : '';

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      const html = renderTemplate('legal-newsletter', {
        subject: content.subject,
        recipientName: recipient.name,
        articles: articlesHtml,
        legalUpdates: legalUpdatesHtml,
        unsubscribeUrl: `${BASE_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
      });

      await sesClient.sendEmail({
        to: [recipient.email],
        subject: content.subject,
        htmlBody: html,
        from: DEFAULT_FROM,
      });
      sentCount++;
    } catch (error) {
      failedCount++;
      errors.push(`Failed to send to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    success: failedCount === 0,
    sentCount,
    failedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// --- Promotion Sending ---

export async function sendPromotion(
  recipients: EmailRecipient[],
  promotion: PromotionContent,
  sesClient: SESClient = createMockSESClient()
): Promise<EmailResult> {
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      const html = renderTemplate('promotion', {
        subject: promotion.subject,
        recipientName: recipient.name,
        promotionTitle: promotion.promotionTitle,
        description: promotion.description,
        discountPercent: promotion.discountPercent?.toString() ?? '',
        validUntil: promotion.validUntil ? promotion.validUntil.toLocaleDateString('zh-CN') : '',
        ctaUrl: promotion.ctaUrl,
        ctaText: promotion.ctaText,
        unsubscribeUrl: `${BASE_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
      });

      await sesClient.sendEmail({
        to: [recipient.email],
        subject: promotion.subject,
        htmlBody: html,
        from: DEFAULT_FROM,
      });
      sentCount++;
    } catch (error) {
      failedCount++;
      errors.push(`Failed to send to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    success: failedCount === 0,
    sentCount,
    failedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export { TEMPLATES };
