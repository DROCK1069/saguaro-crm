VENDOR LOGOS — drop official brand-kit files here
==================================================

The integrations strip (components/Integrations.tsx) loads each logo from this
folder by exact filename. Until a file exists, it shows a fallback mark, so the
site is never broken.

Save each vendor's OFFICIAL logo (PNG, transparent background, ~120px tall) as:

    public/vendors/quickbooks.png
    public/vendors/stripe.png
    public/vendors/xero.png
    public/vendors/sage.png
    public/vendors/docusign.png
    public/vendors/autodesk.png

Get the official assets from each vendor's brand / press / media kit
(these are the versions they license for "works with" usage — search
"<vendor> brand assets" or "<vendor> logo download / press kit"):

    QuickBooks (Intuit)  — Intuit brand / QuickBooks press kit
    Stripe               — stripe.com/newsroom/brand-assets
    Xero                 — xero.com brand / developer logo assets
    Sage                 — sage.com newsroom / brand
    DocuSign             — docusign.com newsroom / media resources
    Autodesk             — autodesk.com brand / press

Tip: prefer the full-color horizontal logo on a transparent background.
Drop the files in, redeploy, and they appear automatically — no code change.
