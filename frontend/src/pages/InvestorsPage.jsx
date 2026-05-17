import React from 'react';
import { ShieldCheck, Globe, Layers, FileCheck } from 'lucide-react';
import AudiencePage from '../components/AudiencePage.jsx';

const config = {
  eyebrow: 'For Institutional Investors',
  headline: 'Verified opportunities across the',
  headlineItalic: 'SADC region.',
  subhead:
    'Access bankable infrastructure, industrial and trade projects through a single, verified pipeline. Engage counterparties through secured deal rooms and act on real-time regional activity.',
  primaryCta: { label: 'Request Investor Access', href: '/login?mode=register' },
  secondaryCta: { label: 'View the Marketplace', href: '/#marketplace' },

  whyTitle: 'Institutional-grade access to regional capital opportunities.',
  valueProps: [
    {
      icon: <ShieldCheck size={22} />,
      title: 'Verified counterparties',
      body:
        'Every project sponsor, government entity and corporate participant on SAREGO undergoes KYC verification before listing.',
    },
    {
      icon: <Globe size={22} />,
      title: 'Regional pipeline visibility',
      body:
        'A single window into infrastructure, energy, mining, agriculture and industrial projects across the 16 SADC member states.',
    },
    {
      icon: <Layers size={22} />,
      title: 'Transparent diligence',
      body:
        'Confidential deal rooms with full document trails, member roles and access logging — built for institutional governance.',
    },
    {
      icon: <FileCheck size={22} />,
      title: 'Structured engagement',
      body:
        'Express interest, request information, and progress to deal rooms through standardised, auditable workflows.',
    },
  ],

  howTitle: 'From pipeline to deal room in three structured steps.',
  steps: [
    {
      title: 'Verify your institution.',
      body:
        'Complete KYC for your firm. Verified status unlocks access to project documents, deal rooms and direct counterparty engagement.',
    },
    {
      title: 'Browse the regional pipeline.',
      body:
        'Filter by country, sector, capital required and project stage. Each listing carries verification status and engagement metrics.',
    },
    {
      title: 'Engage through deal rooms.',
      body:
        'Express interest on bankable projects. Sponsors open confidential deal rooms for shortlisted investors with full document access and audit trails.',
    },
  ],

  feedAudience: 'investors',
  feedTitle: 'Latest opportunities',

  closingTitle: 'A single window into the SADC pipeline.',
  closingBody:
    'Join verified institutional investors already engaging with strategic projects across Southern Africa.',
};

export default function InvestorsPage() {
  return <AudiencePage config={config} />;
}
