export const APP_NAME = "App";

const INK = "#0b0f14";
const MUTED = "#5b6672";
const ACCENT = "#0e7c66";
const SURFACE = "#ffffff";
const CANVAS = "#f4f2ee";
const HAIRLINE = "#e4e0d9";

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailContent {
  /** Inbox preview line. Never rendered in the body. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  action?: EmailAction;
  footnote?: string;
}

export const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

const renderAction = (action: EmailAction): string => `
    <tr><td style="padding:8px 0 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${ACCENT}" style="border-radius:6px;">
          <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:13px 26px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(action.label)}</a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 0 0;font-size:13px;line-height:20px;color:${MUTED};">
      If the button doesn't work, paste this link into your browser:<br />
      <a href="${escapeHtml(action.url)}" style="color:${ACCENT};word-break:break-all;">${escapeHtml(action.url)}</a>
    </td></tr>`;

/** Table-based and fully inlined — Outlook and Gmail strip <style> blocks and flex. */
export const renderEmail = (content: EmailContent): string => {
  const { preheader, heading, paragraphs, action, footnote } = content;
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:17px;letter-spacing:0.14em;text-transform:uppercase;color:${INK};">${APP_NAME}</td></tr>
      <tr><td bgcolor="${SURFACE}" style="border:1px solid ${HAIRLINE};border-radius:10px;padding:36px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:${INK};">${escapeHtml(heading)}</td></tr>
          ${paragraphs
            .map(
              (text) =>
                `<tr><td style="padding:0 0 16px;font-family:${sans};font-size:15px;line-height:24px;color:${INK};">${escapeHtml(text)}</td></tr>`,
            )
            .join("\n          ")}
          ${action ? renderAction(action) : ""}
        </table>
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-family:${sans};font-size:12px;line-height:19px;color:${MUTED};">
        ${footnote ? `${escapeHtml(footnote)}<br /><br />` : ""}Sent by ${APP_NAME}. This is an automated message — replies aren't monitored.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
};

/** Plain-text alternative. Omitting it measurably hurts spam scoring. */
export const renderEmailText = (content: EmailContent): string =>
  [
    content.heading,
    "",
    ...content.paragraphs,
    content.action ? `\n${content.action.label}: ${content.action.url}` : "",
    content.footnote ? `\n${content.footnote}` : "",
    `\n— ${APP_NAME}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
