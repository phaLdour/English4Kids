/**
 * Email templates for the VPC double opt-in flow (Sprint 5 S5-4).
 *
 * Plain template literals — Deno doesn't run JSX server-side without a
 * bundler, and these templates need to render fast in the edge runtime.
 * Inline styles only (email clients strip <style>/<link>); HTML is kept
 * dead-simple so plain-text mail clients show something legible too.
 *
 * Contracts:
 *   - No template variable is ever interpolated without a fallback. Every
 *     accessor reads from a typed `TemplateData` shape; missing optional
 *     fields fall back to a safe default rather than the string `undefined`.
 *   - All HTML is escaped with `escapeHtml` before interpolation. The
 *     confirm link is URL-validated before render so a malformed origin
 *     doesn't produce a phishing-friendly broken link.
 *   - Templates are designed to render in plain-text email clients: every
 *     CTA is restated as a plain URL beneath the styled button so a parent
 *     using a text-only client still sees the link.
 *
 * Three templates ship:
 *   - `vpc-first-confirmation`     — sent on /start; "click to confirm".
 *   - `vpc-second-confirmation-reminder` — optional follow-up after the 24h
 *      window opens. Not wired to a cron yet; the rendering exists so the
 *      design is reviewable and the unit tests can lock the contract.
 *   - `vpc-upgrade-complete`       — sent after /confirm-second succeeds.
 *
 * Reviewer note: the 24-hour delay is a COPPA contract (§312.5(b)(2)(ii)).
 * If you edit the copy, do NOT remove the "we'll be back tomorrow" framing
 * from `vpc-first-confirmation`. See docs/devops/email-setup.md.
 */

export type TemplateName =
  | 'vpc-first-confirmation'
  | 'vpc-second-confirmation-reminder'
  | 'vpc-upgrade-complete';

export interface TemplateData {
  /** Absolute URL the parent clicks to confirm; required for first/reminder. */
  confirmLink?: string;
  /** Parent's display nickname or "there" fallback. */
  parentNickname?: string;
  /** ISO timestamp at which second-confirm becomes available. */
  secondConfirmAvailableAt?: string;
  /** Email address verified — used in completion template. */
  verifiedEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidHttpUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return 'tomorrow';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'tomorrow';
  return d.toUTCString();
}

// ----------------------------------------------------------------------------
// Shared shell
// ----------------------------------------------------------------------------

interface ShellInput {
  preheader: string;
  bodyHtml: string;
  bodyText: string;
}

function renderShell({ preheader, bodyHtml, bodyText }: ShellInput): { html: string; text: string } {
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
                  If you didn't request this, you can ignore the message and nothing will change.
                </p>
                <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:8px 0 0 0;">
                  Privacy questions: <a href="mailto:privacy@english4kids.app" style="color:#0f3d3e;">privacy@english4kids.app</a>
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
English4Kids never asks for a child's name, email, or photo. We email parents only.
If you didn't request this, you can ignore the message and nothing will change.
Privacy questions: privacy@english4kids.app
`;

  return { html, text };
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

function renderFirstConfirmation(data: TemplateData): RenderedEmail {
  const nickname = data.parentNickname?.trim() ? data.parentNickname.trim() : 'there';
  const safeLink = data.confirmLink && isValidHttpUrl(data.confirmLink) ? data.confirmLink : '';
  if (!safeLink) {
    // Fail loudly in dev — a confirmation email without a link is useless.
    throw new Error('vpc-first-confirmation: confirmLink missing or invalid');
  }
  const escapedNickname = escapeHtml(nickname);
  const escapedLink = escapeHtml(safeLink);

  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${escapedNickname},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
      Someone (we hope you!) asked to back up your child's English4Kids progress to the cloud.
      Before we turn on syncing, we need you to confirm twice — once now, and once in 24 hours.
      That second wait is required by COPPA, the U.S. children's privacy law, so we know a real
      parent is on the other end.
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px 0;"><strong>Step 1 of 2:</strong> click the button below to confirm this email.</p>
    <p style="margin:0 0 24px 0;">
      <a href="${escapedLink}"
         style="display:inline-block;background-color:#0f3d3e;color:#ffffff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;">
        Confirm this email
      </a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0 0 16px 0;">
      Or paste this link into your browser:<br />
      <a href="${escapedLink}" style="color:#0f3d3e;word-break:break-all;">${escapedLink}</a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0;">
      We'll send a reminder around the same time tomorrow with the final confirmation step.
      Until then, your child's progress stays right where it is — on their device.
    </p>
  `;

  const bodyText = `Hi ${nickname},

Someone (we hope you!) asked to back up your child's English4Kids progress to the cloud.
Before we turn on syncing, we need you to confirm twice — once now, and once in 24 hours.
That second wait is required by COPPA, the U.S. children's privacy law.

Step 1 of 2: open this link to confirm this email.

${safeLink}

We'll send a reminder around the same time tomorrow with the final confirmation step.
Until then, your child's progress stays on their device.`;

  return {
    subject: 'Confirm your English4Kids parent account',
    ...renderShell({
      preheader: 'Confirm your email to start the 24-hour COPPA wait.',
      bodyHtml,
      bodyText,
    }),
  };
}

