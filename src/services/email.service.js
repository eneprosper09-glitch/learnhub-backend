import { env } from '../config/env.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const send = async ({ to, subject, html }) => {
  if (!env.brevoApiKey) {
    console.warn(`Brevo API key not set. Skipping email to ${to} with subject "${subject}"`);
    return;
  }
  if (!env.emailFrom) {
    console.warn('EMAIL_FROM not set. Skipping email.');
    return;
  }

  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': env.brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'LearnHub', email: env.emailFrom },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Brevo send failed: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error(`Failed to send email to ${to}: ${err.message}`);
  }
};

export const sendVerificationEmail = async (to, name, token) => {
  const url = `${env.frontendUrl}/verify-email?token=${token}`;
  await send({
    to,
    subject: 'Verify your LearnHub account',
    html: `
      <h2>Hi ${name},</h2>
      <p>Welcome to LearnHub. Please verify your email by clicking the link below.</p>
      <p><a href="${url}">Verify my email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (to, name, token) => {
  const url = `${env.frontendUrl}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your LearnHub password',
    html: `
      <h2>Hi ${name},</h2>
      <p>We received a request to reset your password. Click the link below to set a new one.</p>
      <p><a href="${url}">Reset my password</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `,
  });
};

export const sendAdminInvitationEmail = async (to, invitedByName, token) => {
  const url = `${env.frontendUrl}/admin-invite?token=${token}`;
  await send({
    to,
    subject: 'You are invited to become an Admin on LearnHub',
    html: `
      <h2>Admin invitation</h2>
      <p>${invitedByName} has invited you to become an admin on LearnHub.</p>
      <p><a href="${url}">Accept invitation</a></p>
      <p>This invitation expires in 7 days.</p>
    `,
  });
};