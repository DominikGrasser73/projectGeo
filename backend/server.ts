import express from 'express';
import cors from 'cors';
import neo4j from 'neo4j-driver';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'neo4jgeo')
);

// GET /api/addresses/streets?q=...  — distinct streets matching query
app.get('/api/addresses/streets', async (req, res) => {
  const q = (req.query['q'] as string)?.trim();
  if (!q || q.length < 2) { res.json([]); return; }
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Address)
       WHERE toLower(a.street) CONTAINS toLower($q)
          OR toLower(a.city)   CONTAINS toLower($q)
       RETURN DISTINCT a.street AS street, a.city AS city, a.postcode AS postcode
       ORDER BY a.street ASC LIMIT 15`,
      { q }
    );
    const streets = result.records.map(r => ({
      street:   r.get('street'),
      city:     r.get('city'),
      postcode: r.get('postcode'),
      label:    `${r.get('street')}, ${r.get('postcode')} ${r.get('city')}`
    }));
    res.json(streets);
  } catch (err) {
    console.error('Street search error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    await session.close();
  }
});

// GET /api/addresses/numbers?street=...&city=...  — house numbers for a street
app.get('/api/addresses/numbers', async (req, res) => {
  const street = (req.query['street'] as string)?.trim();
  const city   = (req.query['city']   as string)?.trim();
  if (!street || !city) { res.json([]); return; }
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Address {street: $street, city: $city}) RETURN a`,
      { street, city }
    );
    const numbers = result.records.map(r => {
      const a = r.get('a').properties;
      return {
        id:     a.id,
        number: a.number,
        label:  a.number || '(no number)',
        lat:    a.location.y,
        lng:    a.location.x
      };
    });
    // Natural sort so "2" < "10" < "10A" instead of lexicographic order
    numbers.sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })
    );
    res.json(numbers);
  } catch (err) {
    console.error('Numbers fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    await session.close();
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password required' });
    return;
  }
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {username: $username}) RETURN u',
      { username }
    );
    if (result.records.length === 0) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }
    const user = result.records[0].get('u');
    const match = await bcrypt.compare(password, user.properties.password);
    if (match) {
      res.json({ success: true, username: user.properties.username });
    } else {
      res.status(401).json({ success: false, message: 'Incorrect password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    await session.close();
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, addressId, location } = req.body;
  if (!username || !password || (!addressId && !location)) {
    res.status(400).json({ success: false, message: 'Username, password and a location are required' });
    return;
  }
  const session = driver.session();
  try {
    const exists = await session.run(
      'MATCH (u:User {username: $username}) RETURN u',
      { username }
    );
    if (exists.records.length > 0) {
      res.status(409).json({ success: false, message: 'Username already taken' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    let result;
    if (addressId) {
      // Link to the Address node
      result = await session.run(
        `MATCH (a:Address {id: $addressId})
         CREATE (u:User {username: $username, password: $password})-[:LIVES_AT]->(a)
         RETURN u`,
        { username, password: hashed, addressId }
      );
      if (result.records.length === 0) {
        res.status(404).json({ success: false, message: 'Address not found' });
        return;
      }
    } else {
      // Find the nearest Address to the clicked point, then link via LIVES_AT
      const nearest = await session.run(
        `WITH point({latitude: $lat, longitude: $lng}) AS clicked
         MATCH (a:Address)
         RETURN a, point.distance(a.location, clicked) AS dist
         ORDER BY dist ASC LIMIT 1`,
        { lat: location.lat, lng: location.lng }
      );
      if (nearest.records.length === 0) {
        res.status(404).json({ success: false, message: 'No address found near that location' });
        return;
      }
      const nearestId = nearest.records[0].get('a').properties.id;
      result = await session.run(
        `MATCH (a:Address {id: $addressId})
         CREATE (u:User {username: $username, password: $password})-[:LIVES_AT]->(a)
         RETURN u`,
        { username, password: hashed, addressId: nearestId }
      );
    }
    res.status(201).json({ success: true, username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    await session.close();
  }
});

const PORT = process.env['PORT'] || 3000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
