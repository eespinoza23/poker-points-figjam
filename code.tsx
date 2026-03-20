const { widget } = figma;
const { AutoLayout, Text, useSyncedState, useSyncedMap } = widget;

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

// ── WIDGET ────────────────────────────────────────────────────────────────────
function Widget() {
  const [phase, setPhase]                 = useSyncedState<Phase>('phase', 'idle');
  const [story, setStory]                 = useSyncedState<string>('story', '');
  const [facilitatorId, setFacilitatorId] = useSyncedState<string>('facilitatorId', '');
  const [storyNodeId, setStoryNodeId]     = useSyncedState<string>('storyNodeId', '');
  const votes = useSyncedMap<VoteEntry>('votes');

  const allVotes     = [...votes.entries()].map(([id, v]) => ({ id, ...v }));
  const voteCount    = allVotes.length;
  const suggested    = getMode(allVotes);
  const disagreement = isDisagreement(allVotes);
  const uniqueValues = [...new Set(allVotes.map(v => v.value))];

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

        <Text fontSize={9} fill="#B4B2A9">Select a sticky note on the board first</Text>

        <AutoLayout
          fill="#185FA5" cornerRadius={8}
          padding={{ vertical: 9, horizontal: 0 }}
          horizontalAlignItems="center" width="fill-parent"
          onClick={(): Promise<void> => new Promise(resolve => {
            // Capture selected sticky BEFORE the UI opens (selection clears once UI is active)
            const selected = figma.currentPage.selection
              .filter(n => n.type === 'STICKY' || n.type === 'SHAPE_WITH_TEXT');
            const nodeId = selected.length > 0 ? selected[0].id : '';

            figma.showUI(__html__, { width: 340, height: 148, title: 'Start Session' });
            figma.ui.postMessage({ type: 'init-start', story });
            figma.ui.on('message', (msg: any) => {
              if (msg.type === 'start-session') {
                if (msg.story !== undefined) setStory(msg.story);
                setStoryNodeId(nodeId);
                for (const k of votes.keys()) votes.delete(k);
                setFacilitatorId(figma.currentUser?.id ?? '');
                setPhase('voting');
                resolve();
              }
              if (msg.type === 'cancel') resolve();
            });
          })}
        >
          <Text fill="#FFFFFF" fontSize={13} fontWeight="bold">
            {story.trim() ? `▶  ${story}` : '▶  Start Session'}
          </Text>
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
        <AutoLayout direction="horizontal" spacing={8} verticalAlignItems="center" width="fill-parent">
          <Text fontSize={12} fill="#1A1A1A" fontWeight="bold" width="fill-parent">
            {story}
          </Text>
          <Text fontSize={11} fontWeight="bold" fill={voteCount > 0 ? '#185FA5' : '#B4B2A9'}>
            {voteCount} voted
          </Text>
        </AutoLayout>

        <Text fontSize={11} fill="#B4B2A9">Pick your estimate — hidden until reveal</Text>

        <AutoLayout direction="horizontal" spacing={5} width="fill-parent">
          {FIBONACCI.map(p => {
            const c = CARD_COLORS[p];
            return (
              <AutoLayout
                key={p} width={32} height={38} cornerRadius={8}
                fill="#F8F7F4" stroke={c.bg} strokeWidth={1.5}
                horizontalAlignItems="center" verticalAlignItems="center"
                onClick={(): Promise<void> => new Promise(resolve => {
                  const me = figma.currentUser;
                  if (me) votes.set(String(me.sessionId), { value: p, name: me.name });
                  resolve();
                })}
              >
                <Text fontSize={13} fontWeight="bold" fill={c.bg}>{p}</Text>
              </AutoLayout>
            );
          })}
        </AutoLayout>

        <AutoLayout
          fill="#1F2937" cornerRadius={8}
          padding={{ vertical: 9, horizontal: 0 }}
          horizontalAlignItems="center" width="fill-parent"
          onClick={(): Promise<void> => new Promise(resolve => {
            const me = figma.currentUser;
            const isAllowed = !facilitatorId || (me?.id ?? '') === facilitatorId;
            if (isAllowed) setPhase('revealed');
            resolve();
          })}
        >
          <Text fill="#FFFFFF" fontSize={13} fontWeight="bold">
            Reveal  ({voteCount} voted)
          </Text>
        </AutoLayout>
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
      <AutoLayout direction="horizontal" spacing={8} verticalAlignItems="center" width="fill-parent">
        <Text fontSize={12} fill="#1A1A1A" fontWeight="bold" width="fill-parent">
          {story}
        </Text>
        {disagreement && (
          <Text fontSize={10} fill="#DC2626" fontWeight="bold">⚠  Discuss!</Text>
        )}
      </AutoLayout>

      {allVotes.length > 0 ? (
        <AutoLayout direction="horizontal" spacing={8} width="fill-parent">
          {allVotes.map(({ id, value, name }) => {
            const c = CARD_COLORS[value] ?? { bg: '#6B7280', text: '#FFFFFF' };
            return (
              <AutoLayout key={id} direction="vertical" spacing={4} horizontalAlignItems="center">
                <AutoLayout
                  width={40} height={40} cornerRadius={8} fill={c.bg}
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

      {uniqueValues.length > 0 && (
        <AutoLayout direction="vertical" spacing={6} width="fill-parent">
          <AutoLayout direction="horizontal" spacing={6} verticalAlignItems="center" width="fill-parent">
            <Text fontSize={10} fill="#888780" width="fill-parent">Accept final estimate:</Text>
            <Text fontSize={9} fill={storyNodeId ? '#0F6E56' : '#B4B2A9'}>
              {storyNodeId ? '📌 linked' : 'select sticky first'}
            </Text>
          </AutoLayout>
          <AutoLayout direction="horizontal" spacing={6} width="fill-parent">
            {uniqueValues.map(v => {
              const isSuggested = v === suggested;
              return (
                <AutoLayout
                  key={v}
                  fill={isSuggested ? '#185FA5' : '#F3F4F6'}
                  stroke={isSuggested ? '#185FA5' : '#D1D5DB'}
                  strokeWidth={1} cornerRadius={8}
                  padding={{ vertical: 7, horizontal: 14 }}
                  onClick={(): Promise<void> => new Promise(resolve => {
                    const me = figma.currentUser;
                    const isAllowed = !facilitatorId || (me?.id ?? '') === facilitatorId;
                    if (!isAllowed) { resolve(); return; }

                    const nodeId = storyNodeId;
                    const acceptValue = v;

                    // Open hidden UI to get a proper async plugin context for font loading + node editing
                    figma.showUI(__html__, { visible: false });
                    figma.ui.on('message', async (msg: any) => {
                      if (msg.type !== 'ready') return;

                      const stored = nodeId ? figma.getNodeById(nodeId) : null;
                      const stickyNode =
                        (stored && (stored.type === 'STICKY' || stored.type === 'SHAPE_WITH_TEXT'))
                          ? stored : null;

                      if (stickyNode) {
                        try {
                          const t = stickyNode.type === 'STICKY'
                            ? (stickyNode as StickyNode).text
                            : (stickyNode as ShapeWithTextNode).text;
                          // Load font — fontName can be figma.mixed (a Symbol) on stickies with mixed styles
                          const fn = t.fontName;
                          if (typeof fn !== 'symbol') {
                            await figma.loadFontAsync(fn);
                          } else {
                            await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
                            await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
                          }
                          t.characters = `[${acceptValue}] ${t.characters.replace(/^\[\S+\]\s*/, '')}`.trimEnd();
                        } catch (e) {
                          console.error('Badge write failed:', e);
                        }
                      }

                      for (const k of votes.keys()) votes.delete(k);
                      setStoryNodeId('');
                      setStory('');
                      setPhase('idle');
                      resolve();
                    });
                  })}
                >
                  <Text fontSize={13} fontWeight="bold" fill={isSuggested ? '#FFFFFF' : '#374151'}>
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
        onClick={(): Promise<void> => new Promise(resolve => {
          for (const k of votes.keys()) votes.delete(k);
          setStoryNodeId('');
          setStory('');
          setPhase('idle');
          resolve();
        })}
      >
        <Text fill="#374151" fontSize={12} fontWeight="bold">↺  New Round</Text>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(Widget);
