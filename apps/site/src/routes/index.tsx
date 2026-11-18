import { createFileRoute } from '@tanstack/react-router';
import { EndBand } from '../components/home/EndBand.tsx';
import { Hero } from '../components/home/Hero.tsx';
import { JourneyRail } from '../components/home/JourneyRail.tsx';
import { KeepJson } from '../components/home/KeepJson.tsx';
import { StepAgent } from '../components/home/StepAgent.tsx';
import { StepAnatomy } from '../components/home/StepAnatomy.tsx';
import { StepBench } from '../components/home/StepBench.tsx';
import { StepCases } from '../components/home/StepCases.tsx';
import { StepConvert } from '../components/home/StepConvert.tsx';
import { StepKeys } from '../components/home/StepKeys.tsx';
import { StepPrompt } from '../components/home/StepPrompt.tsx';
import { StepRoundTrip } from '../components/home/StepRoundTrip.tsx';
import { homeJsonLd, homeMeta } from '../data/seo.ts';
import { canonicalHead } from '../data/site.ts';
import { useJourneyTracker } from '../lib/journey.ts';

function homeHead() {
  const canonical = canonicalHead('/');
  return { meta: [...homeMeta(), ...canonical.meta], links: canonical.links, scripts: homeJsonLd() };
}

export const Route = createFileRoute('/')({ head: homeHead, component: Home });

function Home() {
  useJourneyTracker('journey');
  return (
    <>
      <Hero />
      <div className="journey" id="journey">
        <JourneyRail />
        <div className="steps">
          <StepKeys />
          <StepConvert />
          <StepAnatomy />
          <StepCases />
          <StepRoundTrip />
          <StepBench />
          <StepPrompt />
          <StepAgent />
        </div>
      </div>
      <KeepJson />
      <EndBand />
    </>
  );
}
