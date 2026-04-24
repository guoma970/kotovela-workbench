import { chromium } from 'playwright';
import path from 'path';
import { resolveBaseUrl } from './shared/base-url.mjs';

const BASE_URL = resolveBaseUrl({ envNames: ['WORKBENCH_BASE_URL', 'CAPTURE_BASE_URL', 'STAB_BASE_URL'] });
const OUTPUT_DIR = path.join(process.cwd(), 'public/screenshots');

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();

  const routes = [
    { path: '/', filename: 'dashboard.png' },
    { path: '/agents', filename: 'agents.png' },
    { path: '/tasks', filename: 'tasks.png' },
    { path: '/projects', filename: 'projects.png' },
    { path: '/rooms', filename: 'rooms.png' },
  ];

  for (const route of routes) {
    console.log(`Capturing ${route.filename}...`);
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ 
      path: path.join(OUTPUT_DIR, route.filename),
      fullPage: true 
    });
  }

  // Cover image - dashboard with larger viewport for visual impact
  console.log('Capturing cover.png...');
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ 
    path: path.join(OUTPUT_DIR, 'cover.png'),
    fullPage: false 
  });

  // Overview - system structure diagram
  // Since there's no dedicated page, we'll create a diagram using SVG/canvas
  console.log('Creating overview.png...');
  await page.setViewportSize({ width: 1200, height: 630 });
  
  // Inject a diagram into the page
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  
  // Create system architecture diagram as SVG
  const diagramSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
        <linearGradient id="box" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#4a5568"/>
          <stop offset="100%" style="stop-color:#2d3748"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Title -->
      <text x="600" y="60" font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="#e2e8f0" text-anchor="middle">Kotovela Workbench - System Architecture</text>
      
      <!-- Flow arrows and boxes -->
      <g transform="translate(200, 120)">
        <!-- Dashboard -->
        <rect x="0" y="0" width="140" height="60" rx="8" fill="#4f46e5"/>
        <text x="70" y="35" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">Dashboard</text>
        
        <!-- Arrow to Projects -->
        <line x1="70" y1="60" x2="70" y2="100" stroke="#94a3b8" stroke-width="2"/>
        <polygon points="70,105 65,95 75,95" fill="#94a3b8"/>
        
        <!-- Projects -->
        <rect x="0" y="105" width="140" height="60" rx="8" fill="url(#box)" stroke="#6366f1" stroke-width="2"/>
        <text x="70" y="140" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#e2e8f0" text-anchor="middle">Projects</text>
        
        <!-- Arrow to Rooms -->
        <line x1="70" y1="165" x2="70" y2="205" stroke="#94a3b8" stroke-width="2"/>
        <polygon points="70,210 65,200 75,200" fill="#94a3b8"/>
        
        <!-- Rooms -->
        <rect x="0" y="210" width="140" height="60" rx="8" fill="url(#box)" stroke="#6366f1" stroke-width="2"/>
        <text x="70" y="245" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#e2e8f0" text-anchor="middle">Rooms</text>
      </g>
      
      <!-- Vertical arrow from Rooms to Tasks -->
      <line x1="270" y1="240" x2="340" y2="240" stroke="#94a3b8" stroke-width="2"/>
      <polygon points="345,240 335,235 335,245" fill="#94a3b8"/>
      
      <!-- Tasks (right side) -->
      <g transform="translate(340, 210)">
        <rect x="0" y="0" width="140" height="60" rx="8" fill="url(#box)" stroke="#6366f1" stroke-width="2"/>
        <text x="70" y="35" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#e2e8f0" text-anchor="middle">Tasks</text>
        
        <!-- Arrow down -->
        <line x1="70" y1="60" x2="70" y2="100" stroke="#94a3b8" stroke-width="2"/>
        <polygon points="70,105 65,95 75,95" fill="#94a3b8"/>
        
        <!-- Agents -->
        <rect x="0" y="105" width="140" height="60" rx="8" fill="#0891b2"/>
        <text x="70" y="140" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">Agents</text>
      </g>
      
      <!-- Side annotations -->
      <g transform="translate(800, 120)">
        <text x="0" y="0" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">Key Features:</text>
        <text x="0" y="30" font-family="system-ui, sans-serif" font-size="13" fill="#cbd5e1">• Multi-project management</text>
        <text x="0" y="55" font-family="system-ui, sans-serif" font-size="13" fill="#cbd5e1">• Collaborative rooms</text>
        <text x="0" y="80" font-family="system-ui, sans-serif" font-size="13" fill="#cbd5e1">• Task assignment & tracking</text>
        <text x="0" y="105" font-family="system-ui, sans-serif" font-size="13" fill="#cbd5e1">• AI agent integration</text>
      </g>
    </svg>
  `;
  
  // Set content as overview.png via data URL
  await page.setContent(`<html><body style="margin:0;padding:0;background:#1a1a2e;">${diagramSvg}</body></html>`);
  await page.screenshot({ 
    path: path.join(OUTPUT_DIR, 'overview.png'),
    fullPage: false 
  });

  await browser.close();
  console.log('All screenshots captured!');
}

captureScreenshots().catch(console.error);
