import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ExternalLink, Flame, Trophy } from 'lucide-react';
import type { AiDigest, RepoSnapshot } from '../types';
import { formatCompactNumber } from '../utils/format';

interface VelocityAndContributorsProps {
  snapshot: RepoSnapshot;
  digest: AiDigest | null;
}

const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

export function VelocityAndContributors({ snapshot, digest }: VelocityAndContributorsProps) {
  const totalRecentCommits = snapshot.velocitySeries.reduce((sum, p) => sum + p.commits, 0);
  const totalRecentPrs = snapshot.velocitySeries.reduce((sum, p) => sum + p.mergedPRs, 0);
  const maxContrib = Math.max(1, ...snapshot.contributors.map((c) => c.contributions));

  // Real derived progress indicators for playful community milestones
  const releaseProgress = digest?.milestoneProgressPct ?? Math.min(92, 40 + totalRecentCommits * 3);
  const prMomentumPct = Math.min(100, Math.max(18, Math.round((totalRecentPrs / 10) * 100)));
  const commitBurstPct = Math.min(100, Math.max(20, Math.round((totalRecentCommits / 24) * 100)));

  return (
    <section id="community" className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
      {/* Left: Animated Velocity Charts + Milestone Progress Bars */}
      <div className="flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-7">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0F172A]">
                Development Velocity &amp; Pulse
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Real-time rhythm of fresh commits and merged community pull requests.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#FF5A5F]" aria-hidden="true" />
                Commits ({totalRecentCommits})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0D9488]" aria-hidden="true" />
                Merged PRs ({totalRecentPrs})
              </span>
            </div>
          </div>

          {/* Animated Area Chart */}
          <div className="mt-6 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={snapshot.velocitySeries}
                margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="coralCommitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5A5F" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#FF5A5F" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="tealPrsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '14px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="commits"
                  name="Commits"
                  stroke="#FF5A5F"
                  strokeWidth={2.5}
                  fill="url(#coralCommitsFill)"
                  animationDuration={850}
                />
                <Area
                  type="monotone"
                  dataKey="mergedPRs"
                  name="Merged PRs"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  fill="url(#tealPrsFill)"
                  animationDuration={950}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Playful Animated Milestone Progress Bars */}
        <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-[#FF5A5F]" />
              Next Milestone Momentum
            </span>
            <span className="font-mono tabular-nums text-[#FF5A5F]">{releaseProgress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${releaseProgress}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-[#FF5A5F] to-[#F59E0B]"
            />
          </div>
          <p className="text-xs text-slate-500">
            {digest?.nextMilestoneEstimate ||
              'Steady flow of commits and PR reviews pushing toward the next release.'}
          </p>

          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>🎯 PR Merge Energy</span>
                <span className="font-mono tabular-nums text-[#0D9488]">{prMomentumPct}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${prMomentumPct}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-[#0D9488]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>⚡ Commit Sprint Pace</span>
                <span className="font-mono tabular-nums text-[#FF5A5F]">{commitBurstPct}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${commitBurstPct}%` }}
                  transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-[#FF5A5F]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Top Contributors Leaderboard + Mini Contribution Bar Chart */}
      <div className="flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0F172A]">
                Community Builders
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Top open-source contributors powering this repo.
              </p>
            </div>
            <Trophy className="h-5 w-5 text-[#F59E0B] shrink-0" />
          </div>

          {snapshot.contributors.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              Contributor statistics are not publicly listed for this repository yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3.5">
              {snapshot.contributors.slice(0, 6).map((person, idx) => {
                const widthPct = Math.max(8, Math.round((person.contributions / maxContrib) * 100));
                return (
                  <a
                    key={person.login}
                    href={person.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-xl p-2 -mx-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-sm shrink-0" aria-hidden="true">
                          {RANK_EMOJIS[idx] || `${idx + 1}.`}
                        </span>
                        {person.avatarUrl ? (
                          <img
                            src={person.avatarUrl}
                            alt={`${person.login} avatar`}
                            referrerPolicy="no-referrer"
                            className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0 bg-slate-100"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D9488]/15 text-xs font-bold text-[#0D9488] shrink-0">
                            {person.login.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate text-sm font-semibold text-[#0F172A] group-hover:text-[#FF5A5F] transition-colors">
                          @{person.login}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
                          {formatCompactNumber(person.contributions)}
                        </span>
                        <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="mt-2 ml-8 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.7, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${
                          idx === 0
                            ? 'bg-[#F59E0B]'
                            : idx === 1
                              ? 'bg-[#FF5A5F]'
                              : 'bg-[#0D9488]'
                        }`}
                      />
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Contributor Distribution Mini-Chart */}
        {snapshot.contributors.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Contribution share across top builders
            </p>
            <div className="h-[74px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={snapshot.contributors.slice(0, 6).map((c) => ({
                    name: c.login.slice(0, 8),
                    contributions: c.contributions,
                  }))}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="contributions"
                    name="Contributions"
                    fill="#0D9488"
                    radius={[6, 6, 2, 2]}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
