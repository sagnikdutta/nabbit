import { useMemo, useState } from 'react';
import { V2Shell } from '../V2Shell';
import { V2Button, V2Chip, V2Progress } from '../components/primitives';
import { useV2Theme } from '../useTheme';
import { useV2Library } from '../useLibrary';
import { api } from '../../lib/api';
import type { Video } from '../../lib/types';
import './pages.css';

/*
 * V2 My Library — every video with per-video progress. Search matches title,
 * channel, stack and concept tags; the filter chips split by progress state.
 * Cards jump to the next unsolved drill.
 */

type Filter = 'All' | 'Not started' | 'In progress' | 'Completed';
const FILTERS: Filter[] = ['All', 'Not started', 'In progress', 'Completed'];

export default function V2LibraryPage() {
  const [theme, toggleTheme] = useV2Theme();
  const { loading, cards, shell, reload } = useV2Library();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const handleRemove = async (video: Video) => {
    const ok = window.confirm(`Remove "${video.title}" from your library?\n\nThis also deletes any attempts and recall items tied to its drills. This cannot be undone.`);
    if (!ok) return;
    const { removed } = await api.removeCustomPack(video.id);
    if (removed) {
      await reload();
    } else {
      window.alert("Couldn't remove that video — built-in videos aren't removable.");
    }
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards
      .filter(c => {
        if (filter === 'Not started' && c.drillsDone > 0) return false;
        if (filter === 'In progress' && !(c.drillsDone > 0 && c.drillsDone < c.drillsTotal)) return false;
        if (filter === 'Completed' && c.drillsDone < c.drillsTotal) return false;
        if (!q) return true;
        return `${c.video.title} ${c.video.channel} ${c.video.stack} ${c.tags.join(' ')}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
  }, [cards, search, filter]);

  return (
    <V2Shell
      activeNav="My Library"
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
          <h1>My Library</h1>
          {!loading && <span className="count">{cards.length}</span>}
          <div className="spacer" />
          <V2Button size="lg" href="/v2/import">+ Import video</V2Button>
        </header>

        <div className="v2-lib-toolbar">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search videos, channels or concepts…"
            aria-label="Search library"
          />
          <div className="v2-lib-filters" role="group" aria-label="Filter by progress">
            {FILTERS.map(f => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="v2-simple-empty">Loading your library…</div>
        ) : shown.length === 0 ? (
          <div className="v2-simple-empty">
            {cards.length === 0 ? 'No videos yet — import one to get started.' : 'No videos match this view.'}
          </div>
        ) : (
          <div className="v2-lib-grid">
            {shown.map(c => (
              <div key={c.video.id} style={{ position: 'relative' }}>
                <a
                  className="v2-lib-card"
                  href={c.nextChallengeId ? `/v2/challenge/${encodeURIComponent(c.nextChallengeId)}` : '/v2/library'}
                >
                  <img
                    src={c.video.thumbnailUrl}
                    alt=""
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <h3>{c.video.title}</h3>
                  <div className="meta">{c.video.channel} · {c.video.duration}</div>
                  <div className="row">
                    <V2Progress value={c.progress} label={`${c.video.title} progress`} />
                    <span>{c.drillsDone} / {c.drillsTotal}</span>
                  </div>
                  <div className="tags">
                    {c.tags.map(t => <V2Chip key={t}>{t}</V2Chip>)}
                  </div>
                </a>
                {c.video.isUserCustom && (
                  <button
                    type="button"
                    aria-label={`Remove "${c.video.title}" from library`}
                    title="Remove from library"
                    onClick={() => handleRemove(c.video)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid var(--v2-border, rgba(0,0,0,0.1))',
                      background: 'rgba(255,255,255,0.9)',
                      color: 'var(--v2-text, #1a1f36)',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </V2Shell>
  );
}
