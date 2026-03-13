
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

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
  evolution: { color: '#7b1fa2' },
  statBar: { display: 'flex', alignItems: 'center', marginBottom: 8 },
  statLabel: { width: 180, fontWeight: 'bold' },
  statValue: { background: '#4caf50', height: 20, borderRadius: 4, minWidth: 30, textAlign: 'center', color: 'white', fontSize: 12, lineHeight: '20px' },
};

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cards');

  useEffect(() => {
    fetch(`${API_URL}/api/data`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}>Loading...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 48, color: 'red' }}>Error: {error}</div>;

  const tabs = [
    { id: 'cards', label: '📋 All Cards' },
    { id: 'normal_deck', label: '🎮 Normal Deck' },
    { id: 'clan_war', label: '⚔️ Clan War Decks' },
    { id: 'achievement_stats', label: '📊 Achievement Stats' },
    { id: 'upgrade_recs', label: '⬆️ Upgrade Recs' },
    { id: 'upgrade_priority', label: '🎯 Upgrade Priority' },
    { id: 'upgrade_rarity', label: '💎 By Rarity' },
    { id: 'clan_war_custom', label: '🏆 CW Custom' },
  ];

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🏰 Clash Royale Deck Selector</h1>

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
      {activeTab === 'normal_deck' && <NormalDeck deck={data.normal_deck} />}
      {activeTab === 'clan_war' && <ClanWarDecks decks={data.clan_war_decks} />}
      {activeTab === 'achievement_stats' && <AchievementStats stats={data.achievement_stats} />}
      {activeTab === 'upgrade_recs' && <UpgradeRecommendations data={data.upgrade_recommendations} />}
      {activeTab === 'upgrade_priority' && <UpgradePriority cards={data.upgrade_priority} />}
      {activeTab === 'upgrade_rarity' && <UpgradeByRarity data={data.upgrade_by_rarity} />}
      {activeTab === 'clan_war_custom' && <ClanWarCustom decks={data.clan_war_custom} />}
    </div>
  );
}

function AllCardsTable({ cards }) {
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

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
    switch (sortCol) {
      case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
      case 'level': aVal = a.level; bVal = b.level; break;
      case 'rarity': 
        const rarityOrder = { CHAMPION: 5, LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 };
        aVal = rarityOrder[a.rarity] || 0; bVal = rarityOrder[b.rarity] || 0; break;
      case 'elixir': aVal = a.elixirs; bVal = b.elixirs; break;
      case 'achievements': aVal = a.achievement_lefts; bVal = b.achievement_lefts; break;
      case 'type': aVal = a.cr_card_type || ''; bVal = b.cr_card_type || ''; break;
      case 'evo': aVal = a.has_evolution ? 1 : 0; bVal = b.has_evolution ? 1 : 0; break;
      case 'priority': 
        aVal = a.is_high_priority ? 2 : a.is_secondary_priority ? 1 : 0;
        bVal = b.is_high_priority ? 2 : b.is_secondary_priority ? 1 : 0; break;
      default: aVal = 0; bVal = 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ col, label }) => (
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
              <SortHeader col="name" label="Name" />
              <SortHeader col="level" label="Level" />
              <SortHeader col="rarity" label="Rarity" />
              <SortHeader col="elixir" label="Elixir" />
              <SortHeader col="achievements" label="Achievements" />
              <SortHeader col="type" label="Type" />
              <SortHeader col="evo" label="Evo" />
              <SortHeader col="priority" label="Priority" />
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

function NormalDeck({ deck }) {
  return (
    <div style={styles.section}>
      <h2>Normal Deck</h2>
      <div>
        {deck.map((name) => (
          <span key={name} style={styles.deckCard}>{name}</span>
        ))}
      </div>
    </div>
  );
}

function ClanWarDecks({ decks }) {
  return (
    <div style={styles.section}>
      <h2>Clan War Decks (4 Decks)</h2>
      {decks.map((deck, idx) => (
        <div key={idx} style={{ marginBottom: 16 }}>
          <h3>Deck {idx + 1}</h3>
          <div>
            {deck.map((card) => (
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
  const maxValue = Math.max(...Object.values(stats));
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
  return (
    <div style={styles.section}>
      <h2>Cards to Upgrade</h2>
      <p><strong>Current Total Achievements:</strong> {data.current_total}</p>
      <p><strong>Max Total (all cards maxed):</strong> {data.max_total}</p>
      <p><strong>Potential Gain:</strong> +{data.max_total - data.current_total}</p>

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

function ClanWarCustom({ decks }) {
  return (
    <div style={styles.section}>
      <h2>Clan War Custom Decks</h2>
      <p>Level requirement: 14 (or 13 for elixir ≤ 2) | Target avg elixir: 3.9 - 4.1</p>
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

export default App
