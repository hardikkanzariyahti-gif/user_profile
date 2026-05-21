const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 5000 }).catch(e => console.log('Goto Error:', e.message));
  
  console.log('Checked root');
  
  await page.goto('http://localhost:5173/gallery', { waitUntil: 'networkidle0', timeout: 5000 }).catch(e => console.log('Goto Error:', e.message));
  
  console.log('Checked gallery');
  
  await browser.close();
})();
