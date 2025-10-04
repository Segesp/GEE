const sgMail = require('@sendgrid/mail');

const runtimeFetch = typeof fetch === 'function'
  ? fetch
  : async (...args) => {
      const { default: fetchFn } = await import('node-fetch');
      return fetchFn(...args);
    };

let sendGridConfigured = false;
let lastConfiguredApiKey = null;

function getLogger(logger) {
  if (logger && typeof logger === 'object') {
    return {
      info: logger.info ? logger.info.bind(logger) : console.log.bind(console),
      warn: logger.warn ? logger.warn.bind(logger) : console.warn.bind(console),
      error: logger.error ? logger.error.bind(logger) : console.error.bind(console)
    };
  }
  return {
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
}

function configureSendGrid(apiKey, logger) {
  if (!apiKey) {
    return false;
  }

  if (!sendGridConfigured || lastConfiguredApiKey !== apiKey) {
    try {
      sgMail.setApiKey(apiKey);
      sendGridConfigured = true;
      lastConfiguredApiKey = apiKey;
    } catch (error) {
      getLogger(logger).error('[notifications] No se pudo configurar SendGrid:', error.message);
      sendGridConfigured = false;
      lastConfiguredApiKey = null;
      throw error;
    }
  }

  return sendGridConfigured;
}

function normalizeRecipients(recipients) {
  if (!recipients) {
    return [];
  }

  if (typeof recipients === 'string') {
    return recipients
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
  }

  if (Array.isArray(recipients)) {
    return recipients
      .map((email) => (typeof email === 'string' ? email.trim() : null))
      .filter(Boolean);
  }

  return [];
}

async function sendEmailNotification({
  subject,
  html,
  text,
  recipients,
  cc,
  bcc,
  from,
  fromName,
  apiKey,
  logger
}) {
  const log = getLogger(logger);
  const toList = normalizeRecipients(recipients);

  if (!toList.length) {
    log.warn('[notifications] Email omitido: no hay destinatarios.');
    return { status: 'skipped', reason: 'no-recipients' };
  }

  if (!from) {
    log.warn('[notifications] Email omitido: no hay remitente configurado.');
    return { status: 'skipped', reason: 'missing-from' };
  }

  if (!apiKey) {
    log.warn('[notifications] Email omitido: falta SENDGRID_API_KEY.');
    return { status: 'skipped', reason: 'missing-api-key' };
  }

  try {
    configureSendGrid(apiKey, log);

    const message = {
      to: toList,
      from: fromName ? { email: from, name: fromName } : from,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ')
    };

    const ccList = normalizeRecipients(cc);
    const bccList = normalizeRecipients(bcc);

    if (ccList.length) {
      message.cc = ccList;
    }

    if (bccList.length) {
      message.bcc = bccList;
    }

    await sgMail.send(message);
    log.info('[notifications] Email enviado a', toList.join(', '));
    return { status: 'sent', recipients: toList };
  } catch (error) {
    log.error('[notifications] Error enviando email:', error.message);
    return { status: 'error', error: error.message };
  }
}

async function sendSlackNotification({ webhookUrl, payload, logger }) {
  const log = getLogger(logger);

  if (!webhookUrl) {
    log.warn('[notifications] Slack omitido: falta webhook.');
    return { status: 'skipped', reason: 'missing-webhook' };
  }

  try {
    const body = typeof payload === 'string' ? { text: payload } : payload;
  const response = await runtimeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack respondió ${response.status}: ${text}`);
    }

    log.info('[notifications] Mensaje de Slack enviado.');
    return { status: 'sent' };
  } catch (error) {
    log.error('[notifications] Error enviando a Slack:', error.message);
    return { status: 'error', error: error.message };
  }
}

module.exports = {
  sendEmailNotification,
  sendSlackNotification
};
