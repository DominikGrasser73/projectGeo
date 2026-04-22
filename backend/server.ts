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

// GET /api/addresses/nearest?lat=...&lng=...
app.get('/api/addresses/nearest', async (req, res) => {
  const lat = parseFloat(req.query['lat'] as string);
  const lng = parseFloat(req.query['lng'] as string);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ message: 'lat and lng required' });
    return;
  }
  const session = driver.session();
  try {
    const result = await session.run(
      `WITH point({latitude: $lat, longitude: $lng}) AS clicked
       MATCH (a:Address)
       RETURN a, point.distance(a.location, clicked) AS dist
       ORDER BY dist ASC LIMIT 1`,
      { lat, lng }
    );
    if (result.records.length === 0) {
      res.status(404).json({ message: 'No address found' });
      return;
    }
    const a    = result.records[0].get('a').properties;
    const dist = result.records[0].get('dist');
    res.json({
      id:     a.id,
      label:  `${a.street} ${a.number}, ${a.postcode} ${a.city}`,
      street: a.street,
      number: a.number,
      city:   a.city,
      postcode: a.postcode,
      distanceMeters: Math.round(dist),
      lat: a.location.y,
      lng: a.location.x
    });
  } catch (err) {
    console.error('Nearest address error:', err);
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

// ─── helpers ────────────────────────────────────────────────────────────────

function toNeo4jDate(iso: string) {
  return neo4j.types.DateTime.fromStandardDate(new Date(iso));
}

function intVal(v: any): number {
  return typeof v === 'object' && v !== null ? v.toNumber() : Number(v);
}

// ─── USER ROUTES ─────────────────────────────────────────────────────────────

// GET /api/users/:username/states
app.get('/api/users/:username/states', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {username:$u})-[:INTERESTED_IN]->(s:State) RETURN s.name AS name',
      { u: req.params['username'] }
    );
    res.json(result.records.map(r => r.get('name')));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/users/:username/districts
app.get('/api/users/:username/districts', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {username:$u})-[:INTERESTED_IN]->(d:District) RETURN d.name AS name',
      { u: req.params['username'] }
    );
    res.json(result.records.map(r => r.get('name')));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/users/:username/friends
app.get('/api/users/:username/friends', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {username:$u})-[:FRIEND_WITH]->(f:User) RETURN f.username AS name',
      { u: req.params['username'] }
    );
    res.json(result.records.map(r => r.get('name')));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/users/:username/network  — 1-2 hop connections with count
