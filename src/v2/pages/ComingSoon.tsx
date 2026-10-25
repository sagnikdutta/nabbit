import { V2Shell } from '../V2Shell';
import { V2Button, V2Panel } from '../components/primitives';
import { useV2Theme } from '../useTheme';
import { useV2ShellStats } from '../useShellData';
import './pages.css';

/*
 * Explicit "coming soon" treatment for nav items that don't have a real page
 * yet (Achievements, Settings). Lists what's planned so the stub is honest
 * instead of silently bouncing back to the dashboard.
 */

const COPY: Record<'Achievements' | 'Settings', { title: string; blurb: string; planned: string[] }> = {
  Achievements: {
    title: 'Achievements',
    blurb: 'Badges for streaks, mastered concepts and boss drills will live here.',
    planned: [
      'Streak badges (3, 7, 30 days)',
      'Concept mastery badges tied to your Elo buckets',
      'Boss drill and season placements',
      'Shareable badge cards',
    ],
  },
  Settings: {
    title: 'Settings',
    blurb: 'Account and preference controls are on the way.',
    planned: [
      'Display name and email',
      'Recall reminder schedule',
      'Default drill format and difficulty',
      'Export or reset your local progress',
    ],
  },
};

export default function V2ComingSoonPage({ page }: { page: 'Achievements' | 'Settings' }) {
  const [theme, toggleTheme] = useV2Theme();
  const shell = useV2ShellStats();
  const copy = COPY[page];
  return (
    <V2Shell
      activeNav={page}
      theme={theme}
      onToggleTheme={toggleTheme}
      showSearch={false}
      streak={shell.streak}
      xp={shell.xp}
      level={shell.level}
      xpProgress={shell.xpProgress}
    >
      <div className="v2-simple-page">
        <header className="v2-simple-head">
          <h1>{copy.title}</h1>
        </header>
        <V2Panel>
          <div className="v2-soon">
            <span className="v2-soon-badge">Coming soon</span>
            <p className="v2-simple-sub">{copy.blurb}</p>
            <ul>
              {copy.planned.map(p => <li key={p}>{p}</li>)}
            </ul>
            <V2Button variant="secondary" size="lg" href="/v2/">Back to dashboard</V2Button>
          </div>
        </V2Panel>
      </div>
    </V2Shell>
  );
}
