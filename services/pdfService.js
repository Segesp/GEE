const puppeteer = require('puppeteer');

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserPromise;
}

async function renderHtmlToPdfBuffer(html, options = {}) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('HTML inválido para renderizar PDF.');
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });
    await page.emulateMediaType('screen');

    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      printBackground: options.printBackground !== false,
      margin: options.margin || { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
    });

    return pdfBuffer;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (error) {
      // ignore
    } finally {
      browserPromise = null;
    }
  }
}

module.exports = {
  renderHtmlToPdfBuffer,
  closeBrowser
};
