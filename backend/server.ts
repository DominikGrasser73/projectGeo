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

// GET /api/addresses/search?q=...
app.get('/api/addresses/search', async (req, res) => {
  const q = (req.query['q'] as string)?.trim();
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Address)
       WHERE toLower(a.street) CONTAINS toLower($q)
          OR toLower(a.city)   CONTAINS toLower($q)
          OR toLower(a.full_address) CONTAINS toLower($q)
       RETURN a LIMIT 10`,
      { q }
    );
    const addresses = result.records.map(r => {
      const a = r.get('a').properties;
      return {
        id:    a.id,
        label: `${a.street} ${a.number}, ${a.postcode} ${a.city}`,
        street:   a.street,
        number:   a.number,
        city:     a.city,
        postcode: a.postcode,
        lat: a.location.y,
        lng: a.location.x
      };
    });
    res.json(addresses);
  } catch (err) {
    console.error('Address search error:', err);
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
  const { username, password, addressId } = req.body;
  if (!username || !password || !addressId) {
    res.status(400).json({ success: false, message: 'Username, password and address required' });
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
    const result = await session.run(
      `MATCH (a:Address {id: $addressId})
       CREATE (u:User {username: $username, password: $password})-[:LIVES_AT]->(a)
       RETURN u`,
      { username, password: hashed, addressId }
    );
    if (result.records.length === 0) {
      res.status(404).json({ success: false, message: 'Address not found' });
      return;
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