app.get('/api/users/:username/network', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH p=(me:User{username:$u})-[*1..2]-(other:User)
       WHERE me <> other
       RETURN other.username AS name, COUNT(DISTINCT p) AS connections
       ORDER BY connections DESC LIMIT 10`,
      { u: req.params['username'] }
    );
    res.json(result.records.map(r => ({ name: r.get('name'), count: intVal(r.get('connections')) })));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/users/:username/areas  — body: { states[], districts[] }
app.post('/api/users/:username/areas', async (req, res) => {
  const { states, districts } = req.body as { states: string[]; districts: string[] };
  const username = req.params['username'];
  const session = driver.session();
  try {
    for (const state of states ?? []) {
      await session.run(
        'MATCH (s:State{name:$s}),(u:User{username:$u}) MERGE (u)-[:INTERESTED_IN]->(s)',
        { s: state, u: username }
      );
    }
    for (const district of districts ?? []) {
      await session.run(
        'MATCH (d:District{name:$d}),(u:User{username:$u}) MERGE (u)-[:INTERESTED_IN]->(d)',
        { d: district, u: username }
      );
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/users/:username/friends  — body: { friend }
app.post('/api/users/:username/friends', async (req, res) => {
  const { friend } = req.body as { friend: string };
  const session = driver.session();
  try {
    await session.run(
      'MATCH (me:User{username:$u}),(other:User{username:$f}) MERGE (me)-[:FRIEND_WITH]->(other)',
      { u: req.params['username'], f: friend }
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// ─── ACTIVITY ROUTES ──────────────────────────────────────────────────────────

// GET /api/activities?states=a,b&districts=c,d
app.get('/api/activities', async (req, res) => {
  const states    = ((req.query['states']    as string) || '').split(',').filter(Boolean);
  const districts = ((req.query['districts'] as string) || '').split(',').filter(Boolean);
  const session = driver.session();
  const activities: any[] = [];
  try {
    for (const state of states) {
      const r = await session.run(
        'MATCH (a:Activity)-[:TAKES_PLACE_IN]->(s:State{name:$s}) RETURN a', { s: state }
      );
      r.records.forEach(rec => activities.push(mapActivity(rec.get('a'))));
    }
    for (const district of districts) {
      const r = await session.run(
        'MATCH (a:Activity)-[:TAKES_PLACE_IN]->(d:District{name:$d}) RETURN a', { d: district }
      );
      r.records.forEach(rec => activities.push(mapActivity(rec.get('a'))));
    }
    res.json(activities);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

function mapActivity(node: any) {
  const p = node.properties;
  return {
    id:          p.id,
    name:        p.name,
    description: p.description,
    datetime:    p.datetime24h?.toString() ?? null,
    lat:         p.coords?.y ?? null,
    lng:         p.coords?.x ?? null,
  };
}

// POST /api/activities  — body: { name, description, datetime, lat, lng, districtName }
app.post('/api/activities', async (req, res) => {
  const { name, description, datetime, lat, lng, districtName } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `MATCH (d:District{name:$districtName})
       CREATE (a:Activity{name:$name, description:$description, datetime24h:$dt,
               coords:point({latitude:$lat, longitude:$lng})})-[:TAKES_PLACE_IN]->(d)`,
      { name, description, dt: toNeo4jDate(datetime), lat, lng, districtName }
    );
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/activities/join  — body: { username, lat, lng }
app.post('/api/activities/join', async (req, res) => {
  const { username, lat, lng } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `MATCH (a:Activity{coords:point({latitude:$lat,longitude:$lng})}),
             (u:User{username:$u})
       MERGE (u)-[:PARTICIPATES_IN]->(a)`,
      { u: username, lat, lng }
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/activities/participated  — confirms participation (PARTICIPATES_IN → PARTICIPATED_IN)
app.post('/api/activities/participated', async (req, res) => {
  const { username, lat, lng } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `MATCH (u:User{username:$u}),(a:Activity{coords:point({latitude:$lat,longitude:$lng})})
       MERGE (u)-[:PARTICIPATED_IN]->(a)`,
      { u: username, lat, lng }
    );
    await session.run(
      `MATCH (u:User{username:$u})-[p:PARTICIPATES_IN]->(a:Activity{coords:point({latitude:$lat,longitude:$lng})})
       DELETE p`,
      { u: username, lat, lng }
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/activities/by-coords?lat=&lng=
app.get('/api/activities/by-coords', async (req, res) => {
  const lat = parseFloat(req.query['lat'] as string);
  const lng = parseFloat(req.query['lng'] as string);
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Activity)-[:TAKES_PLACE_IN]->(d:District)-[:LOCATED_IN]->(s:State)
       WHERE a.coords = point({latitude:$lat, longitude:$lng})
       RETURN a, d, s`,
      { lat, lng }
    );
    if (result.records.length === 0) { res.status(404).json({ message: 'Not found' }); return; }
    const rec = result.records[0];
    const a = rec.get('a').properties;
    const d = rec.get('d').properties;
    const s = rec.get('s').properties;
    res.json({
      id: a.id, name: a.name, description: a.description,
      date: a.datetime24h?.toString(),
      district: d.name, state: s.name, participants: [],
      location: { lat: a.coords.y, lng: a.coords.x }
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/activities/participants?lat=&lng=&username=
app.get('/api/activities/participants', async (req, res) => {
  const lat      = parseFloat(req.query['lat'] as string);
  const lng      = parseFloat(req.query['lng'] as string);
  const username = req.query['username'] as string;
  const session  = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User)-[:PARTICIPATES_IN]->(a:Activity)
       WHERE a.coords = point({latitude:$lat,longitude:$lng}) AND u.username <> $u
       RETURN u.username AS name`,
      { lat, lng, u: username }
    );
    res.json(result.records.map(r => r.get('name')));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/activities/valid?lat=&lng=&username=
app.get('/api/activities/valid', async (req, res) => {
  const lat      = parseFloat(req.query['lat'] as string);
  const lng      = parseFloat(req.query['lng'] as string);
  const username = req.query['username'] as string;
  const session  = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User{username:$u})-[:PARTICIPATES_IN]->(a:Activity{coords:point({latitude:$lat,longitude:$lng})})
       RETURN count(a) AS c`,
      { u: username, lat, lng }
    );
    res.json({ valid: intVal(result.records[0].get('c')) > 0 });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/visited?username=&name=&type=states|districts
app.get('/api/visited', async (req, res) => {
  const username = req.query['username'] as string;
  const name     = req.query['name'] as string;
  const type     = req.query['type'] as string;
  const session  = driver.session();
  let query: string;
  if (type === 'states') {
    query = `MATCH (u:User{username:$u})-[:PARTICIPATED_IN]->(a:Activity)-[:TAKES_PLACE_IN]->(:District)-[:LOCATED_IN]->(s:State{name:$n}) RETURN COUNT(s) AS c`;
  } else {
    query = `MATCH (u:User{username:$u})-[:PARTICIPATED_IN]->(a:Activity)-[:TAKES_PLACE_IN]->(d:District{name:$n}) RETURN COUNT(d) AS c`;
  }
  try {
    const result = await session.run(query, { u: username, n: name });
    res.json({ count: intVal(result.records[0].get('c')) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// ─── GOAL ROUTES ──────────────────────────────────────────────────────────────

// GET /api/goals/:username
app.get('/api/goals/:username', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User{username:$u})-[:HAS_GOAL]->(g:Goal) WHERE g.status = 'Active' RETURN g`,
      { u: req.params['username'] }
    );
    const goals = result.records.map(r => {
      const g = r.get('g').properties;
      return {
        type: g.type, subType: g.subType, subSubType: g.subSubType,
        single: g.single, status: g.status,
        progress: intVal(g.progress), target: intVal(g.target),
        startDate: g.startDate?.toString()
      };
    });
    res.json(goals);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/goals  — body: { username, goal }
app.post('/api/goals', async (req, res) => {
  const { username, goal } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `MATCH (u:User{username:$u})
       MERGE (u)-[:HAS_GOAL]->(g:Goal{type:$type,subType:$sub,subSubType:$subsub,
         single:$single,status:$status,progress:$progress,target:$target,startDate:$sd})`,
      {
        u: username, type: goal.type, sub: goal.subType, subsub: goal.subSubType,
        single: goal.single, status: goal.status,
        progress: neo4j.int(goal.progress), target: neo4j.int(goal.target),
        sd: toNeo4jDate(goal.startDate)
      }
    );
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// PUT /api/goals  — body: { username, goal }
app.put('/api/goals', async (req, res) => {
  const { username, goal } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `MATCH (u:User{username:$u})-[:HAS_GOAL]->(g:Goal{startDate:$sd})
       SET g.status=$status, g.progress=$progress`,
      {
        u: username, sd: toNeo4jDate(goal.startDate),
        status: goal.status, progress: neo4j.int(goal.progress)
      }
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/goals/track-new-people  — body: { username, goalStartDate, participants[] }
app.post('/api/goals/track-new-people', async (req, res) => {
  const { username, goalStartDate, participants } = req.body as {
    username: string; goalStartDate: string; participants: string[];
  };
  const session = driver.session();
  try {
    for (const p of participants) {
      await session.run(
        `MATCH (u:User{username:$p}), (g:Goal{startDate:$sd})<-[:HAS_GOAL]-(:User{username:$u})
         MERGE (g)-[:NEW_PEOPLE]->(u)`,
        { p, sd: toNeo4jDate(goalStartDate), u: username }
      );
    }
    const count = await session.run(
      `MATCH (g:Goal{startDate:$sd})-[:NEW_PEOPLE]->(u:User)
       RETURN COUNT(u) AS c`,
      { sd: toNeo4jDate(goalStartDate) }
    );
    res.json({ count: intVal(count.records[0].get('c')) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/goals/track-visited  — body: { goalStartDate, location, locationType: 'States'|'Districts' }
app.post('/api/goals/track-visited', async (req, res) => {
  const { goalStartDate, location, locationType } = req.body as {
    goalStartDate: string; location: string; locationType: string;
  };
  const session = driver.session();
  try {
    const mergeQ = locationType === 'States'
      ? `MATCH (g:Goal{startDate:$sd}),(s:State{name:$loc}) MERGE (g)-[:VISITED]->(s)`
      : `MATCH (g:Goal{startDate:$sd}),(d:District{name:$loc}) MERGE (g)-[:VISITED]->(d)`;
    await session.run(mergeQ, { sd: toNeo4jDate(goalStartDate), loc: location });

    const countQ = locationType === 'States'
      ? `MATCH (g:Goal{startDate:$sd})-[:VISITED]->(s:State) RETURN COUNT(s) AS c`
      : `MATCH (g:Goal{startDate:$sd})-[:VISITED]->(d:District) RETURN COUNT(d) AS c`;
    const count = await session.run(countQ, { sd: toNeo4jDate(goalStartDate) });
    res.json({ count: intVal(count.records[0].get('c')) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// GET /api/goals/is-new-location?username=&location=&locationType=
app.get('/api/goals/is-new-location', async (req, res) => {
  const username     = req.query['username'] as string;
  const location     = req.query['location'] as string;
  const locationType = req.query['locationType'] as string;
  const session      = driver.session();
  const query = locationType === 'States'
    ? `MATCH (u:User{username:$u})-[:PARTICIPATED_IN]->(:Activity)-[:TAKES_PLACE_IN]->(:District)-[:LOCATED_IN]->(s:State{name:$loc}) RETURN COUNT(s) AS c`
    : `MATCH (u:User{username:$u})-[:PARTICIPATED_IN]->(:Activity)-[:TAKES_PLACE_IN]->(d:District{name:$loc}) RETURN COUNT(d) AS c`;
  try {
    const result = await session.run(query, { u: username, loc: location });
    res.json({ isNew: intVal(result.records[0].get('c')) === 0 });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

// POST /api/friends/count  — body: { username, participants[] }
app.post('/api/friends/count', async (req, res) => {
  const { username, participants } = req.body as { username: string; participants: string[] };
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User{username:$u})-[:FRIEND_WITH]->(f:User)
       WHERE f.username IN $participants
       RETURN COUNT(f) AS c`,
      { u: username, participants }
    );
    res.json({ count: intVal(result.records[0].get('c')) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { await session.close(); }
});

const PORT = process.env['PORT'] || 3000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
