# Shivagami Crackers – POS Billing System

Offline POS for a crackers retail shop. HTML + CSS + vanilla JavaScript only.

## Run
Double-click `index.html` (any modern browser). Internet is needed once for the PDF library (jsPDF) and font.

## Folder
- index.html – app layout
- css/style.css – styles (includes print rules)
- js/app.js – storage, POS, cart, billing, PDF, admin, backup/restore

## Admin
Username `admin`, password `admin123` (demo only, not secure – no backend).

## Data
Products, bills, settings, bill counter and cart are kept in browser LocalStorage; product images in IndexedDB.
Use Admin > Backup Data regularly. Data is per browser/device.

## Deploy
Netlify: drag the folder onto app.netlify.com/drop.
GitHub Pages: push the folder to a repo > Settings > Pages > deploy from main branch.
