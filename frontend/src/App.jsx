import { useEffect, useState, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Default configuration values (matching backend)
const DEFAULT_CONFIG = {
  boostedCards: ['megaminion', 'zap', 'knight', 'giant'],
  excludedCards: ['giantbuffer', 'mergemaiden'],
  minimumLevel: 13,
  maxElixir: 33,
  kingLevel: 16,  // King Tower level for boosted cards
  highPriorityCards: ['musketeer', 'megaminion', 'fireball', 'zap', 'miner', 'cannon', 'thelog', 'balloon', 'knight', 'wallbreakers'],
  secondaryPriorityCards: ['hogrider', 'battleram', 'royalhogs', 'suspiciousbush', 'ramrider'],
  mustUseCards: ['hogrider', 'battleram', 'royalhogs', 'suspiciousbush', 'ramrider'],
  sortPriority: 'achievements_rarity_level', // Options: achievements_rarity_level, level_achievements_rarity, achievements_rarity, custom
  ownedHeroes: ['archerqueen', 'goldenknight', 'skeletonking', 'mightyminer', 'monk', 'littleprince'], // Champion cards you own
  customSortOrder: [
    { field: 'achievement_lefts', direction: 'desc', enabled: true },
    { field: 'rarity', direction: 'desc', enabled: true },
    { field: 'level', direction: 'desc', enabled: true },
    { field: 'has_evolution', direction: 'desc', enabled: true },
    { field: 'is_hero', direction: 'desc', enabled: true },
    { field: 'elixirs', direction: 'desc', enabled: true },
  ],
};

// Available sort criteria for custom sorting
const SORT_CRITERIA = [
  { field: 'achievement_lefts', label: 'Achievements Left' },
  { field: 'rarity', label: 'Rarity' },
  { field: 'level', label: 'Level' },
  { field: 'has_evolution', label: 'Has Evolution' },
  { field: 'is_hero', label: 'Is Hero (Owned)' },
  { field: 'elixirs', label: 'Elixir Cost' },
];

// Sort priority options for the dropdown
const SORT_PRIORITY_OPTIONS = [
  { value: 'achievements_rarity_level', label: 'Achievements → Rarity → Level' },
  { value: 'level_achievements_rarity', label: 'Level → Achievements → Rarity' },
  { value: 'achievements_rarity', label: 'Achievements → Rarity' },
  { value: 'custom', label: '⚙️ Custom Order...' },
];

// Helper to get card value for sorting
function getCardSortValue(card, field) {
  const rarityOrder = { CHAMPION: 4, LEGENDARY: 3, EPIC: 2, RARE: 1, COMMON: 0 };
  switch (field) {
    case 'level': return card.temp_level || card.level;
    case 'rarity': return rarityOrder[card.rarity] ?? 0;
    case 'elixirs': return card.elixirs;
    case 'has_evolution': return card.has_evolution ? 1 : 0;
    case 'is_hero': return card.is_hero_owned ? 1 : 0;
    case 'achievement_lefts': return card.achievement_lefts;
    default: return 0;
  }
}

// Create comparator based on priority (matching backend logic)
function createPriorityComparator(priority, customSortOrder = []) {
  const rarityOrder = { CHAMPION: 4, LEGENDARY: 3, EPIC: 2, RARE: 1, COMMON: 0 };
  
  return (a, b) => {
    // For custom sort, use the user-defined order
    if (priority === 'custom' && customSortOrder && customSortOrder.length > 0) {
      for (const criterion of customSortOrder) {
        if (!criterion.enabled) continue;
        
        const aVal = getCardSortValue(a, criterion.field);
        const bVal = getCardSortValue(b, criterion.field);
        
        if (aVal !== bVal) {
          // desc = higher values first, asc = lower values first
          return criterion.direction === 'desc' ? bVal - aVal : aVal - bVal;
        }
      }
      return 0;
    }

    // Legacy presets (still no hardcoded evolution priority)
    let order;
    if (priority === 'achievements_rarity_level') {
      order = [
        [b.achievement_lefts, a.achievement_lefts],
        [rarityOrder[b.rarity] ?? 0, rarityOrder[a.rarity] ?? 0],
        [b.temp_level || b.level, a.temp_level || a.level],
      ];
    } else if (priority === 'level_achievements_rarity') {
      order = [
        [b.temp_level || b.level, a.temp_level || a.level],
        [b.achievement_lefts, a.achievement_lefts],
        [rarityOrder[b.rarity] ?? 0, rarityOrder[a.rarity] ?? 0],
      ];
    } else { // achievements_rarity
      order = [
        [b.achievement_lefts, a.achievement_lefts],
        [rarityOrder[b.rarity] ?? 0, rarityOrder[a.rarity] ?? 0],
      ];
    }

    for (const [bVal, aVal] of order) {
      if (bVal !== aVal) return bVal - aVal;
    }
    return 0;
  };
}

// Rarity achievement multipliers (matching backend)
const RARITY_ACHIEVEMENTS = {
  COMMON: { base: 6, perLevel: 2 },
  RARE: { base: 9, perLevel: 3 },
  EPIC: { base: 12, perLevel: 4 },
  LEGENDARY: { base: 15, perLevel: 5 },
  CHAMPION: { base: 15, perLevel: 5 },
};

// Cards with 10 achievable mastery levels
const TEN_ACHIEVEMENT_CARDS = {
  COMMON: ['arrows', 'royalgiant', 'electrospirit', 'firespirit', 'firecracker', 'mortar'],
  RARE: ['battlehealer', 'battleram', 'dartgoblin', 'earthquake', 'flyingmachine', 'hogrider', 'minipekka', 'musketeer', 'valkyrie', 'wizard'],
  EPIC: ['babydragon', 'balloon', 'bowler', 'pekka', 'wallbreakers'],
  LEGENDARY: ['electrowizard', 'graveyard', 'megaknight', 'princess', 'thelog'],
};

const styles = {
  container: { padding: 24, fontFamily: 'Arial, sans-serif', maxWidth: 1400, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 24 },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, justifyContent: 'center' },
  tab: { padding: '10px 16px', border: '1px solid #ccc', cursor: 'pointer', borderRadius: 4, background: '#f5f5f5' },
  activeTab: { padding: '10px 16px', border: '2px solid #007bff', cursor: 'pointer', borderRadius: 4, background: '#007bff', color: 'white' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14 },
  th: { background: '#333', color: 'white', padding: 8, textAlign: 'left', position: 'sticky', top: 0 },
  td: { padding: 8, borderBottom: '1px solid #ddd' },
  section: { marginBottom: 32 },
  deckCard: { display: 'inline-block', padding: '8px 12px', margin: 4, background: '#e3f2fd', borderRadius: 4, border: '1px solid #90caf9' },
  priority: { color: '#d32f2f', fontWeight: 'bold' },
  secondary: { color: '#f57c00', fontWeight: 'bold' },
  heroOwned: { color: '#9c27b0', fontWeight: 'bold' },
  statBar: { display: 'flex', alignItems: 'center', marginBottom: 8 },
  statLabel: { width: 180, fontWeight: 'bold' },
  statValue: { background: '#4caf50', height: 20, borderRadius: 4, minWidth: 30, textAlign: 'center', color: 'white', fontSize: 12, lineHeight: '20px' },
  settingsPanel: { background: '#f0f4f8', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #ddd' },
  settingsRow: { display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, alignItems: 'center' },
  settingsLabel: { fontWeight: 'bold', minWidth: 150 },
  settingsInput: { padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', minWidth: 200 },
  settingsNumber: { padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', width: 80 },
  refreshBtn: { padding: '10px 24px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 },
  toggleBtn: { padding: '8px 16px', background: '#607d8b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', marginBottom: 16 },
  saveBtn: { padding: '10px 24px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 },
  resetBtn: { padding: '10px 24px', background: '#ff9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 },
  savedIndicator: { marginLeft: 12, color: '#4caf50', fontWeight: 'bold', fontSize: 14 },
};

// =============================================================================
// ANALYSIS ENGINE - All computation happens here in the frontend
// =============================================================================

function calculateAchievementLefts(card) {
  const rarity = card.rarity || 'COMMON';
  const config = RARITY_ACHIEVEMENTS[rarity] || RARITY_ACHIEVEMENTS.COMMON;
  const hasTen = TEN_ACHIEVEMENT_CARDS[rarity]?.includes(card.name);
  const maxBadge = hasTen ? 10 : 7;
  const badgeLevel = card.badge_level || 0;
  const badgesLeft = maxBadge - badgeLevel;
  return config.base + (card.level - 1) * config.perLevel + badgesLeft * 3;
}

function analyzeAllData(rawCards, config) {
  if (!rawCards || !Array.isArray(rawCards)) {
    return null;
  }

  // Step 1: Process cards with config
  const kingLevel = config.kingLevel || 16;  // Use King Tower level for boosted cards
  const ownedHeroesSet = new Set((config.ownedHeroes || []).map(h => h.toLowerCase()));
  const cards = rawCards
    .filter(c => !config.excludedCards.includes(c.name))
    .map(c => ({
      ...c,
      temp_level: config.boostedCards.includes(c.name) ? kingLevel : c.level,
      is_high_priority: config.highPriorityCards.includes(c.name),
      is_secondary_priority: config.secondaryPriorityCards.includes(c.name),
      is_boosted: config.boostedCards.includes(c.name),
      is_hero_owned: ownedHeroesSet.has(c.name.toLowerCase()),
    }));

  const cardMap = Object.fromEntries(cards.map(c => [c.name, c]));

  // Step 2: Achievement stats by card type
  const achievementStats = {};
  for (const card of cards) {
    if (card.cr_card_type && card.achievement_lefts > 0) {
      achievementStats[card.cr_card_type] = (achievementStats[card.cr_card_type] || 0) + card.achievement_lefts;
    }
  }
  const sortedStats = Object.fromEntries(
    Object.entries(achievementStats).sort((a, b) => b[1] - a[1])
  );

  // Step 3: Upgrade priority sorting
  const upgradePriority = [...cards].sort((a, b) => {
    const aHigh = config.highPriorityCards.includes(a.name);
    const bHigh = config.highPriorityCards.includes(b.name);
    if (aHigh !== bHigh) return aHigh ? -1 : 1;
    if (aHigh && bHigh) {
      const aIdx = config.highPriorityCards.indexOf(a.name);
      const bIdx = config.highPriorityCards.indexOf(b.name);
      if (aIdx !== bIdx) return aIdx - bIdx;
    }

    const aSecondary = config.secondaryPriorityCards.includes(a.name);
    const bSecondary = config.secondaryPriorityCards.includes(b.name);
    if (aSecondary !== bSecondary) return aSecondary ? -1 : 1;
    if (aSecondary && bSecondary) {
      const aIdx = config.secondaryPriorityCards.indexOf(a.name);
      const bIdx = config.secondaryPriorityCards.indexOf(b.name);
      if (aIdx !== bIdx) return aIdx - bIdx;
    }

    if (a.level !== b.level) return a.level - b.level;
    if (b.achievement_lefts !== a.achievement_lefts) return b.achievement_lefts - a.achievement_lefts;

    const aSpecial = (a.rarity === 'CHAMPION') || a.has_evolution;
    const bSpecial = (b.rarity === 'CHAMPION') || b.has_evolution;
    if (aSpecial !== bSpecial) return aSpecial ? -1 : 1;

    const rarityOrder = { CHAMPION: 4, LEGENDARY: 3, EPIC: 2, RARE: 1, COMMON: 0 };
    const aRarity = rarityOrder[a.rarity] ?? -1;
    const bRarity = rarityOrder[b.rarity] ?? -1;
    if (bRarity !== aRarity) return bRarity - aRarity;
    if (b.elixirs !== a.elixirs) return b.elixirs - a.elixirs;
    return 0;
  });

  // Step 4: Upgrade by rarity
  const upgradeByRarity = {};
  for (const card of upgradePriority) {
    const rarity = card.rarity || 'COMMON';
    if (!upgradeByRarity[rarity]) upgradeByRarity[rarity] = [];
    upgradeByRarity[rarity].push(card);
  }

  // Step 5: Upgrade recommendations (cards to upgrade with potential gains)
  const currentTotal = cards.reduce((sum, c) => sum + c.achievement_lefts, 0);
  const maxCards = cards.map(c => ({
    ...c,
    level: 14,
    achievement_lefts: calculateAchievementLefts({ ...c, level: 14 }),
  }));
  const maxTotal = maxCards.reduce((sum, c) => sum + c.achievement_lefts, 0);

  const recommendationsByRarity = {};
  for (const maxCard of maxCards) {
    const curr = cardMap[maxCard.name];
    if (curr && maxCard.rarity) {
      const diff = maxCard.achievement_lefts - curr.achievement_lefts;
      if (diff > 0) {
        const rarity = maxCard.rarity;
        if (!recommendationsByRarity[rarity]) recommendationsByRarity[rarity] = [];
        recommendationsByRarity[rarity].push({
          name: maxCard.name,
          current_level: curr.level,
          achievement_gain: diff,
          max_achievements: maxCard.achievement_lefts,
        });
      }
    }
  }
  for (const rarity in recommendationsByRarity) {
    recommendationsByRarity[rarity].sort((a, b) => b.achievement_gain - a.achievement_gain || b.max_achievements - a.max_achievements);
    recommendationsByRarity[rarity] = recommendationsByRarity[rarity].slice(0, 10);
  }

  // Step 6: Normal deck selection (sorted by selected priority)
  const priorityComparator = createPriorityComparator(
    config.sortPriority || 'achievements_rarity_level',
    config.customSortOrder || []
  );
  const deckSortedCards = [...cards]
    .filter(c => c.temp_level >= config.minimumLevel)
    .sort(priorityComparator);
  const normalDeck = deckSortedCards.slice(0, 8).map(c => c.name);

  // Step 7: Clan war decks (4 decks, non-overlapping, round-robin distribution)
  const clanWarDecks = [[], [], [], []];
  const usedForClanWar = new Set();
  let deckIndex = 0;
  for (const card of deckSortedCards) {
    if (usedForClanWar.has(card.name)) continue;
    // Find next deck that isn't full
    let attempts = 0;
    while (clanWarDecks[deckIndex].length >= 8 && attempts < 4) {
      deckIndex = (deckIndex + 1) % 4;
      attempts++;
    }
    if (clanWarDecks[deckIndex].length >= 8) break; // All decks full
    
    clanWarDecks[deckIndex].push(card);
    usedForClanWar.add(card.name);
    deckIndex = (deckIndex + 1) % 4; // Move to next deck
  }

  // Step 8: Clan war custom (with must-use cards and constraints)
  const clanWarCustom = buildClanWarCustomDecks(cards, config);

  return {
    cards,
    normal_deck: normalDeck,
    clan_war_decks: clanWarDecks,
    achievement_stats: sortedStats,
    upgrade_recommendations: {
      current_total: currentTotal,
      max_total: maxTotal,
      by_rarity: recommendationsByRarity,
    },
    upgrade_priority: upgradePriority,
    upgrade_by_rarity: upgradeByRarity,
    clan_war_custom: clanWarCustom,
    sort_priority: config.sortPriority || 'achievements_rarity_level',
  };
}

function buildClanWarCustomDecks(cards, config) {
  const mustUseSet = new Set(config.mustUseCards || []);

  const meetsLevelReq = (card) => {
    const minLvl = card.elixirs <= 2 ? 13 : 14;
    let effectiveLvl = config.boostedCards.includes(card.name) ? 16 : card.level;
    if (mustUseSet.has(card.name)) {
      // Must-use cards can be considered level 15, while real 16+ levels remain as-is.
      effectiveLvl = Math.max(effectiveLvl, 15);
    }
    return effectiveLvl >= minLvl;
  };

  const priorityComparator = createPriorityComparator(
    config.sortPriority || 'achievements_rarity_level',
    config.customSortOrder || []
  );

  const eligibleCards = cards.filter(meetsLevelReq);
  const bigSpells = eligibleCards.filter(c => c.cr_card_type === 'BIG_SPELL').sort(priorityComparator);
  const smallSpells = eligibleCards.filter(c => c.cr_card_type === 'SMALL_SPELL').sort(priorityComparator);
  const towerDefenders = eligibleCards.filter(c => c.cr_card_type === 'TOWER_DEFENDER').sort(priorityComparator);
  
  const cardMap = Object.fromEntries(cards.map(c => [c.name, c]));
  const mustUseDistribution = [[0], [1], [2], [3, 4]];
  const decks = [[], [], [], []];
  const usedCards = new Set();

  // Add must-use cards
  for (let deckIdx = 0; deckIdx < 4; deckIdx++) {
    for (const idx of mustUseDistribution[deckIdx]) {
      if (idx < config.mustUseCards.length) {
        const cardName = config.mustUseCards[idx];
        const card = cardMap[cardName];
        if (card && meetsLevelReq(card)) {
          decks[deckIdx].push(card);
          usedCards.add(cardName);
        }
      }
    }
  }

  // Add spells and tower defenders
  for (let deckIdx = 0; deckIdx < 4; deckIdx++) {
    for (const spell of bigSpells) {
      if (!usedCards.has(spell.name)) {
        decks[deckIdx].push(spell);
        usedCards.add(spell.name);
        break;
      }
    }
    for (const spell of smallSpells) {
      if (!usedCards.has(spell.name)) {
        decks[deckIdx].push(spell);
        usedCards.add(spell.name);
        break;
      }
    }
    for (const defender of towerDefenders) {
      if (!usedCards.has(defender.name)) {
        decks[deckIdx].push(defender);
        usedCards.add(defender.name);
        break;
      }
    }
  }

  // Fill remaining slots
  const remaining = eligibleCards
    .filter(c => !usedCards.has(c.name))
    .sort(priorityComparator);

  for (let deckIdx = 0; deckIdx < 4; deckIdx++) {
    while (decks[deckIdx].length < 8 && remaining.length > 0) {
      const card = remaining.shift();
      decks[deckIdx].push(card);
      usedCards.add(card.name);
    }
  }

  return decks.map(deck => {
    const totalElixir = deck.reduce((sum, c) => sum + c.elixirs, 0);
    const avgElixir = deck.length > 0 ? totalElixir / deck.length : 0;
    const totalAchv = deck.reduce((sum, c) => sum + c.achievement_lefts, 0);
    return {
      cards: deck,
      total_elixir: totalElixir,
      avg_elixir: Math.round(avgElixir * 10) / 10,
      total_achievements: totalAchv,
    };
  });
}

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

function App() {
  const [rawCards, setRawCards] = useState(null); // Original raw cards from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cards');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [analysisVersion, setAnalysisVersion] = useState(0); // Trigger re-analysis
  const [saveStatus, setSaveStatus] = useState(null); // 'saved', 'loading', 'error', or null

  // Fetch raw cards and settings from API on mount
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/data`).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      }),
      fetch(`${API_URL}/api/settings`).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      }).catch(() => DEFAULT_CONFIG) // Fallback to defaults if settings fail
    ])
      .then(([responseData, savedSettings]) => {
        console.log('API Response:', responseData);
        console.log('Loaded settings:', savedSettings);
        setRawCards(responseData.cards);
        setConfig({ ...DEFAULT_CONFIG, ...savedSettings });
        setLoading(false);
      })
      .catch((err) => {
        console.error('API Error:', err);
        setError(`${err.message} - API URL: ${API_URL}`);
        setLoading(false);
      });
  }, []);

  // Compute all analysis data from raw cards + config (memoized)
  const data = useMemo(() => {
    if (!rawCards) return null;
    console.log('Re-analyzing with config:', config, 'version:', analysisVersion);
    return analyzeAllData(rawCards, config);
  }, [rawCards, config, analysisVersion]);

  const handleRefresh = () => {
    setAnalysisVersion(v => v + 1);
    console.log('Manual refresh triggered');
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaveStatus(null); // Clear save status when config changes
  };

  const handleSaveSettings = async () => {
    setSaveStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      console.error('Save error:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleResetSettings = async () => {
    setSaveStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/settings`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to reset');
      const data = await res.json();
      setConfig({ ...DEFAULT_CONFIG, ...data.settings });
      setSaveStatus(null);
    } catch (e) {
      console.error('Reset error:', e);
      setConfig(DEFAULT_CONFIG);
      setSaveStatus(null);
    }
  };

  const parseCardList = (str) => str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}>Loading from {API_URL}...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 48, color: 'red' }}>Error: {error}</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 48, color: 'orange' }}>No data received from API</div>;

  const tabs = [
    { id: 'cards', label: '📋 All Cards' },
    { id: 'normal_deck', label: '🎮 Normal Deck' },
    { id: 'clan_war', label: '⚔️ Clan War Decks' },
    { id: 'achievement_stats', label: '📊 Achievement Stats' },
    { id: 'upgrade_recs', label: '⬆️ Upgrade Recs' },
    { id: 'upgrade_priority', label: '🎯 Upgrade Priority' },
    { id: 'upgrade_rarity', label: '💎 By Rarity' },
    { id: 'clan_war_custom', label: '🏆 CW Custom' },
    { id: 'deck_builder', label: '🔨 Deck Builder' },
  ];

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🏰 Clash Royale Deck Selector</h1>

      {/* Settings Toggle */}
      <button style={styles.toggleBtn} onClick={() => setShowSettings(!showSettings)}>
        ⚙️ {showSettings ? 'Hide Settings' : 'Show Settings'}
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div style={styles.settingsPanel}>
          <h3 style={{ marginTop: 0 }}>⚙️ Analysis Settings (Frontend Computation)</h3>
          
          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Boosted Cards:</span>
            <input
              style={styles.settingsInput}
              value={config.boostedCards.join(', ')}
              onChange={(e) => updateConfig('boostedCards', parseCardList(e.target.value))}
              placeholder="e.g., megaminion, zap"
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Excluded Cards:</span>
            <input
              style={styles.settingsInput}
              value={config.excludedCards.join(', ')}
              onChange={(e) => updateConfig('excludedCards', parseCardList(e.target.value))}
              placeholder="e.g., giantbuffer, mergemaiden"
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Owned Heroes:</span>
            <input
              style={{ ...styles.settingsInput, minWidth: 400 }}
              value={(config.ownedHeroes || []).join(', ')}
              onChange={(e) => updateConfig('ownedHeroes', parseCardList(e.target.value))}
              placeholder="e.g., archerqueen, goldenknight, skeletonking"
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>High Priority Cards:</span>
            <input
              style={{ ...styles.settingsInput, minWidth: 400 }}
              value={config.highPriorityCards.join(', ')}
              onChange={(e) => updateConfig('highPriorityCards', parseCardList(e.target.value))}
              placeholder="e.g., musketeer, megaminion, fireball"
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Secondary Priority:</span>
            <input
              style={{ ...styles.settingsInput, minWidth: 300 }}
              value={config.secondaryPriorityCards.join(', ')}
              onChange={(e) => updateConfig('secondaryPriorityCards', parseCardList(e.target.value))}
              placeholder="e.g., hogrider, battleram"
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Must-Use Cards (CW):</span>
            <input
              style={{ ...styles.settingsInput, minWidth: 300 }}
              value={config.mustUseCards.join(', ')}
              onChange={(e) => updateConfig('mustUseCards', parseCardList(e.target.value))}
              placeholder="e.g., hogrider, battleram, royalhogs"
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Sort Priority:</span>
            <select
              style={{ ...styles.settingsInput, minWidth: 280, cursor: 'pointer' }}
              value={config.sortPriority || 'achievements_rarity_level'}
              onChange={(e) => updateConfig('sortPriority', e.target.value)}
            >
              {SORT_PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Sort Order Editor */}
          {config.sortPriority === 'custom' && (
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              background: '#fff', 
              borderRadius: 6, 
              border: '1px solid #ccc' 
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                Custom Sort Order (drag to reorder, toggle to enable/disable):
              </div>
              {(config.customSortOrder || DEFAULT_CONFIG.customSortOrder).map((criterion, index) => {
                const criterionInfo = SORT_CRITERIA.find(c => c.field === criterion.field);
                return (
                  <div 
                    key={criterion.field} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      padding: '6px 8px',
                      marginBottom: 4,
                      background: criterion.enabled ? '#e8f5e9' : '#f5f5f5',
                      borderRadius: 4,
                      border: '1px solid #ddd',
                      opacity: criterion.enabled ? 1 : 0.6,
                    }}
                  >
                    <span style={{ width: 20, textAlign: 'center', color: '#666' }}>{index + 1}.</span>
                    <button
                      style={{ 
                        padding: '2px 6px', 
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.3 : 1,
                        border: '1px solid #ccc',
                        borderRadius: 3,
                        background: '#fff',
                      }}
                      onClick={() => {
                        if (index === 0) return;
                        const newOrder = [...(config.customSortOrder || DEFAULT_CONFIG.customSortOrder)];
                        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                        updateConfig('customSortOrder', newOrder);
                      }}
                      title="Move Up"
                    >▲</button>
                    <button
                      style={{ 
                        padding: '2px 6px', 
                        cursor: index === (config.customSortOrder || DEFAULT_CONFIG.customSortOrder).length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === (config.customSortOrder || DEFAULT_CONFIG.customSortOrder).length - 1 ? 0.3 : 1,
                        border: '1px solid #ccc',
                        borderRadius: 3,
                        background: '#fff',
                      }}
                      onClick={() => {
                        const order = config.customSortOrder || DEFAULT_CONFIG.customSortOrder;
                        if (index === order.length - 1) return;
                        const newOrder = [...order];
                        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                        updateConfig('customSortOrder', newOrder);
                      }}
                      title="Move Down"
                    >▼</button>
                    <input
                      type="checkbox"
                      checked={criterion.enabled}
                      onChange={() => {
                        const newOrder = [...(config.customSortOrder || DEFAULT_CONFIG.customSortOrder)];
                        newOrder[index] = { ...criterion, enabled: !criterion.enabled };
                        updateConfig('customSortOrder', newOrder);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontWeight: 500 }}>{criterionInfo?.label || criterion.field}</span>
                    <select
                      value={criterion.direction}
                      onChange={(e) => {
                        const newOrder = [...(config.customSortOrder || DEFAULT_CONFIG.customSortOrder)];
                        newOrder[index] = { ...criterion, direction: e.target.value };
                        updateConfig('customSortOrder', newOrder);
                      }}
                      style={{ padding: '2px 6px', borderRadius: 3, cursor: 'pointer' }}
                    >
                      <option value="desc">High → Low</option>
                      <option value="asc">Low → High</option>
                    </select>
                  </div>
                );
              })}
              <p style={{ fontSize: 12, color: '#666', marginTop: 8, marginBottom: 0 }}>
                Cards are sorted by enabled criteria in order. First match wins.
              </p>
            </div>
          )}

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Minimum Level:</span>
            <input
              type="number"
              style={styles.settingsNumber}
              value={config.minimumLevel}
              onChange={(e) => updateConfig('minimumLevel', parseInt(e.target.value) || 1)}
              min={1}
              max={16}
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>King Level (Boost):</span>
            <input
              type="number"
              style={styles.settingsNumber}
              value={config.kingLevel || 16}
              onChange={(e) => updateConfig('kingLevel', parseInt(e.target.value) || 16)}
              min={1}
              max={16}
            />
          </div>

          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Max Elixir:</span>
            <input
              type="number"
              style={styles.settingsNumber}
              value={config.maxElixir}
              onChange={(e) => updateConfig('maxElixir', parseInt(e.target.value) || 32)}
              min={20}
              max={72}
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={styles.refreshBtn} onClick={handleRefresh}>
              🔄 Refresh Analysis
            </button>
            <button style={styles.saveBtn} onClick={handleSaveSettings} disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? '⏳ Saving...' : '💾 Save Settings'}
            </button>
            <button style={styles.resetBtn} onClick={handleResetSettings} disabled={saveStatus === 'loading'}>
              ↩️ Reset to Defaults
            </button>
            {saveStatus === 'saved' && <span style={styles.savedIndicator}>✓ Settings saved to server!</span>}
            {saveStatus === 'error' && <span style={{ ...styles.savedIndicator, color: '#f44336' }}>✗ Failed to save</span>}
          </div>
          <p style={{ marginTop: 12, color: '#666', fontSize: 14 }}>
            Changes apply immediately. Click "Save Settings" to persist on the server (works across browsers).
          </p>
        </div>
      )}

      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={activeTab === tab.id ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cards' && <AllCardsTable cards={data.cards} />}
      {activeTab === 'normal_deck' && <NormalDeck deck={data.normal_deck} cards={data.cards} sortPriority={data.sort_priority} />}
      {activeTab === 'clan_war' && <ClanWarDecks decks={data.clan_war_decks} sortPriority={data.sort_priority} />}
      {activeTab === 'achievement_stats' && <AchievementStats stats={data.achievement_stats} />}
      {activeTab === 'upgrade_recs' && <UpgradeRecommendations data={data.upgrade_recommendations} />}
      {activeTab === 'upgrade_priority' && <UpgradePriority cards={data.upgrade_priority} />}
      {activeTab === 'upgrade_rarity' && <UpgradeByRarity data={data.upgrade_by_rarity} />}
      {activeTab === 'clan_war_custom' && <ClanWarCustom decks={data.clan_war_custom} sortPriority={data.sort_priority} />}
      {activeTab === 'deck_builder' && <DeckBuilder cards={data.cards} />}
    </div>
  );
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

