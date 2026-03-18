const { widget } = figma;
const { AutoLayout, Text, Input, useSyncedState, useSyncedMap } = widget;

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const FIBONACCI = ['1', '2', '3', '5', '8', '13', '21'];
const FIBO_IDX: Record<string, number> = {};
FIBONACCI.forEach((v, i) => { FIBO_IDX[v] = i; });

const CARD_COLORS: Record<string, { bg: string; text: string }> = {
  '1':  { bg: '#185FA5', text: '#FFFFFF' },
  '2':  { bg: '#0F6E56', text: '#FFFFFF' },
  '3':  { bg: '#3B6D11', text: '#FFFFFF' },
  '5':  { bg: '#BA7517', text: '#FFFFFF' },
  '8':  { bg: '#993C1D', text: '#FFFFFF' },
  '13': { bg: '#993556', text: '#FFFFFF' },
  '21': { bg: '#533AB7', text: '#FFFFFF' },
};

// ── TYPES ─────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'voting' | 'revealed';
type VoteEntry = { value: string; name: string };

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getMode(votes: VoteEntry[]): string | null {
  if (!votes.length) return null;
  const freq: Record<string, number> = {};
  votes.forEach(v => { freq[v.value] = (freq[v.value] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0][0];
}

function isDisagreement(votes: VoteEntry[]): boolean {
  const idxs = votes.map(v => FIBO_IDX[v.value]).filter(i => i !== undefined);
  if (idxs.length < 2) return false;
  return Math.max(...idxs) - Math.min(...idxs) >= 2;
}

function stampSelected(val: string): Promise<void> {
  return new Promise<void>(resolve => {
    figma.currentPage.selection
      .filter(n => n.type === 'STICKY' || n.type === 'SHAPE_WITH_TEXT')
      .forEach(n => {
        const t = n.type === 'STICKY'
          ? (n as StickyNode).text
          : (n as ShapeWithTextNode).text;
        t.characters = `[${val}] ${t.characters.replace(/^\[\S+\]\s*/, '')}`.trimEnd();
      });
    resolve();
  });
}

// ── WIDGET ────────────────────────────────────────────────────────────────────
function Widget() {
  const [phase, setPhase]                   = useSyncedState<Phase>('phase', 'idle');
  const [story, setStory]                   = useSyncedState<string>('story', '');
  const [facilitatorId, setFacilitatorId]   = useSyncedState<string>('facilitatorId', '');
  const votes = useSyncedMap<VoteEntry>('votes');

  // Current user — sessionId is always non-null (safe for anonymous users too)
  const me     = figma.currentUser;
  const userId = String(me?.sessionId ?? 0);
  const myVote = votes.get(userId);
  const isFacilitator = userId === facilitatorId;

  // Derived vote data
  const allVotes       = [...votes.entries()].map(([id, v]) => ({ id, ...v }));
  const voteCount      = allVotes.length;
  const suggested      = getMode(allVotes);
  const disagreement   = isDisagreement(allVotes);
  const uniqueValues   = [...new Set(allVotes.map(v => v.value))];

  function clearVotes() {
    for (const k of votes.keys()) votes.delete(k);
  }

  // ── IDLE ───────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <AutoLayout
        direction="vertical" spacing={10} padding={12}
        cornerRadius={12} fill="#FFFFFF" stroke="#E0DDD6" strokeWidth={1}
        width={290}
      >
        <Text fontSize={10} fill="#888780" letterSpacing={1.2} fontWeight="bold">
          PLANNING POKER
        </Text>

        <Input
          value={story}
          placeholder="What are we estimating?"
          onTextEditEnd={e => setStory(e.characters)}
          fontSize={13} fill="#1A1A1A"
          width={266}
        />

        <AutoLayout
          fill={story.trim() ? '#185FA5' : '#D1D5DB'}
          cornerRadius={8}
          padding={{ vertical: 9, horizontal: 0 }}
          horizontalAlignItems="center" width="fill-parent"
          onClick={() => {
            if (!story.trim() || !me) return;
            clearVotes();
            setFacilitatorId(userId);
            setPhase('voting');
          }}
        >
          <Text fill="#FFFFFF" fontSize={13} fontWeight="bold">▶  Start Session</Text>
        </AutoLayout>
      </AutoLayout>
    );
  }

  // ── VOTING ─────────────────────────────────────────────────────────────────
  if (phase === 'voting') {
    return (
      <AutoLayout
        direction="vertical" spacing={10} padding={12}
        cornerRadius={12} fill="#FFFFFF" stroke="#E0DDD6" strokeWidth={1}
        width={290}
      >
        {/* Header: story + counter */}
        <AutoLayout direction="horizontal" spacing={8} verticalAlignItems="center" width="fill-parent">
          <Text fontSize={12} fill="#1A1A1A" fontWeight="bold" width="fill-parent">
            {story}
          </Text>
          <Text
            fontSize={11} fontWeight="bold"
            fill={voteCount > 0 ? '#185FA5' : '#B4B2A9'}
          >
            {voteCount} voted
          </Text>
        </AutoLayout>

        {/* My vote status */}
        {myVote ? (
          <AutoLayout
            fill="#EFF6FF" cornerRadius={6}
            padding={{ vertical: 5, horizontal: 8 }}
            direction="horizontal" spacing={6} verticalAlignItems="center"
          >
            <Text fontSize={11} fill="#185FA5">✓  You picked</Text>
            <AutoLayout
              fill={CARD_COLORS[myVote.value]?.bg ?? '#6B7280'}
              cornerRadius={4} padding={{ vertical: 2, horizontal: 7 }}
            >
              <Text fontSize={11} fill="#FFFFFF" fontWeight="bold">{myVote.value}</Text>
            </AutoLayout>
            <Text fontSize={10} fill="#6B7280">(tap to change)</Text>
          </AutoLayout>
        ) : (
          <Text fontSize={11} fill="#B4B2A9">Pick your estimate below</Text>
        )}

        {/* Card grid — 7 × 32px + 6 × 5px gap = 254px, fits in 266px content */}
        <AutoLayout direction="horizontal" spacing={5} width="fill-parent">
          {FIBONACCI.map(p => {
            const c = CARD_COLORS[p];
            const selected = myVote?.value === p;
            return (
              <AutoLayout
                key={p} width={32} height={38} cornerRadius={8}
                fill={selected ? c.bg : '#F8F7F4'}
                stroke={c.bg} strokeWidth={selected ? 0 : 1.5}
                horizontalAlignItems="center" verticalAlignItems="center"
                onClick={() => {
                  if (!me) return;
                  votes.set(userId, { value: p, name: me.name });
                }}
              >
                <Text fontSize={13} fontWeight="bold" fill={selected ? '#FFFFFF' : c.bg}>
                  {p}
                </Text>
              </AutoLayout>
            );
          })}
        </AutoLayout>

        {/* Reveal button — facilitator only */}
        {isFacilitator && (
          <AutoLayout
            fill="#1F2937" cornerRadius={8}
            padding={{ vertical: 9, horizontal: 0 }}
            horizontalAlignItems="center" width="fill-parent"
            onClick={() => setPhase('revealed')}
          >
            <Text fill="#FFFFFF" fontSize={13} fontWeight="bold">
              Reveal  ({voteCount} voted)
            </Text>
          </AutoLayout>
        )}
      </AutoLayout>
    );
  }

  // ── REVEALED ───────────────────────────────────────────────────────────────
  return (
    <AutoLayout
      direction="vertical" spacing={10} padding={12}
      cornerRadius={12} fill="#FFFFFF"
      stroke={disagreement ? '#FCA5A5' : '#E0DDD6'}
      strokeWidth={disagreement ? 2 : 1}
      width={290}
    >
      {/* Header */}
      <AutoLayout direction="horizontal" spacing={8} verticalAlignItems="center" width="fill-parent">
        <Text fontSize={12} fill="#1A1A1A" fontWeight="bold" width="fill-parent">
          {story}
        </Text>
        {disagreement && (
          <Text fontSize={10} fill="#DC2626" fontWeight="bold">⚠  Discuss!</Text>
        )}
      </AutoLayout>

      {/* All votes */}
      {allVotes.length > 0 ? (
        <AutoLayout direction="horizontal" spacing={8} width="fill-parent">
          {allVotes.map(({ id, value, name }) => {
            const c = CARD_COLORS[value] ?? { bg: '#6B7280', text: '#FFFFFF' };
            return (
              <AutoLayout key={id} direction="vertical" spacing={4} horizontalAlignItems="center">
                <AutoLayout
                  width={40} height={40} cornerRadius={8}
                  fill={c.bg}
                  horizontalAlignItems="center" verticalAlignItems="center"
                >
                  <Text fontSize={15} fontWeight="bold" fill={c.text}>{value}</Text>
                </AutoLayout>
                <Text fontSize={9} fill="#888780" width={40} horizontalAlignText="center">
                  {name.split(' ')[0]}
                </Text>
              </AutoLayout>
            );
          })}
        </AutoLayout>
      ) : (
        <Text fontSize={11} fill="#B4B2A9">No votes recorded.</Text>
      )}

      {/* Facilitator controls */}
      {isFacilitator ? (
        <AutoLayout direction="vertical" spacing={6} width="fill-parent">
          {uniqueValues.length > 0 && (
            <AutoLayout direction="vertical" spacing={6} width="fill-parent">
              <Text fontSize={10} fill="#888780">Accept final estimate:</Text>
              <AutoLayout direction="horizontal" spacing={6}>
                {uniqueValues.map(v => {
                  const isSuggested = v === suggested;
                  return (
                    <AutoLayout
                      key={v}
                      fill={isSuggested ? '#185FA5' : '#F3F4F6'}
                      stroke={isSuggested ? '#185FA5' : '#D1D5DB'}
                      strokeWidth={1} cornerRadius={8}
                      padding={{ vertical: 7, horizontal: 14 }}
                      onClick={() => stampSelected(v).then(() => {
                        clearVotes();
                        setStory('');
                        setPhase('idle');
                      })}
                    >
                      <Text
                        fontSize={13} fontWeight="bold"
                        fill={isSuggested ? '#FFFFFF' : '#374151'}
                      >
                        {v} pts
                      </Text>
                    </AutoLayout>
                  );
                })}
              </AutoLayout>
            </AutoLayout>
          )}

          <AutoLayout
            fill="#F3F4F6" stroke="#D1D5DB" strokeWidth={1} cornerRadius={8}
            padding={{ vertical: 8, horizontal: 0 }}
            horizontalAlignItems="center" width="fill-parent"
            onClick={() => {
              clearVotes();
              setStory('');
              setPhase('idle');
            }}
          >
            <Text fill="#374151" fontSize={12} fontWeight="bold">↺  New Round</Text>
          </AutoLayout>
        </AutoLayout>
      ) : (
        <Text fontSize={11} fill="#B4B2A9" horizontalAlignText="center" width="fill-parent">
          Waiting for facilitator to accept…
        </Text>
      )}
    </AutoLayout>
  );
}

widget.register(Widget);