function renderSecondReminder(data: TemplateData): RenderedEmail {
  const nickname = data.parentNickname?.trim() ? data.parentNickname.trim() : 'there';
  const safeLink = data.confirmLink && isValidHttpUrl(data.confirmLink) ? data.confirmLink : '';
  if (!safeLink) {
    throw new Error('vpc-second-confirmation-reminder: confirmLink missing or invalid');
  }
  const escapedNickname = escapeHtml(nickname);
  const escapedLink = escapeHtml(safeLink);
  const availableAt = escapeHtml(formatTimestamp(data.secondConfirmAvailableAt));

  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${escapedNickname},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
      The 24-hour wait is over (as of ${availableAt} UTC). You can finish setting up cloud sync now.
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px 0;"><strong>Step 2 of 2:</strong> click below to finalize the upgrade.</p>
    <p style="margin:0 0 24px 0;">
      <a href="${escapedLink}"
         style="display:inline-block;background-color:#0f3d3e;color:#ffffff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;">
        Finish setup
      </a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0;">
      Or paste this link into your browser:<br />
      <a href="${escapedLink}" style="color:#0f3d3e;word-break:break-all;">${escapedLink}</a>
    </p>
  `;

  const bodyText = `Hi ${nickname},

The 24-hour wait is over (as of ${formatTimestamp(data.secondConfirmAvailableAt)} UTC).
You can finish setting up cloud sync now.

Step 2 of 2: open this link to finalize the upgrade.

${safeLink}`;

  return {
    subject: 'Ready to finish your English4Kids setup',
    ...renderShell({
      preheader: 'Your 24-hour wait is over — finish setting up cloud sync.',
      bodyHtml,
      bodyText,
    }),
  };
}

function renderUpgradeComplete(data: TemplateData): RenderedEmail {
  const nickname = data.parentNickname?.trim() ? data.parentNickname.trim() : 'there';
  const escapedNickname = escapeHtml(nickname);
  const escapedEmail = escapeHtml(data.verifiedEmail?.trim() || 'your email');

  const bodyHtml = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${escapedNickname},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
      Your account is upgraded. Cloud sync is now active for ${escapedEmail}, and your child's
      progress will back up automatically when this device is online.
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;">
      One last thing: you should have a separate email from Supabase asking you to verify the
      address itself. Click the link in that email to enable password reset later.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0;">
      You can review or revoke this consent anytime from the parent dashboard.
    </p>
  `;

  const bodyText = `Hi ${nickname},

Your account is upgraded. Cloud sync is now active for ${data.verifiedEmail?.trim() || 'your email'},
and your child's progress will back up automatically when this device is online.

One last thing: you should have a separate email from Supabase asking you to verify the
address itself. Click the link in that email to enable password reset later.

You can review or revoke this consent anytime from the parent dashboard.`;

  return {
    subject: 'Welcome to English4Kids cloud sync',
    ...renderShell({
      preheader: 'Cloud sync is on. One last email from Supabase to verify the address.',
      bodyHtml,
      bodyText,
    }),
  };
}

// ----------------------------------------------------------------------------
// Public entry
// ----------------------------------------------------------------------------

export function renderEmailTemplate(name: TemplateName, data: TemplateData): RenderedEmail {
  switch (name) {
    case 'vpc-first-confirmation':
      return renderFirstConfirmation(data);
    case 'vpc-second-confirmation-reminder':
      return renderSecondReminder(data);
    case 'vpc-upgrade-complete':
      return renderUpgradeComplete(data);
    default: {
      const exhaustive: never = name;
      throw new Error(`unknown email template: ${String(exhaustive)}`);
    }
  }
}
