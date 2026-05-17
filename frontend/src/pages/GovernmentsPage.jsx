import React from 'react';
import { Building2, FileText, BarChart3, Users } from 'lucide-react';
import AudiencePage from '../components/AudiencePage.jsx';

const config = {
  eyebrow: 'For Governments & Agencies',
  headline: 'Publish strategic projects.',
  headlineItalic: 'Attract verified capital.',
  subhead:
    'Bring PPP pipelines, procurement notices and investment opportunities to a vetted institutional audience across SADC and the wider continent. Coordinate regional economic activity through a single platform.',
  primaryCta: { label: 'Onboard Your Agency', href: '/login?mode=register' },
  secondaryCta: { label: 'View Live Activity', href: '/#marketplace' },

  whyTitle: 'A coordinated layer for regional economic participation.',
  valueProps: [
    {
      icon: <Building2 size={22} />,
      title: 'Institutional reach',
      body:
        'Publish PPP pipelines, procurement opportunities and strategic projects to a vetted audience of verified investors and counterparties.',
    },
    {
      icon: <FileText size={22} />,
      title: 'Procurement transparency',
      body:
        'Tender references, issuing authority, submission deadlines and counterparty tracking — all on a single auditable platform.',
    },
    {
      icon: <BarChart3 size={22} />,
      title: 'Regional intelligence',
      body:
        'Monitor activity flows across SADC corridors and benchmark national project pipelines against regional peers.',
    },
    {
      icon: <Users size={22} />,
      title: 'Verified participation',
      body:
        'Engage exclusively with KYC-verified investors, contractors and suppliers. Trust tiers ensure institutional integrity.',
    },
  ],

  howTitle: 'A structured pathway for sovereign and agency-led projects.',
  steps: [
    {
      title: 'Onboard your agency.',
      body:
        'Verify your ministry, parastatal or development agency through institutional KYC. Verified status unlocks tender publication and pipeline tools.',
    },
    {
      title: 'Publish opportunities.',
      body:
        'Add PPP projects, procurement notices and investment opportunities to a unified regional pipeline. Set verification levels and engagement criteria.',
    },
    {
      title: 'Coordinate verified participation.',
      body:
        'Review counterparty interest, manage engagement through structured deal rooms, and monitor opportunity uptake across the region.',
    },
  ],

  feedAudience: 'governments',
  feedTitle: 'Live institutional activity',

  closingTitle: 'A platform for regional economic coordination.',
  closingBody:
    'Bring your strategic pipeline to the institutional audience that already engages with SADC opportunities.',
};

export default function GovernmentsPage() {
  return <AudiencePage config={config} />;
}
