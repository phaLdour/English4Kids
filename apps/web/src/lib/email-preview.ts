/**
 * Sprint 5 S5-4: client-side email-template previewer.
 *
 * The actual `renderEmailTemplate` source lives in
 * `supabase/functions/_shared/email-templates.ts` because that's where the
 * edge function pulls it from. The Next.js app cannot import from outside
 * its own resolve roots without bundler config, so we maintain a typed
 * mirror of the template SHAPES here and recompute the output via a
 * lightweight wrapper. The mirror is intentionally a re-implementation,
 * not a tree-shake — the two sides of the boundary should drift only when
 * the contract is deliberately changed, and the Deno-runtime tests in
 * `supabase/functions/vpc-upgrade/email-template.test.ts` are the source
 * of truth for the actual template text.
 *
 * Use case: parents are not expected to ever see this page. It's a
 * design-review tool — visual QA of the rendered HTML in a real browser
 * without standing up SMTP. It's gated behind
 * `NEXT_PUBLIC_E4K_ENV !== 'production'` at the route level.
 *
 * Why duplicate the templates instead of importing across the boundary?
 *   1. The edge runtime imports the templates with `.ts` extension; Next
 *      with strict TS chokes on that.
 *   2. Email-template copy should ship with the server, not the client
 *      bundle — keeping them server-side prevents accidental inclusion
 *      in a production webpack chunk.
 */

export type PreviewTemplateName =
  | 'vpc-first-confirmation'
  | 'vpc-second-confirmation-reminder'
  | 'vpc-upgrade-complete';

export interface PreviewSampleData {
  confirmLink: string;
  parentNickname: string;
  secondConfirmAvailableAt: string;
  verifiedEmail: string;
}

export const DEFAULT_PREVIEW_DATA: PreviewSampleData = {
  confirmLink: 'https://app.english4kids.app/vpc-confirm/sample-token-abc123',
  parentNickname: 'Asha',
  secondConfirmAvailableAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  verifiedEmail: 'parent@example.com',
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface RenderedPreview {
  subject: string;
  html: string;
  text: string;
}

function renderShell(preheader: string, bodyHtml: string, bodyText: string): {
  html: string;
  text: string;
} {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>English4Kids</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f7f5ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f7f5ef;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td>
                <h1 style="font-size:20px;line-height:1.4;margin:0 0 16px 0;color:#0f3d3e;">English4Kids</h1>
                ${bodyHtml}
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px 0;" />
                <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0;">
                  English4Kids never asks for a child's name, email, or photo. We email parents only.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `English4Kids
============

${bodyText}

--
English4Kids never asks for a child's name, email, or photo. We email parents only.`;
  return { html, text };
}

export function renderPreview(
  name: PreviewTemplateName,
  data: PreviewSampleData = DEFAULT_PREVIEW_DATA,
): RenderedPreview {
  const nick = escapeHtml(data.parentNickname || 'there');
  const link = escapeHtml(data.confirmLink);
  const email = escapeHtml(data.verifiedEmail || 'your email');

  if (name === 'vpc-first-confirmation') {
    const bodyHtml = `
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${nick},</p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
        Someone (we hope you!) asked to back up your child's English4Kids progress to the cloud.
        Before we turn on syncing, we need you to confirm twice — once now, and once in 24 hours.
      </p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px 0;"><strong>Step 1 of 2:</strong> click below to confirm this email.</p>
      <p style="margin:0 0 24px 0;">
        <a href="${link}" style="display:inline-block;background-color:#0f3d3e;color:#ffffff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;">Confirm this email</a>
      </p>
      <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0;">
        Or paste this link: <a href="${link}" style="color:#0f3d3e;word-break:break-all;">${link}</a>
      </p>
    `;
    const bodyText = `Hi ${data.parentNickname || 'there'},\n\nStep 1 of 2: ${data.confirmLink}`;
    return {
      subject: 'Confirm your English4Kids parent account',
      ...renderShell('Confirm your email to start the 24-hour COPPA wait.', bodyHtml, bodyText),
    };
  }

  if (name === 'vpc-second-confirmation-reminder') {
    const bodyHtml = `
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${nick},</p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
        The 24-hour wait is over. You can finish setting up cloud sync now.
      </p>
      <p style="margin:0 0 24px 0;">
        <a href="${link}" style="display:inline-block;background-color:#0f3d3e;color:#ffffff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;">Finish setup</a>
      </p>
    `;
    const bodyText = `Hi ${data.parentNickname || 'there'},\n\nFinish setup: ${data.confirmLink}`;
    return {
      subject: 'Ready to finish your English4Kids setup',
      ...renderShell('Your 24-hour wait is over.', bodyHtml, bodyText),
    };
  }

  // vpc-upgrade-complete
  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${nick},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
      Your account is upgraded. Cloud sync is now active for ${email}.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0;">
      You can review or revoke this consent anytime from the parent dashboard.
    </p>
  `;
  const bodyText = `Hi ${data.parentNickname || 'there'},\n\nCloud sync active for ${data.verifiedEmail}.`;
  return {
    subject: 'Welcome to English4Kids cloud sync',
    ...renderShell('Cloud sync is on.', bodyHtml, bodyText),
  };
}

export const PREVIEW_TEMPLATE_NAMES: PreviewTemplateName[] = [
  'vpc-first-confirmation',
  'vpc-second-confirmation-reminder',
  'vpc-upgrade-complete',
];
