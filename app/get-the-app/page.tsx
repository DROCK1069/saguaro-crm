import type { Metadata } from 'next';
import { GetAppBadge } from '@/components/GetAppBadge';

export const metadata: Metadata = {
  title: 'Get Saguaro Field — Native iOS App | Now in TestFlight Beta',
  description:
    'Saguaro Field is a native iPhone & iPad app — now in open beta on TestFlight. GPS clock-in, daily logs, photos, RFIs, punch lists, offline mode, and an AI field assistant. Free during the beta.',
  keywords: [
    'construction field app',
    'iOS construction app',
    'TestFlight beta construction',
    'GPS clock in construction',
    'daily logs app',
    'construction mobile app',
  ],
  openGraph: {
    title: 'Saguaro Field — Native iOS App, Now in TestFlight Beta',
    description:
      'Native iPhone & iPad field app for construction crews. Works offline. Join the TestFlight beta free.',
  },
};

export default function GetTheAppPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --dark:   #FCF7EE;
          --page:   linear-gradient(180deg, #FCF7EE 0%, #F8EFDF 40%, #FBF2E3 70%, #F7ECDA 100%);
          --hero:   linear-gradient(160deg, #FFFBF2, #FDF3E2, #FBEAD2);
          --gold:   #C8881C;
          --text:   #2A1B06;
          --dim:    #6B5B43;
          --border: #F0E7D6;
          --raised: #FBF8F2;
          --card:   #FFFBF2;
          --card-shadow: 0 8px 26px rgba(120,80,20,0.09);
          --green:  #15803D;
          --gold-dim: rgba(200,136,28,0.12);
          --gold-glow: rgba(216,154,30,0.25);
        }

        body { background: var(--dark); }

        /* ── NAV ── */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          padding: 0 32px;
          height: 64px;
          background: rgba(255,251,242,0.85);
          backdrop-filter: blur(20px) saturate(150%);
          border-bottom: 1px solid var(--border);
        }
        .nav-logo { display: flex; align-items: center; text-decoration: none; }
        .nav-logo img { height: 40px;  }
        .nav-spacer { flex: 1; }
        .nav-login {
          color: var(--dim);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          margin-right: 20px;
          transition: color .2s;
        }
        .nav-login:hover { color: var(--text); }
        .nav-cta {
          background: linear-gradient(135deg, #E8B84B, #C98A1A);
          color: #2A1B06;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          padding: 9px 20px;
          border-radius: 8px;
          letter-spacing: .02em;
          box-shadow: 0 6px 18px rgba(201,138,26,0.28);
          transition: opacity .2s, transform .15s;
        }
        .nav-cta:hover { opacity: .9; transform: translateY(-1px); }

        /* ── PAGE ── */
        .page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          background: var(--page);
          color: var(--text);
          min-height: 100vh;
        }

        /* ── HERO ── */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: 100px 32px 80px;
          background: var(--hero);
          border-bottom: 1px solid var(--border);
        }
        .hero-bg-gold {
          position: absolute;
          bottom: -100px; left: -150px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(216,154,30,0.16) 0%, transparent 65%);
          pointer-events: none;
        }
        .hero-bg-blue {
          position: absolute;
          top: -80px; right: -100px;
          width: 600px; height: 600px;
          background: radial-gradient(circle at 80% 0%, rgba(216,154,30,0.12) 0%, transparent 65%);
          pointer-events: none;
        }
        .hero-inner {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
          position: relative;
          z-index: 1;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          border-radius: 100px;
          padding: 6px 16px;
          margin-bottom: 28px;
          font-size: 11px;
          font-weight: 700;
          color: var(--green);
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .hero-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--green);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(0.85)} }
        .hero-h1 {
          font-size: clamp(38px, 5vw, 64px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -.025em;
          margin-bottom: 24px;
          color: var(--text);
        }
        .hero-h1 .gold-gradient {
          background: linear-gradient(135deg, #D89A1E, #A86A0C);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 17px;
          font-weight: 400;
          color: var(--dim);
          line-height: 1.75;
          max-width: 480px;
          margin-bottom: 44px;
        }
        .hero-ctas {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #E8B84B, #C98A1A);
          color: #2A1B06;
          text-decoration: none;
          font-size: 15px;
          font-weight: 700;
          padding: 14px 28px;
          border-radius: 10px;
          letter-spacing: .01em;
          transition: opacity .2s, transform .15s, box-shadow .2s;
          box-shadow: 0 6px 18px rgba(201,138,26,0.28);
        }
        .btn-primary:hover { opacity: .92; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(201,138,26,0.42); }
        .btn-ghost {
          background: transparent;
          color: var(--text);
          text-decoration: none;
          font-size: 15px;
          font-weight: 600;
          padding: 14px 28px;
          border-radius: 10px;
          border: 1px solid var(--border);
          transition: border-color .2s, background .2s;
        }
        .btn-ghost:hover { border-color: var(--gold); background: rgba(245,158,11,0.06); }
        .trust-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .trust-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #FFFBF2, #FDF3E0);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: var(--dim);
        }

        /* ── DEVICE SHOWCASE ── */
        .devices {
          position: relative;
          height: 520px;
        }

        /* Phone */
        .dev-phone {
          position: absolute;
          right: 20px; top: 0;
          width: 168px; height: 360px;
          background: linear-gradient(160deg, #FFFFFF 0%, #FFFFFF 100%);
          border-radius: 38px;
          border: 2px solid rgba(0,0,0,0.12);
          box-shadow: 0 32px 72px rgba(0,0,0,0.6), inset 0 1px 0 rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.3);
          overflow: hidden;
          animation: floatPhone 5s ease-in-out infinite;
        }
        @keyframes floatPhone { 0%,100%{transform:translateY(0) rotate(3deg)} 50%{transform:translateY(-14px) rotate(3deg)} }
        .dev-phone::before {
          content:'';
          position:absolute;
          top:11px; left:50%;
          transform:translateX(-50%);
          width:52px; height:6px;
          background:#F2F2F7;
          border-radius:10px;
          z-index:10;
        }
        .dev-phone-screen {
          position:absolute;
          top:26px; left:6px; right:6px; bottom:6px;
          background: #F2F2F7;
          border-radius:32px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
        }
        .ps-bar {
          padding: 10px 14px 6px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          flex-shrink:0;
        }
        .ps-time { font-size:9px;font-weight:700;color:rgba(28,28,30,0.9); }
        .ps-header {
          background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08));
          border-bottom: 1px solid rgba(245,158,11,0.2);
          padding: 10px 12px;
          flex-shrink:0;
        }
        .ps-label { font-size:8px;color:rgba(245,158,11,0.7);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px; }
        .ps-big { font-size:20px;font-weight:800;color:#FCD34D;line-height:1; }
        .ps-small { font-size:7.5px;color:rgba(110,110,115,0.7);margin-top:2px; }
        .ps-body { padding:10px 12px;flex:1;overflow:hidden; }
        .ps-section { font-size:8px;color:rgba(110,110,115,0.7);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px; }
        .ps-row {
          display:flex;align-items:center;gap:8px;
          padding:6px 8px;border-radius:8px;
          background:rgba(0,0,0,0.04);
          margin-bottom:5px;
        }
        .ps-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
        .ps-row-text { flex:1; }
        .ps-row-name { font-size:8px;color:rgba(28,28,30,0.75); }
        .ps-row-sub { font-size:6.5px;color:rgba(110,110,115,0.7);margin-top:1px; }
        .ps-badge { padding:2px 6px;border-radius:4px;font-size:6.5px;font-weight:600; }
        .ps-badge-green { background:rgba(34,197,94,0.15);color:#22c55e; }
        .ps-badge-amber { background:rgba(245,158,11,0.15);color:#F59E0B; }
        .ps-nav {
          position:absolute;bottom:0;left:0;right:0;
          height:42px;
          background:rgba(255,255,255,0.96);
          border-top:1px solid rgba(0,0,0,0.06);
          display:flex;align-items:center;justify-content:space-around;
        }
        .ps-nav-i { width:16px;height:16px;stroke:rgba(110,110,115,0.7);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round; }
        .ps-nav-i.act { stroke:var(--gold); }

        /* Tablet */
        .dev-tablet {
          position:absolute;
          left:0; top:60px;
          width:268px; height:370px;
          background: linear-gradient(160deg, #FFFFFF 0%, #FFFFFF 100%);
          border-radius:20px;
          border:2px solid rgba(0,0,0,0.12);
          box-shadow: 0 32px 72px rgba(0,0,0,0.6), inset 0 1px 0 rgba(0,0,0,0.07);
          overflow:hidden;
          animation: floatTablet 5.5s ease-in-out infinite 0.4s;
        }
        @keyframes floatTablet { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-10px) rotate(-2deg)} }
        .dev-tablet-screen {
          position:absolute;
          top:8px;left:14px;right:14px;bottom:8px;
          background:#F2F2F7;
          border-radius:14px;
          overflow:hidden;
        }
        .ts-header {
          padding:10px 12px 8px;
          border-bottom:1px solid rgba(0,0,0,0.05);
          display:flex;align-items:center;justify-content:space-between;
        }
        .ts-logo { font-size:11px;font-weight:800;color:var(--gold);letter-spacing:.06em; }
        .ts-dots { display:flex;gap:4px; }
        .ts-dot { width:5px;height:5px;border-radius:50%; }
        .ts-body { padding:10px 12px; }
        .ts-greeting { font-size:8px;color:rgba(110,110,115,0.7);margin-bottom:1px; }
        .ts-title { font-size:11px;font-weight:700;color:var(--text);margin-bottom:10px; }
        .ts-grid { display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:9px; }
        .ts-card { border-radius:8px;padding:8px 9px; }
        .ts-card.c-gold { background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.25); }
        .ts-card.c-green { background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2); }
        .ts-card.c-blue { background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2); }
        .ts-card.c-purple { background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2); }
        .ts-card-n { font-size:14px;font-weight:800;line-height:1;margin-bottom:2px; }
        .c-gold .ts-card-n { color:#FCD34D; }
        .c-green .ts-card-n { color:#22c55e; }
        .c-blue .ts-card-n { color:#60a5fa; }
        .c-purple .ts-card-n { color:#a78bfa; }
        .ts-card-l { font-size:7px;color:rgba(110,110,115,0.7);text-transform:uppercase;letter-spacing:.06em; }
        .ts-bars-label { font-size:7px;color:rgba(110,110,115,0.7);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px; }
        .ts-bars { display:flex;align-items:flex-end;gap:4px;height:36px; }
        .ts-bar { flex:1;border-radius:3px 3px 0 0; }
        .ts-row { display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.04);font-size:8px; }
        .ts-row-name { color:rgba(28,28,30,0.6); }
        .ts-bge { padding:2px 6px;border-radius:4px;font-size:7px;font-weight:600; }
        .bg-gn { background:rgba(34,197,94,0.15);color:#22c55e; }
        .bg-am { background:rgba(245,158,11,0.15);color:#F59E0B; }
        .bg-bl { background:rgba(59,130,246,0.15);color:#60a5fa; }

        /* Laptop */
        .dev-laptop {
          position:absolute;
          bottom:0; left:10px; right:0;
          height:160px;
          animation: floatLaptop 6s ease-in-out infinite 1s;
        }
        @keyframes floatLaptop { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .dev-laptop-body {
          height:112px;
          background:linear-gradient(160deg,#FFFFFF,#FFFFFF);
          border-radius:10px 10px 0 0;
          border:2px solid rgba(0,0,0,0.12);
          border-bottom:none;
          padding:7px;
        }
        .dev-laptop-screen {
          width:100%;height:100%;
          background:#F2F2F7;
          border-radius:5px;
          overflow:hidden;
          display:flex;
        }
        .ls-sidebar {
          width:30%;
          background:rgba(245,158,11,0.04);
          border-right:1px solid rgba(0,0,0,0.05);
          padding:6px 4px;
        }
        .ls-logo { font-size:7px;font-weight:800;color:var(--gold);padding:0 3px;margin-bottom:7px; }
        .ls-item { padding:3px 5px;border-radius:4px;font-size:6px;color:rgba(110,110,115,0.7);margin-bottom:1px;display:flex;align-items:center;gap:3px; }
        .ls-item.act { background:rgba(245,158,11,0.15);color:var(--gold); }
        .ls-dot { width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.5; }
        .ls-main { flex:1;padding:7px 8px; }
        .ls-top { display:flex;justify-content:space-between;align-items:center;margin-bottom:5px; }
        .ls-title { font-size:8px;font-weight:700;color:var(--text); }
        .ls-badge { padding:2px 5px;border-radius:4px;font-size:5.5px;background:rgba(34,197,94,0.15);color:#22c55e; }
        .ls-cards { display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:4px; }
        .ls-card { border-radius:4px;padding:5px 6px; }
        .ls-card.lc1 { background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.2); }
        .ls-card.lc2 { background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.18); }
        .ls-card.lc3 { background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.18); }
        .ls-card.lc4 { background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.18); }
        .ls-card-n { font-size:9px;font-weight:800;line-height:1; }
        .lc1 .ls-card-n { color:#FCD34D; }
        .lc2 .ls-card-n { color:#22c55e; }
        .lc3 .ls-card-n { color:#60a5fa; }
        .lc4 .ls-card-n { color:#a78bfa; }
        .ls-card-l { font-size:5px;color:rgba(110,110,115,0.7);text-transform:uppercase;letter-spacing:.05em;margin-top:1px; }
        .ls-row { display:flex;gap:4px;padding:2.5px 0;border-bottom:1px solid rgba(0,0,0,0.04); }
        .ls-td { font-size:5.5px;color:rgba(110,110,115,0.7);flex:1; }
        .ls-td.bold { color:rgba(28,28,30,0.7); }
        .dev-laptop-hinge {
          height:10px;
          background:linear-gradient(160deg,#FFFFFF,#FFFFFF);
          border-left:2px solid rgba(0,0,0,0.1);
          border-right:2px solid rgba(0,0,0,0.1);
          border-bottom:2px solid rgba(0,0,0,0.08);
          border-radius:0 0 6px 6px;
          width:108%; margin-left:-4%;
        }
        .dev-laptop-base {
          height:7px;
          background:#F2F2F7;
          width:52%;
          margin:0 auto;
          border-radius:0 0 6px 6px;
          border:1px solid rgba(0,0,0,0.06);
          border-top:none;
        }

        /* ── NUMBERS BAR ── */
        .numbers-bar {
          background: linear-gradient(180deg,#FBF3E4,#F7EAD4);
          padding: 40px 32px;
        }
        .numbers-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 16px;
        }
        .stat-item {
          text-align: center;
          padding: 24px 16px;
        }
        .stat-number {
          font-size: clamp(32px, 4vw, 48px);
          font-weight: 800;
          background: linear-gradient(135deg, #D89A1E, #A86A0C);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          margin-bottom: 8px;
          letter-spacing: -.02em;
        }
        .stat-label {
          font-size: 13px;
          color: var(--dim);
          font-weight: 500;
        }

        /* ── SECTION HEADER ── */
        .section-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 32px;
        }
        .section-header {
          text-align: center;
          margin-bottom: 56px;
        }
        .section-h2 {
          font-size: clamp(28px, 3.5vw, 44px);
          font-weight: 800;
          letter-spacing: -.02em;
          color: var(--text);
          margin-bottom: 14px;
          line-height: 1.1;
        }
        .section-sub {
          font-size: 17px;
          color: var(--dim);
          line-height: 1.65;
          max-width: 560px;
          margin: 0 auto;
        }

        /* ── FEATURE GRID ── */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px 36px;
        }
        .feat-card {
          border-top: 1px solid rgba(176,122,18,0.16);
          padding: 24px 4px 0;
        }
        .feat-icon-wrap {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #E8B84B, #C98A1A);
          border: none;
          box-shadow: 0 6px 16px rgba(201,138,26,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .feat-icon-wrap svg {
          width: 20px; height: 20px;
          stroke: #FFFFFF;
          fill: none;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .feat-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }
        .feat-desc {
          font-size: 14px;
          color: var(--dim);
          line-height: 1.7;
          font-weight: 400;
        }

        /* ── HOW TO INSTALL ── */
        .install-section {
          background: linear-gradient(180deg,#FBF3E4,#F7EAD4);
        }
        .platform-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
        }
        .platform-card {
          border-top: 1px solid rgba(176,122,18,0.16);
          padding: 28px 4px 0;
        }
        .platform-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }
        .platform-icon {
          width: 48px; height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #E8B84B, #C98A1A);
          border: none;
          box-shadow: 0 6px 16px rgba(201,138,26,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .platform-icon svg {
          width: 24px; height: 24px;
          stroke: #FFFFFF;
          fill: none;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .platform-name {
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
        }
        .steps-list {
          list-style: none;
          margin-bottom: 20px;
        }
        .step-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .step-num {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--gold-dim);
          border: 1px solid rgba(245,158,11,0.3);
          color: var(--gold);
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .step-text {
          font-size: 14px;
          color: var(--dim);
          line-height: 1.6;
          padding-top: 3px;
        }
        .platform-note {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          color: var(--green);
          font-weight: 500;
        }
        .platform-note::before {
          content: '✓';
          font-weight: 700;
          font-size: 13px;
        }

        /* ── COMPARISON ── */
        .compare-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .compare-table thead tr { background: linear-gradient(135deg,#FFFBF2,#FDF3E0); }
        .compare-table th {
          padding: 16px 24px;
          font-size: 13px;
          font-weight: 700;
          color: var(--dim);
          text-align: left;
          border-bottom: 1px solid var(--border);
          letter-spacing: .03em;
          text-transform: uppercase;
        }
        .compare-table th.saguaro-col {
          background: rgba(245,158,11,0.08);
          color: var(--gold);
          border-left: 2px solid var(--gold);
        }
        .compare-table td {
          padding: 14px 24px;
          font-size: 14px;
          color: var(--dim);
          border-bottom: 1px solid rgba(229,229,234,0.5);
          background: var(--raised);
        }
        .compare-table tr:last-child td { border-bottom: none; }
        .compare-table td.feature-col {
          color: var(--text);
          font-weight: 500;
        }
        .compare-table td.app-store-col { color: #6E6E73; }
        .compare-table td.saguaro-col {
          background: rgba(245,158,11,0.05);
          color: var(--text);
          font-weight: 600;
          border-left: 2px solid rgba(245,158,11,0.3);
        }
        .compare-table tr:hover td.saguaro-col { background: rgba(245,158,11,0.09); }
        .compare-table td.bad { color: #f87171; }
        .compare-table td.good { color: var(--green); }

        /* ── TESTIMONIALS ── */
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px 36px;
        }
        .testi-card {
          border-top: 1px solid rgba(176,122,18,0.16);
          padding: 24px 4px 0;
        }
        .testi-quote {
          font-size: 15px;
          color: var(--text);
          line-height: 1.7;
          margin-bottom: 20px;
          font-style: italic;
        }
        .testi-author {
          font-size: 13px;
          color: var(--dim);
          font-weight: 600;
        }

        /* ── FINAL CTA ── */
        .final-cta {
          background: radial-gradient(ellipse at 50% 0%, #251608, #0E0B08);
          border-top: 1px solid var(--border);
        }
        .final-cta-inner {
          max-width: 700px;
          margin: 0 auto;
          padding: 100px 32px;
          text-align: center;
        }
        .final-h2 {
          font-size: clamp(28px, 4vw, 48px);
          font-weight: 800;
          color: #F5E9D6;
          letter-spacing: -.025em;
          margin-bottom: 36px;
          line-height: 1.1;
        }
        .final-sub {
          margin-top: 20px;
          font-size: 14px;
          color: #C9B79A;
        }
        .final-sub a {
          color: var(--gold);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .trust-note {
          margin-top: 28px;
          font-size: 13px;
          color: #C9B79A;
          line-height: 1.6;
        }

        /* ── FOOTER ── */
        .footer {
          background: #FBF8F2;
          border-top: 1px solid var(--border);
          padding: 48px 32px;
        }
        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 24px;
        }
        .footer-left { display:flex;align-items:center;gap:16px; }
        .footer-logo img { height:32px; }
        .footer-copy { font-size:13px;color:var(--dim); }
        .footer-links { display:flex;gap:24px;flex-wrap:wrap; }
        .footer-link {
          font-size:13px;
          color:var(--dim);
          text-decoration:none;
          transition:color .2s;
        }
        .footer-link:hover { color:var(--text); }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .numbers-inner { grid-template-columns: repeat(2,1fr); }
          .feature-grid { grid-template-columns: repeat(2,1fr); }
          .testimonials-grid { grid-template-columns: 1fr; gap: 14px; }
        }
        @media (max-width: 768px) {
          .nav { padding: 0 16px; }
          .hero { padding: 80px 16px 60px; }
          .hero-inner { grid-template-columns: 1fr; gap: 48px; }
          .devices { height: 340px; order: -1; }
          .dev-phone { right: 10px; top: 0; width: 136px; height: 292px; }
          .dev-tablet { width: 215px; height: 295px; top: 40px; }
          .dev-laptop { height: 130px; }
          .dev-laptop-body { height: 90px; }
          .numbers-bar { padding: 32px 16px; }
          .numbers-inner { grid-template-columns: repeat(2,1fr); }
          .section-wrap { padding: 56px 16px; }
          .feature-grid { grid-template-columns: 1fr; }
          .platform-grid { grid-template-columns: 1fr; }
          .compare-table th, .compare-table td { padding: 12px 14px; font-size: 13px; }
          .footer-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
          .hero-ctas { flex-direction: column; }
          .btn-primary, .btn-ghost { text-align: center; }
        }
        @media (max-width: 480px) {
          .numbers-inner { grid-template-columns: 1fr 1fr; }
          .stat-number { font-size: 28px; }
          .hero-h1 { font-size: 34px; }
          .devices { display: none; }
        }
      `}</style>

      <div className="page">

        {/* ── NAV ── */}
        <nav className="nav">
          <a href="/" className="nav-logo">
            <img src="/logo-horizontal.png" alt="Saguaro" height={40} style={{ }} />
          </a>
          <div className="nav-spacer" />
          <a href="/login" className="nav-login">Log In</a>
          <a href="/signup" className="nav-cta">Start Free Trial</a>
        </nav>

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-bg-gold" />
          <div className="hero-bg-blue" />
          <div className="hero-inner">

            {/* Copy */}
            <div>
              <div className="hero-badge">
                <div className="hero-badge-dot" />
                NOW IN BETA — TESTFLIGHT FOR iPHONE &amp; iPAD
              </div>

              <h1 className="hero-h1">
                The Field App That<br />
                <span className="gold-gradient">Actually Works on</span><br />
                Job Sites.
              </h1>

              <p className="hero-sub">
                GPS clock-in. Daily logs. Photos. RFIs. Punch lists. Offline mode. An AI field assistant in your pocket. A true native iPhone &amp; iPad app — now in open beta on TestFlight, free for your whole crew.
              </p>

              <div className="hero-ctas">
                <GetAppBadge />
                <a href="#how-to-install" className="btn-ghost">How to install</a>
              </div>

              <div className="trust-pills">
                <span className="trust-pill">✓ Native iPhone &amp; iPad</span>
                <span className="trust-pill">✓ Works Offline</span>
                <span className="trust-pill">✓ Live on TestFlight</span>
                <span className="trust-pill">✓ Free during beta</span>
              </div>
            </div>

            {/* Devices */}
            <div className="devices">

              {/* TABLET */}
              <div className="dev-tablet">
                <div className="dev-tablet-screen">
                  <div className="ts-header">
                    <span className="ts-logo">SAGUARO</span>
                    <div className="ts-dots">
                      <div className="ts-dot" style={{ background: '#f87171' }} />
                      <div className="ts-dot" style={{ background: '#fbbf24' }} />
                      <div className="ts-dot" style={{ background: '#22c55e' }} />
                    </div>
                  </div>
                  <div className="ts-body">
                    <div className="ts-greeting">Good morning, Jake</div>
                    <div className="ts-title">Field Dashboard</div>
                    <div className="ts-grid">
                      <div className="ts-card c-gold"><div className="ts-card-n">14</div><div className="ts-card-l">Crew Clocked In</div></div>
                      <div className="ts-card c-green"><div className="ts-card-n">100%</div><div className="ts-card-l">Logs Submitted</div></div>
                      <div className="ts-card c-blue"><div className="ts-card-n">3</div><div className="ts-card-l">Open RFIs</div></div>
                      <div className="ts-card c-purple"><div className="ts-card-n">7</div><div className="ts-card-l">Punch Items</div></div>
                    </div>
                    <div className="ts-bars-label">Daily Logs — This Week</div>
                    <div className="ts-bars" style={{ marginBottom: '8px' }}>
                      <div className="ts-bar" style={{ height:'60%', background:'rgba(245,158,11,0.6)', borderRadius:'3px 3px 0 0' }} />
                      <div className="ts-bar" style={{ height:'90%', background:'rgba(245,158,11,0.7)', borderRadius:'3px 3px 0 0' }} />
                      <div className="ts-bar" style={{ height:'75%', background:'rgba(245,158,11,0.6)', borderRadius:'3px 3px 0 0' }} />
                      <div className="ts-bar" style={{ height:'100%', background:'rgba(34,197,94,0.7)', borderRadius:'3px 3px 0 0' }} />
                      <div className="ts-bar" style={{ height:'85%', background:'rgba(34,197,94,0.6)', borderRadius:'3px 3px 0 0' }} />
                    </div>
                    <div className="ts-row"><span className="ts-row-name">Mesa Commerce — Phase 2</span><span className="ts-bge bg-gn">On Track</span></div>
                    <div className="ts-row"><span className="ts-row-name">Chandler Industrial</span><span className="ts-bge bg-am">Log Due</span></div>
                    <div className="ts-row"><span className="ts-row-name">Scottsdale Medical</span><span className="ts-bge bg-bl">RFI Pending</span></div>
                  </div>
                </div>
              </div>

              {/* PHONE */}
              <div className="dev-phone">
                <div className="dev-phone-screen">
                  <div className="ps-bar">
                    <span className="ps-time">9:41</span>
                    <span style={{ fontSize:'8px', color:'rgba(28,28,30,0.5)' }}>●●●</span>
                  </div>
                  <div className="ps-header">
                    <div className="ps-label">GPS Clock-In</div>
                    <div className="ps-big">Clocked In</div>
                    <div className="ps-small">7:02 AM · Mesa Commerce Center</div>
                  </div>
                  <div className="ps-body">
                    <div className="ps-section">Today&apos;s Crew</div>
                    <div className="ps-row">
                      <div className="ps-dot" style={{ background: '#22c55e' }} />
                      <div className="ps-row-text">
                        <div className="ps-row-name">Mike R.</div>
                        <div className="ps-row-sub">In · 6:58 AM</div>
                      </div>
                      <span className="ps-badge ps-badge-green">GPS ✓</span>
                    </div>
                    <div className="ps-row">
                      <div className="ps-dot" style={{ background: '#22c55e' }} />
                      <div className="ps-row-text">
                        <div className="ps-row-name">Sofia M.</div>
                        <div className="ps-row-sub">In · 7:01 AM</div>
                      </div>
                      <span className="ps-badge ps-badge-green">GPS ✓</span>
                    </div>
                    <div className="ps-row">
                      <div className="ps-dot" style={{ background: '#F59E0B' }} />
                      <div className="ps-row-text">
                        <div className="ps-row-name">Daily Log</div>
                        <div className="ps-row-sub">3 photos · submitted</div>
                      </div>
                      <span className="ps-badge ps-badge-amber">Done</span>
                    </div>
                  </div>
                  <div className="ps-nav">
                    <svg className="ps-nav-i act" viewBox="0 0 16 16"><path d="M2 6l6-4 6 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" /></svg>
                    <svg className="ps-nav-i" viewBox="0 0 16 16"><circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                    <svg className="ps-nav-i" viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /></svg>
                    <svg className="ps-nav-i" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" /></svg>
                  </div>
                </div>
              </div>

              {/* LAPTOP */}
              <div className="dev-laptop">
                <div className="dev-laptop-body">
                  <div className="dev-laptop-screen">
                    <div className="ls-sidebar">
                      <div className="ls-logo">SAGUARO</div>
                      <div className="ls-item act"><div className="ls-dot" />Dashboard</div>
                      <div className="ls-item"><div className="ls-dot" />Field Logs</div>
                      <div className="ls-item"><div className="ls-dot" />Punch Lists</div>
                      <div className="ls-item"><div className="ls-dot" />RFIs</div>
                      <div className="ls-item"><div className="ls-dot" />Sage AI</div>
                    </div>
                    <div className="ls-main">
                      <div className="ls-top"><span className="ls-title">Dashboard</span><span className="ls-badge">Live</span></div>
                      <div className="ls-cards">
                        <div className="ls-card lc1"><div className="ls-card-n">14</div><div className="ls-card-l">On Site</div></div>
                        <div className="ls-card lc2"><div className="ls-card-n">100%</div><div className="ls-card-l">Logs In</div></div>
                        <div className="ls-card lc3"><div className="ls-card-n">3</div><div className="ls-card-l">RFIs</div></div>
                        <div className="ls-card lc4"><div className="ls-card-n">7</div><div className="ls-card-l">Punch</div></div>
                      </div>
                      <div className="ls-row"><div className="ls-td bold">Mesa Commerce</div><div className="ls-td" style={{ color:'#22c55e' }}>On Track</div></div>
                      <div className="ls-row"><div className="ls-td bold">Chandler Ind.</div><div className="ls-td" style={{ color:'#F59E0B' }}>Log Due</div></div>
                    </div>
                  </div>
                </div>
                <div className="dev-laptop-hinge" />
                <div className="dev-laptop-base" />
              </div>

            </div>
          </div>
        </section>

        {/* ── NUMBERS BAR ── */}
        <div className="numbers-bar">
          <div className="numbers-inner">
            <div className="stat-item">
              <div className="stat-number">iOS</div>
              <div className="stat-label">Native iPhone &amp; iPad</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">100%</div>
              <div className="stat-label">Works offline</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">Beta</div>
              <div className="stat-label">Live on TestFlight now</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">Free</div>
              <div className="stat-label">During the beta</div>
            </div>
          </div>
        </div>

        {/* ── WHAT'S INCLUDED ── */}
        <div className="section-wrap">
          <div className="section-header">
            <h2 className="section-h2">Everything Your Crew Needs on Site</h2>
            <p className="section-sub">Six tools that replace the clipboard, the group text, and the Friday timesheet chase — all in one app that installs in 30 seconds.</p>
          </div>

          <div className="feature-grid">
            <div className="feat-card">
              <div className="feat-icon-wrap">
                <svg viewBox="0 0 20 20"><path d="M10 2a5 5 0 100 10A5 5 0 0010 2zm0 7a2 2 0 110-4 2 2 0 010 4z" /><path d="M10 12v6M7 16h6" /></svg>
              </div>
              <div className="feat-title">GPS Clock-In</div>
              <p className="feat-desc">Crew taps once. Location verified. Time stamped. No paper timesheets. Syncs to payroll automatically.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon-wrap">
                <svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 9h6M7 13h4" /></svg>
              </div>
              <div className="feat-title">Daily Logs</div>
              <p className="feat-desc">Photo + notes in 60 seconds. Auto-dated, job-stamped, searchable forever. Your office sees it instantly.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon-wrap">
                <svg viewBox="0 0 20 20"><path d="M5 10l4 4 6-7" /><circle cx="10" cy="10" r="8" /></svg>
              </div>
              <div className="feat-title">Punch Lists</div>
              <p className="feat-desc">Create, assign, and resolve punch list items from the field. Attach photos, set due dates, notify subs.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon-wrap">
                <svg viewBox="0 0 20 20"><path d="M3 6l7-3 7 3v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /><path d="M8 17v-6h4v6" /></svg>
              </div>
              <div className="feat-title">AI Field Assistant (Sage)</div>
              <p className="feat-desc">Ask Sage anything: &quot;Where&apos;s the approved RFI for door 201?&quot; She finds it. Draft RFIs by photo — snap a problem, Sage writes the RFI.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon-wrap">
                <svg viewBox="0 0 20 20"><path d="M2 10a8 8 0 1016 0A8 8 0 002 10z" /><path d="M10 6v4l3 3" /><path d="M6 2l-2-2M14 2l2-2" /></svg>
              </div>
              <div className="feat-title">Works Completely Offline</div>
              <p className="feat-desc">Signal dead on site? Keeps working. Daily logs, photos, clock-ins — everything queues and syncs the moment you&apos;re back online.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon-wrap">
                <svg viewBox="0 0 20 20"><path d="M4 4h12v8H4z" /><path d="M8 16h4M10 12v4" /><path d="M7 8l2 2 4-4" /></svg>
              </div>
              <div className="feat-title">RFIs + Inspections</div>
              <p className="feat-desc">Submit RFIs from the field with photos. Run inspection checklists. Get instant notifications when responses come back.</p>
            </div>
          </div>
        </div>

        {/* ── HOW TO INSTALL ── */}
        <section className="install-section" id="how-to-install">
          <div className="section-wrap">
            <div className="section-header">
              <h2 className="section-h2">Install on iPhone or iPad via TestFlight</h2>
              <p className="section-sub">Saguaro Field is in open beta on TestFlight. Two minutes and it&apos;s on your phone.</p>
            </div>

            <div className="platform-grid">

              {/* iPhone / iPad — TestFlight steps */}
              <div className="platform-card">
                <div className="platform-header">
                  <div className="platform-icon">
                    <svg viewBox="0 0 24 24">
                      <rect x="5" y="1" width="14" height="22" rx="3" />
                      <circle cx="12" cy="19.5" r="1" fill="#FFFFFF" stroke="none" />
                      <path d="M9 4h6" />
                    </svg>
                  </div>
                  <div className="platform-name">iPhone &amp; iPad</div>
                </div>
                <ol className="steps-list">
                  <li className="step-item"><div className="step-num">1</div><span className="step-text">Install Apple&apos;s free <strong>TestFlight</strong> app from the App Store</span></li>
                  <li className="step-item"><div className="step-num">2</div><span className="step-text">Open <strong>testflight.apple.com/join/jg7jdtwx</strong> on your iPhone</span></li>
                  <li className="step-item"><div className="step-num">3</div><span className="step-text">Tap <strong>&quot;Install&quot;</strong> in TestFlight — Saguaro Field lands on your home screen</span></li>
                  <li className="step-item"><div className="step-num">4</div><span className="step-text">Open it, sign in, and you&apos;re on the jobsite</span></li>
                </ol>
                <div className="platform-note">iOS 15+ · iPhone &amp; iPad · Free during the beta</div>
              </div>

              {/* Join CTA */}
              <div className="platform-card">
                <div className="platform-header">
                  <div className="platform-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 3v12" />
                      <path d="M8 11l4 4 4-4" />
                      <rect x="4" y="17" width="16" height="4" rx="1" />
                    </svg>
                  </div>
                  <div className="platform-name">Join the beta now</div>
                </div>
                <p className="feat-desc" style={{ marginBottom: 20 }}>Saguaro Field is in open beta on TestFlight. Tap below on your iPhone or iPad to get in — it&apos;s free while we&apos;re in beta.</p>
                <a href="https://testflight.apple.com/join/jg7jdtwx" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block' }}>Join the iOS Beta →</a>
                <div className="platform-note" style={{ marginTop: 16 }}>Public TestFlight link · No charge</div>
              </div>

            </div>
          </div>
        </section>

        {/* (Removed the PWA-vs-App-Store comparison — Saguaro Field is now a native iOS app on TestFlight.) */}

        {/* ── BUILT FOR THE FIELD ── */}
        <div style={{ background: 'linear-gradient(180deg,#FBF3E4,#F7EAD4)' }}>
          <div className="section-wrap">
            <div className="section-header">
              <h2 className="section-h2">Built for the Job Site</h2>
              <p className="section-sub">Designed around how superintendents and foremen actually work in the field.</p>
            </div>

            <div className="testimonials-grid">
              <div className="testi-card">
                <p className="testi-quote">Get a whole crew onto the beta in minutes — just text them the TestFlight link. GPS clock-in is built to end the Friday timesheet chase.</p>
                <div className="testi-author">Fast crew onboarding · GPS clock-in</div>
              </div>
              <div className="testi-card">
                <p className="testi-quote">Full offline mode is built for basements and dead zones. The app keeps working with no signal and syncs everything the moment you reconnect — so nothing is lost.</p>
                <div className="testi-author">Works offline · Automatic sync</div>
              </div>
              <div className="testi-card">
                <p className="testi-quote">Foremen submit daily logs and photos before they leave the site. No more chasing paperwork on Fridays — the office sees it instantly.</p>
                <div className="testi-author">Daily logs · Real-time office visibility</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FINAL CTA ── */}
        <section className="final-cta">
          <div className="final-cta-inner">
            <h2 className="final-h2">30 Seconds Away From a Better Job Site</h2>
            <a href="https://testflight.apple.com/join/jg7jdtwx" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block', fontSize: '17px', padding: '18px 40px' }}>
              Join the iOS Beta →
            </a>
            <div className="final-sub">
              Or <a href="/signup">start a full company trial →</a>
            </div>
            <div className="trust-note">
              Your crew gets the app free during the beta. Managers get the full platform free for 30 days.<br />
              No credit card required.
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-left">
              <div className="footer-logo">
                <img src="/logo-horizontal.png" alt="Saguaro" height={32} style={{ }} />
              </div>
              <span className="footer-copy">© {new Date().getFullYear()} Saguaro Control. All rights reserved.</span>
            </div>
            <div className="footer-links">
              <a href="/pricing" className="footer-link">Pricing</a>
              <a href="/get-the-app" className="footer-link">Field App</a>
              <a href="/compare/procore" className="footer-link">vs Procore</a>
              <a href="/privacy" className="footer-link">Privacy</a>
              <a href="/terms" className="footer-link">Terms</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