function AllCardsTable({ cards }) {
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  if (!cards || !Array.isArray(cards)) {
    return <div style={styles.section}><h2>All Cards</h2><p>No data available</p></div>;
  }

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedCards = [...cards].sort((a, b) => {
    let aVal, bVal;
    const rarityOrder = { CHAMPION: 5, LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 };
    switch (sortCol) {
      case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
      case 'level': aVal = a.level; bVal = b.level; break;
      case 'rarity': aVal = rarityOrder[a.rarity] || 0; bVal = rarityOrder[b.rarity] || 0; break;
      case 'elixir': aVal = a.elixirs; bVal = b.elixirs; break;
      case 'achievements': aVal = a.achievement_lefts; bVal = b.achievement_lefts; break;
      case 'type': aVal = a.cr_card_type || ''; bVal = b.cr_card_type || ''; break;
      case 'evo': aVal = a.has_evolution ? 1 : 0; bVal = b.has_evolution ? 1 : 0; break;
      case 'priority': 
        aVal = a.is_high_priority ? 2 : a.is_secondary_priority ? 1 : 0;
        bVal = b.is_high_priority ? 2 : b.is_secondary_priority ? 1 : 0; break;
      case 'hero':
        aVal = a.is_hero_owned ? 1 : 0;
        bVal = b.is_hero_owned ? 1 : 0; break;
      default: aVal = 0; bVal = 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortHeader = (col, label) => (
    <th style={{ ...styles.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col)}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div style={styles.section}>
      <h2>All Cards ({cards.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              {renderSortHeader('name', 'Name')}
              {renderSortHeader('level', 'Level')}
              {renderSortHeader('rarity', 'Rarity')}
              {renderSortHeader('elixir', 'Elixir')}
              {renderSortHeader('achievements', 'Achievements')}
              {renderSortHeader('type', 'Type')}
              {renderSortHeader('evo', 'Evo')}
              {renderSortHeader('hero', 'Hero')}
              {renderSortHeader('priority', 'Priority')}
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card, i) => (
              <tr key={card.name} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={styles.td}>{i + 1}</td>
                <td style={styles.td}><strong>{card.name}</strong></td>
                <td style={styles.td}>{card.level}</td>
                <td style={styles.td}>{card.rarity}</td>
                <td style={styles.td}>{card.elixirs}</td>
                <td style={styles.td}>{card.achievement_lefts}</td>
                <td style={styles.td}>{card.cr_card_type || '-'}</td>
                <td style={styles.td}>{card.has_evolution ? '✓' : ''}</td>
                <td style={styles.td}>
                  {card.is_hero_owned && <span style={styles.heroOwned}>OWNED</span>}
                </td>
                <td style={styles.td}>
                  {card.is_high_priority && <span style={styles.priority}>HIGH</span>}
                  {card.is_secondary_priority && <span style={styles.secondary}>MED</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NormalDeck({ deck, cards, sortPriority }) {
  if (!deck || !Array.isArray(deck) || deck.length === 0) {
    return <div style={styles.section}><h2>Normal Deck</h2><p>No data available</p></div>;
  }
  const cardMap = Object.fromEntries((cards || []).map(c => [c.name, c]));
  const priorityLabel = SORT_PRIORITY_OPTIONS.find(o => o.value === sortPriority)?.label || sortPriority;
  return (
    <div style={styles.section}>
      <h2>Normal Deck ({deck.length} cards)</h2>
      <p style={{ color: '#666', marginBottom: 12, fontSize: 14 }}>
        Sorted by: <strong>{priorityLabel}</strong>
      </p>
      <div>
        {deck.map((name, idx) => {
          const card = cardMap[name];
          return (
            <span key={idx} style={styles.deckCard}>
              {name} {card ? `(Lv${card.level}, ${card.achievement_lefts} achv)` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ClanWarDecks({ decks, sortPriority }) {
  if (!decks || !Array.isArray(decks)) {
    return <div style={styles.section}><h2>Clan War Decks</h2><p>No data available</p></div>;
  }
  const priorityLabel = SORT_PRIORITY_OPTIONS.find(o => o.value === sortPriority)?.label || sortPriority;
  return (
    <div style={styles.section}>
      <h2>Clan War Decks (4 Decks)</h2>
      <p style={{ color: '#666', marginBottom: 12, fontSize: 14 }}>
        Sorted by: <strong>{priorityLabel}</strong>
      </p>
      {decks.map((deck, idx) => (
        <div key={idx} style={{ marginBottom: 16 }}>
          <h3>Deck {idx + 1}</h3>
          <div>
            {(deck || []).map((card) => (
              <span key={card.name} style={styles.deckCard}>
                {card.name} (Lv{card.level}, {card.achievement_lefts} achv)
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AchievementStats({ stats }) {
  if (!stats || typeof stats !== 'object') {
    return <div style={styles.section}><h2>Achievement Stats</h2><p>No data available</p></div>;
  }
  const values = Object.values(stats);
  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  return (
    <div style={styles.section}>
      <h2>Achievements Left by Card Type</h2>
      {Object.entries(stats).map(([type, count]) => (
        <div key={type} style={styles.statBar}>
          <span style={styles.statLabel}>{type}</span>
          <div style={{ ...styles.statValue, width: `${(count / maxValue) * 300}px` }}>{count}</div>
        </div>
      ))}
    </div>
  );
}

function UpgradeRecommendations({ data }) {
  if (!data || !data.by_rarity) {
    return <div style={styles.section}><h2>Upgrade Recommendations</h2><p>No data available</p></div>;
  }
  return (
    <div style={styles.section}>
      <h2>Cards to Upgrade</h2>
      <p><strong>Current Total Achievements:</strong> {data.current_total || 0}</p>
      <p><strong>Max Total (all cards maxed):</strong> {data.max_total || 0}</p>
      <p><strong>Potential Gain:</strong> +{(data.max_total || 0) - (data.current_total || 0)}</p>

      {Object.entries(data.by_rarity).map(([rarity, cards]) => (
        <div key={rarity} style={{ marginTop: 16 }}>
          <h3>{rarity} Cards</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Current Level</th>
                <th style={styles.th}>Achievement Gain</th>
                <th style={styles.th}>Max Achievements</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card, i) => (
                <tr key={card.name} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                  <td style={styles.td}>{card.name}</td>
                  <td style={styles.td}>{card.current_level}</td>
                  <td style={{ ...styles.td, color: '#4caf50', fontWeight: 'bold' }}>+{card.achievement_gain}</td>
                  <td style={styles.td}>{card.max_achievements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function UpgradePriority({ cards }) {
  if (!cards || !Array.isArray(cards)) {
    return <div style={styles.section}><h2>Upgrade Priority</h2><p>No data available</p></div>;
  }
  return (
    <div style={styles.section}>
      <h2>Upgrade Priority List</h2>
      <p>Cards sorted by upgrade priority (High Priority → Secondary → Level → Achievements)</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Level</th>
              <th style={styles.th}>Achievements</th>
              <th style={styles.th}>Rarity</th>
              <th style={styles.th}>Elixir</th>
              <th style={styles.th}>Evo</th>
            </tr>
          </thead>
          <tbody>
            {cards.slice(0, 50).map((card, i) => (
              <tr key={card.name} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={styles.td}>{i + 1}</td>
                <td style={styles.td}>
                  {card.is_high_priority && <span style={styles.priority}>⭐⭐</span>}
                  {card.is_secondary_priority && <span style={styles.secondary}>⭐</span>}
                </td>
                <td style={styles.td}><strong>{card.name}</strong></td>
                <td style={styles.td}>{card.level}</td>
                <td style={styles.td}>{card.achievement_lefts}</td>
                <td style={styles.td}>{card.rarity}</td>
                <td style={styles.td}>{card.elixirs}</td>
                <td style={styles.td}>{card.has_evolution ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UpgradeByRarity({ data }) {
  if (!data || typeof data !== 'object') {
    return <div style={styles.section}><h2>Upgrade by Rarity</h2><p>No data available</p></div>;
  }
  const rarityOrder = ['CHAMPION', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
  return (
    <div style={styles.section}>
      <h2>Upgrade Priority by Rarity</h2>
      {rarityOrder.map((rarity) => {
        const cards = data[rarity];
        if (!cards) return null;
        return (
          <div key={rarity} style={{ marginBottom: 24 }}>
            <h3>{rarity} ({cards.length} cards)</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Level</th>
                  <th style={styles.th}>Achievements</th>
                  <th style={styles.th}>Elixir</th>
                  <th style={styles.th}>Evo</th>
                </tr>
              </thead>
              <tbody>
                {cards.slice(0, 15).map((card, i) => (
                  <tr key={card.name} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}>
                      <strong>{card.name}</strong>
                      {card.is_high_priority && <span style={{ ...styles.priority, marginLeft: 8 }}>⭐⭐</span>}
                      {card.is_secondary_priority && <span style={{ ...styles.secondary, marginLeft: 8 }}>⭐</span>}
                    </td>
                    <td style={styles.td}>{card.level}</td>
                    <td style={styles.td}>{card.achievement_lefts}</td>
                    <td style={styles.td}>{card.elixirs}</td>
                    <td style={styles.td}>{card.has_evolution ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function ClanWarCustom({ decks, sortPriority }) {
  if (!decks || !Array.isArray(decks)) {
    return <div style={styles.section}><h2>Clan War Custom</h2><p>No data available</p></div>;
  }
  const priorityLabel = SORT_PRIORITY_OPTIONS.find(o => o.value === sortPriority)?.label || sortPriority;
  return (
    <div style={styles.section}>
      <h2>Clan War Custom Decks</h2>
      <p>Level requirement: 14 (or 13 for elixir ≤ 2) | Target avg elixir: 3.9 - 4.1</p>
      <p style={{ color: '#666', marginBottom: 12, fontSize: 14 }}>
        Sorted by: <strong>{priorityLabel}</strong>
      </p>
      {decks.map((deck, idx) => (
        <div key={idx} style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <h3>Deck {idx + 1}</h3>
          <p>
            <strong>Cards:</strong> {deck.cards.length} |
            <strong> Avg Elixir:</strong> {deck.avg_elixir} |
            <strong> Total Achievements:</strong> {deck.total_achievements}
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Level</th>
                <th style={styles.th}>Achievements</th>
                <th style={styles.th}>Elixir</th>
                <th style={styles.th}>Type</th>
              </tr>
            </thead>
            <tbody>
              {deck.cards.map((card, i) => (
                <tr key={card.name} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                  <td style={styles.td}>{i + 1}</td>
                  <td style={styles.td}><strong>{card.name}</strong></td>
                  <td style={styles.td}>{card.level}</td>
                  <td style={styles.td}>{card.achievement_lefts}</td>
                  <td style={styles.td}>{card.elixirs}</td>
                  <td style={styles.td}>{card.cr_card_type || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function DeckBuilder({ cards }) {
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [deckSize, setDeckSize] = useState(8);
  const [searchTerm, setSearchTerm] = useState('');

  if (!cards || !Array.isArray(cards)) {
    return <div style={styles.section}><h2>Deck Builder</h2><p>No data available</p></div>;
  }

  const toggleCard = (cardName) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardName)) {
        newSet.delete(cardName);
      } else {
        newSet.add(cardName);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedCards(new Set(filteredCards.map(c => c.name)));
  };

  const clearAll = () => {
    setSelectedCards(new Set());
  };

  // Filter cards by search term
  const filteredCards = cards.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Build deck from selected cards (sorted by lowest achievement_lefts first)
  const selectedCardsList = cards.filter(c => selectedCards.has(c.name));
  const sortedByAchievements = [...selectedCardsList].sort((a, b) => a.achievement_lefts - b.achievement_lefts);
  const generatedDeck = sortedByAchievements.slice(0, deckSize);

  const totalElixir = generatedDeck.reduce((sum, c) => sum + c.elixirs, 0);
  const avgElixir = generatedDeck.length > 0 ? (totalElixir / generatedDeck.length).toFixed(1) : 0;
  const totalAchievements = generatedDeck.reduce((sum, c) => sum + c.achievement_lefts, 0);

  // Group cards by type for easier selection
  const cardsByType = {};
  for (const card of filteredCards) {
    const type = card.cr_card_type || 'OTHER';
    if (!cardsByType[type]) cardsByType[type] = [];
    cardsByType[type].push(card);
  }

  const builderStyles = {
    container: { display: 'flex', gap: 24, flexWrap: 'wrap' },
    selectionPanel: { flex: '1 1 400px', maxHeight: 500, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8, padding: 16, background: '#fafafa' },
    deckPanel: { flex: '1 1 400px', padding: 16, background: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7' },
    typeGroup: { marginBottom: 16 },
    typeHeader: { fontWeight: 'bold', marginBottom: 8, color: '#555', borderBottom: '1px solid #ddd', paddingBottom: 4 },
    cardCheckbox: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' },
    cardLabel: { flex: 1 },
    achievementBadge: { fontSize: 12, color: '#666', background: '#e0e0e0', padding: '2px 6px', borderRadius: 4 },
    searchInput: { padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', width: '100%', marginBottom: 12 },
    btnGroup: { display: 'flex', gap: 8, marginBottom: 12 },
    smallBtn: { padding: '6px 12px', background: '#607d8b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
    deckSizeInput: { width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' },
  };

  return (
    <div style={styles.section}>
      <h2>🔨 Deck Builder - Low Achievement Cards</h2>
      <p>Select cards from the pool, and the deck will be built using cards with the <strong>lowest achievement_lefts</strong> first.</p>

      <div style={builderStyles.container}>
        {/* Card Selection Panel */}
        <div style={builderStyles.selectionPanel}>
          <h3 style={{ marginTop: 0 }}>📦 Card Pool ({selectedCards.size} selected)</h3>
          
          <input
            type="text"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={builderStyles.searchInput}
          />

          <div style={builderStyles.btnGroup}>
            <button style={builderStyles.smallBtn} onClick={selectAll}>Select All Visible</button>
            <button style={{ ...builderStyles.smallBtn, background: '#f44336' }} onClick={clearAll}>Clear All</button>
          </div>

          {Object.entries(cardsByType).sort().map(([type, typeCards]) => (
            <div key={type} style={builderStyles.typeGroup}>
              <div style={builderStyles.typeHeader}>{type} ({typeCards.length})</div>
              {typeCards.sort((a, b) => a.name.localeCompare(b.name)).map(card => (
                <label key={card.name} style={builderStyles.cardCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedCards.has(card.name)}
                    onChange={() => toggleCard(card.name)}
                  />
                  <span style={builderStyles.cardLabel}>{card.name}</span>
                  <span style={builderStyles.achievementBadge}>Achv: {card.achievement_lefts}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Generated Deck Panel */}
        <div style={builderStyles.deckPanel}>
          <h3 style={{ marginTop: 0 }}>🎯 Generated Deck</h3>
          
          <div style={{ marginBottom: 12 }}>
            <label>
              Deck Size: 
              <input
                type="number"
                min={1}
                max={20}
                value={deckSize}
                onChange={(e) => setDeckSize(parseInt(e.target.value) || 8)}
                style={builderStyles.deckSizeInput}
              />
            </label>
          </div>

          {generatedDeck.length > 0 ? (
            <>
              <p>
                <strong>Cards:</strong> {generatedDeck.length} |
                <strong> Avg Elixir:</strong> {avgElixir} |
                <strong> Total Achievements:</strong> {totalAchievements}
              </p>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Level</th>
                    <th style={styles.th}>Achievements</th>
                    <th style={styles.th}>Elixir</th>
                    <th style={styles.th}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedDeck.map((card, i) => (
                    <tr key={card.name} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={styles.td}><strong>{card.name}</strong></td>
                      <td style={styles.td}>{card.level}</td>
                      <td style={styles.td}>{card.achievement_lefts}</td>
                      <td style={styles.td}>{card.elixirs}</td>
                      <td style={styles.td}>{card.cr_card_type || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Select cards from the pool to generate a deck.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
