import React from 'react';
import { Truck, Container, Repeat, MapPin } from 'lucide-react';
import AudiencePage from '../components/AudiencePage.jsx';

const config = {
  eyebrow: 'Cross-border Trade Infrastructure',
  headline: 'Connecting trade, capital and',
  headlineItalic: 'industrial growth.',
  subhead:
    'Commodity flows, manufacturing demand, logistics routes and trade finance — coordinated across the SADC region in a single live exchange. Suppliers, buyers, and transporters in one verified marketplace.',
  primaryCta: { label: 'Join the Exchange', href: '/login?mode=register' },
  secondaryCta: { label: 'Browse Live Opportunities', href: '/#marketplace' },

  whyTitle: 'The commercial layer of SADC economic infrastructure.',
  valueProps: [
    {
      icon: <Container size={22} />,
      title: 'Commodity flow visibility',
      body:
        'Live commodity requests, supply offers and offtake commitments across mining, agriculture, manufacturing and consumer goods.',
    },
    {
      icon: <Truck size={22} />,
      title: 'Regional logistics matching',
      body:
        'Active freight loads across SADC corridors. Match cargo with verified transporters on the routes that matter — Beitbridge, Walvis Bay, Beira, Maputo.',
    },
    {
      icon: <Repeat size={22} />,
      title: 'Integrated trade finance',
      body:
        'Connect commercial opportunities with trade finance providers. Verified counterparties and structured documentation enable faster transactions.',
    },
    {
      icon: <MapPin size={22} />,
      title: 'Corridor intelligence',
      body:
        'Real-time activity dashboards across eight major SADC trade corridors, with cargo, capital and counterparty flows monitored in one view.',
    },
  ],

  howTitle: 'A coordinated layer for cross-border B2B activity.',
  steps: [
    {
      title: 'Verify your business.',
      body:
        'Complete KYC for your trading house, manufacturing firm, transporter or trade finance institution. Verification level determines counterparty trust.',
    },
    {
      title: 'Post or browse opportunities.',
      body:
        'Publish commodity demand, offtake commitments or freight loads. Or browse live opportunities and act on those matching your trade lane and capacity.',
    },
    {
      title: 'Transact with verified partners.',
      body:
        'Engage counterparties through structured workflows. Track applicant interest, manage participation, and progress to documented commercial agreements.',
    },
  ],

  feedAudience: 'trade',
  feedTitle: 'Live trade activity',

  closingTitle: 'Where SADC commerce coordinates.',
  closingBody:
    'Join the verified trade infrastructure connecting suppliers, buyers, transporters and trade finance across Southern Africa.',
};

export default function TradeHubPage() {
  return <AudiencePage config={config} />;
}
