import { createFileRoute } from '@tanstack/react-router';
import { docHead } from '../components/DocPage.tsx';
import { WORKLOAD_TITLE, WorkloadPage } from '../components/Workload.tsx';
import { REAL } from '../data/real.ts';
import { REAL_ACCURACY } from '../data/real-accuracy.ts';
import { REAL_400_ACCURACY } from '../data/real-400-accuracy.ts';

export const Route = createFileRoute('/workload')({
  head: () => docHead('/workload', WORKLOAD_TITLE),
  component: () => <WorkloadPage file={REAL_ACCURACY} real={REAL} real400={REAL_400_ACCURACY} />,
});
