
import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/data')
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Clash Royale Cards</h1>
      <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Level</th>
            <th>Rarity</th>
            <th>Elixir</th>
            <th>Achievements Left</th>
            <th>Type</th>
            <th>CR Card Type</th>
            <th>Evolution</th>
          </tr>
        </thead>
        <tbody>
          {data.cards.map((card) => (
            <tr key={card.name}>
              <td>{card.name}</td>
              <td>{card.level}</td>
              <td>{card.rarity}</td>
              <td>{card.elixirs}</td>
              <td>{card.achievement_lefts}</td>
              <td>{card.card_type}</td>
              <td>{card.cr_card_type}</td>
              <td>{card.has_evolution ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Sample Deck</h2>
      <ul>
        {data.deck.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App
