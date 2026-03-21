# PDF assets for the marketing site

Export key visuals from your PDF and drop them in this folder. Then update the Image src paths in pages to point here.

Suggested assets and filenames:
- framework.png — The Precision Diagnostic Framework visual
- fractions.png — Fractions example (Comparing different denominators)
- mcq-insights.png — The Power of MCQs (each option reveals, tracking, hidden insights)
- heatmap.png — Class-level heatmaps of weaknesses
- case-arya-aakash.png — Case study visual (Averages to Achievers)

How to export (quick method):
1) Open the PDF in Preview (macOS) or any PDF tool.
2) Export/Save individual slides/pages as PNG at 2x or 3x for clarity.
3) Name files as above and place them into public/pdf-assets/.
4) Replace placeholder images in code:
   - src/app/page.tsx (Hero/framework sections)
   - src/app/product/page.tsx (framework, fractions sections)

Note: You can keep vector quality by exporting SVGs where possible, but PNGs are fine.
